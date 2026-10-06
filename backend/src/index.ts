/**
 * backend/src/index.ts
 * PQM External Backend Authority Entrypoint
 *
 * Implements server-authoritative electronic signatures and batch release
 * for Firebase Spark / Free plan compatibility without Cloud Functions.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeFirebaseAdmin } from './config/firebaseAdmin';
import { signatureRouter } from './routes/signature';
import { releaseRouter } from './routes/release';
import { extractCorrelationId } from './utils/correlationId';

dotenv.config();

// Initialize Firebase Admin SDK
try {
  initializeFirebaseAdmin();
} catch (err: any) {
  console.warn('[Server Startup] Warning during Firebase Admin initialization:', err.message);
}

export const app = express();

// Middleware: CORS & JSON body parser
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'x-request-id'],
  })
);
app.use(express.json());

// Correlation ID & Structured Logging Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = extractCorrelationId(req);
  req.correlationId = correlationId;

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const userUid = req.user?.uid || 'anonymous';
    // Audit-safe log (Never logs secrets, tokens, or passwords)
    console.log(
      JSON.stringify({
        level: 'INFO',
        timestamp: new Date().toISOString(),
        correlationId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: duration,
        userUid,
      })
    );
  });

  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'pqm-backend-authority',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Mount Routes
app.use('/api/signatures', signatureRouter);
app.use('/api/batch-release', releaseRouter);

// Global 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: `Đường dẫn API '${req.method} ${req.path}' không tồn tại.`,
      correlationId: req.correlationId || 'UNKNOWN',
    },
  });
});

// Start listening if run directly
const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[PQM Backend Authority] Server running on port ${PORT}`);
  });
}
