import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import * as promClient from 'prom-client';
import path from 'path';

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

// Database Setup (Azure PostgreSQL)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'dbadmin',
  password: process.env.DB_PASSWORD || 'DevSecOpsPassword123!',
  database: process.env.DB_NAME || 'postgres',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

// Initialize Tables
const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS incidents (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255),
      description TEXT,
      severity VARCHAR(50),
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS runbooks (
      id SERIAL PRIMARY KEY,
      issue_type VARCHAR(255),
      resolution_steps TEXT
    );
  `);
  // Insert sample runbook if empty
  const res = await pool.query('SELECT COUNT(*) FROM runbooks');
  if (parseInt(res.rows[0].count) === 0) {
    await pool.query(`INSERT INTO runbooks (issue_type, resolution_steps) VALUES ('API Failure', '1. Check pod logs. 2. Restart deployment. 3. Verify DB connection.')`);
  }
};
initDB().catch(console.error);

// Middlewares
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
});

// --- INCIDENT ENDPOINTS ---
app.get('/incidents', async (req: Request, res: Response) => {
  const result = await pool.query('SELECT * FROM incidents ORDER BY date DESC');
  res.json(result.rows);
});

app.post('/incidents', async (req: Request, res: Response) => {
  const { title, description, severity } = req.body;
  const result = await pool.query(
    'INSERT INTO incidents (title, description, severity) VALUES ($1, $2, $3) RETURNING *',
    [title, description, severity]
  );
  res.status(201).json(result.rows[0]);
});

app.delete('/incidents/:id', async (req: Request, res: Response) => {
  await pool.query('DELETE FROM incidents WHERE id = $1', [req.params.id]);
  res.status(200).json({ message: 'Deleted' });
});

// --- RUNBOOK ENDPOINTS ---
app.get('/runbooks', async (req: Request, res: Response) => {
  const result = await pool.query('SELECT * FROM runbooks');
  res.json(result.rows);
});

// --- OPERATIONAL ENDPOINTS ---
app.get('/health', (req: Request, res: Response) => res.status(200).json({ status: 'UP' }));
app.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

app.listen(port, () => console.log(`Server running on port ${port}`));
