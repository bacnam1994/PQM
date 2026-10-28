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

// Protected AI config management (Requires Firebase ID Token + ADMIN)
aiRouter.get('/config', authenticateToken, AIController.getConfig);
aiRouter.post('/config', authenticateToken, AIController.updateConfig);
aiRouter.post('/config/test', authenticateToken, AIController.testConfig);

// Protected analysis endpoint (Requires Firebase ID Token + RBAC)
aiRouter.post('/analyze', authenticateToken, AIController.analyze);
