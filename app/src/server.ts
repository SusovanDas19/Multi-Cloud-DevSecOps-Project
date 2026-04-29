import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import * as promClient from 'prom-client';
import path from 'path';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
});

// AWS S3 Setup
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const BUCKET_NAME = process.env.AWS_S3_BUCKET;

// Database Setup
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'dbadmin',
  password: process.env.DB_PASSWORD || 'DevSecOpsPassword123!',
  database: process.env.DB_NAME || 'postgres',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

// Initialize Database Tables and Seed Data
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id SERIAL PRIMARY KEY, title VARCHAR(255), description TEXT, severity VARCHAR(50), date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS runbooks (
        id SERIAL PRIMARY KEY, issue_type VARCHAR(255), resolution_steps TEXT
      );
    `);
    
    // FIX: Check if we have less than 5 runbooks. If so, wipe and insert all 5.
    const res = await pool.query('SELECT COUNT(*) FROM runbooks');
    if (parseInt(res.rows[0].count) < 5) {
      await pool.query('TRUNCATE runbooks RESTART IDENTITY CASCADE'); // Clear old data
      await pool.query(`INSERT INTO runbooks (issue_type, resolution_steps) VALUES
        ('API Failure', '1. Check pod logs using kubectl. 2. Restart deployment. 3. Verify DB connection.'),
        ('DB Connection Timeout', '1. Check Azure DB firewall rules. 2. Verify DB_HOST secret in K8s. 3. Check node network.'),
        ('High CPU Usage', '1. Check Grafana dashboard. 2. Scale up replicas. 3. Profile Node.js app.'),
        ('Unauthorized Access', '1. Block IP in Azure NSG. 2. Rotate DB credentials. 3. Audit IAM roles.'),
        ('Pod CrashLoopBackOff', '1. Run kubectl describe pod. 2. Check container logs. 3. Verify health probe paths.')
      `);
      console.log("Database seeded with 5 Runbooks.");
    }
  } catch (error) {
    console.error("Database Initialization Error:", error);
  }
};
initDB();

// Middleware
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode }));
  next();
});

// --- INCIDENT ENDPOINTS ---
app.get('/incidents', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM incidents ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

app.post('/incidents', async (req: Request, res: Response) => {
  try {
    const { title, description, severity } = req.body;
    const result = await pool.query('INSERT INTO incidents (title, description, severity) VALUES ($1, $2, $3) RETURNING *', [title, description, severity]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

app.delete('/incidents/:id', async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM incidents WHERE id = $1', [req.params.id]);
    res.status(200).json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// --- RUNBOOK ENDPOINTS ---
app.get('/runbooks', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM runbooks');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// --- GALLERY ENDPOINTS ---
app.get('/gallery', async (req: Request, res: Response): Promise<any> => {
  try {
    if (!BUCKET_NAME) return res.json([]); // Return empty if no bucket configured
    
    const command = new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: 'arch_gallery/' });
    const response = await s3Client.send(command);
    const urls: string[] = [];
    
    if (response.Contents) {
      for (const item of response.Contents) {
        // Skip the folder itself, only process files
        if (item.Key && item.Key !== 'arch_gallery/' && item.Key.length > 'arch_gallery/'.length) {
          const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: item.Key });
          const url = await getSignedUrl(s3Client, getCmd, { expiresIn: 3600 });
          urls.push(url);
        }
      }
    }
    res.json(urls);
  } catch (error) {
    console.error("S3 Gallery Error:", error);
    res.status(500).json({ error: 'Failed to fetch images from S3' });
  }
});

// --- OPERATIONAL ENDPOINTS ---
app.get('/health', (req: Request, res: Response) => res.status(200).json({ status: 'UP' }));
app.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

app.listen(port, () => console.log(`Server running on port ${port}`));
