import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as promClient from 'prom-client';
import path from 'path';
import crypto from 'crypto';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Metrics Setup
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

// S3 Setup
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const upload = multer({ storage: multer.memoryStorage() });

// In-Memory Database for Incidents
let incidents: any[] = [];

// Middlewares
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
});

// --- CORE ENDPOINTS ---

app.get('/incidents', (req: Request, res: Response) => {
  res.json(incidents);
});

app.post('/incidents', (req: Request, res: Response) => {
  const newIncident = { id: crypto.randomUUID(), ...req.body, date: new Date().toISOString() };
  incidents.push(newIncident);
  res.status(201).json(newIncident);
});

app.delete('/incidents/:id', (req: Request, res: Response) => {
  incidents = incidents.filter(i => i.id !== req.params.id);
  res.status(200).json({ message: 'Deleted' });
});

app.post('/upload', upload.single('image'), async (req: Request, res: Response): Promise<any> => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  
  const fileName = `${Date.now()}-${req.file.originalname}`;
  const bucketName = process.env.AWS_S3_BUCKET;

  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  };

  try {
    await s3Client.send(new PutObjectCommand(params));
    const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    res.json({ url: publicUrl });
  } catch (error) {
    console.error("S3 Upload Error:", error);
    res.status(500).send('Error uploading to S3.');
  }
});

// --- OPERATIONAL ENDPOINTS ---

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP' });
});

app.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

app.get('/work', (req: Request, res: Response) => {
  let sum = 0;
  for (let i = 0; i < 1e7; i++) { sum += i; } // Simulate CPU load
  res.status(200).json({ message: 'Workload generated', sum });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
