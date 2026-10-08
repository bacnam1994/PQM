/**
 * backend/src/routes/ai.ts
 * AI Routes mounted at /api/ai
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { AIController } from '../ai/aiController';

export const aiRouter = Router();

// Public health & capability check
aiRouter.get('/health', AIController.health);

// Protected analysis endpoint (Requires Firebase ID Token + RBAC)
aiRouter.post('/analyze', authenticateToken, AIController.analyze);
