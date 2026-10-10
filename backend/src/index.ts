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
import { aiRouter } from './routes/ai';
import { AIService } from './ai/aiService';
import { extractCorrelationId } from './utils/correlationId';

dotenv.config();

// Initialize Firebase Admin SDK
try {
  initializeFirebaseAdmin();
} catch (err: any) {
  console.warn('[Server Startup] Warning during Firebase Admin initialization:', err.message);
}

export const app = express();

// Configuration: Allowed CORS Origins
export const getAllowedOrigins = (): string[] => {
  const defaultOrigins = [
    'https://v-biotech.web.app',
    'https://v-biotech.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
  ];

  const envOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  return Array.from(new Set([...defaultOrigins, ...envOrigins]));
};

// Middleware: Strict CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (mobile, server-to-server, unit tests)
      if (!origin) {
        return callback(null, true);
      }
      const allowed = getAllowedOrigins();
      if (allowed.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked: Origin '${origin}' is not allowed by CORS policy.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'x-request-id'],
  })
);

app.use(express.json());

// Handle CORS error response
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err && err.message && err.message.includes('CORS blocked')) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CORS_BLOCKED',
        message: err.message,
        correlationId: extractCorrelationId(req),
      },
    });
  }
  next(err);
});

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
  const isAiConfigured = AIService.isConfigured();
  res.status(200).json({
    status: 'healthy',
    service: 'pqm-backend-authority',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    components: {
      backend: 'healthy',
      aiProvider: isAiConfigured ? 'configured' : 'unconfigured',
    },
  });
});

// Mount Routes
app.use('/api/signatures', signatureRouter);
app.use('/api/batch-release', releaseRouter);
app.use('/api/ai', aiRouter);

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
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`[PQM Backend Authority] Server running on port ${PORT}`);
  });
}
