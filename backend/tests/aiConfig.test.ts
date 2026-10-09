/**
 * backend/tests/aiConfig.test.ts
 * Unit & Integration tests for Server-Side AI Configuration & Health API (Phases 4, 5, 6, 7)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { setCustomAdminInstances } from '../src/config/firebaseAdmin';
import { createStrictMockDatabase, createMockAuth } from './mockDb';
import { setCustomModelCaller, AIService } from '../src/ai/aiService';

describe('Server-Authoritative AI Configuration & Health API', () => {
  let mockDb: any;
  let mockAuth: any;

  beforeEach(() => {
    mockDb = createStrictMockDatabase();
    mockAuth = createMockAuth();
    setCustomAdminInstances({ db: mockDb, auth: mockAuth });

    // Mock users
    mockDb._storage['users/user-admin-1'] = {
      uid: 'user-admin-1',
      email: 'admin@vbiotech.com',
      role: 'ADMIN',
      isAdmin: true,
    };
    mockDb._storage['users/admins/user-admin-1'] = true;

    mockDb._storage['users/user-qa-1'] = {
      uid: 'user-qa-1',
      email: 'qa@vbiotech.com',
      role: 'QA',
      isAdmin: false,
    };

    mockDb._storage['users/user-guest-1'] = {
      uid: 'user-guest-1',
      email: 'guest@vbiotech.com',
      role: 'USER',
      isAdmin: false,
    };

    // Default mock model caller
    setCustomModelCaller(async () => 'OK');
  });

  const adminToken = JSON.stringify({
    uid: 'user-admin-1',
    email: 'admin@vbiotech.com',
    role: 'ADMIN',
    isAdmin: true,
    auth_time: Math.floor(Date.now() / 1000),
  });

  const qaToken = JSON.stringify({
    uid: 'user-qa-1',
    email: 'qa@vbiotech.com',
    role: 'QA',
    isAdmin: false,
    auth_time: Math.floor(Date.now() / 1000),
  });

  describe('1. Health Check Endpoint (GET /api/ai/health & GET /health)', () => {
    it('GET /health returns healthy status and component breakdown without leaking secrets', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('pqm-backend-authority');
      expect(res.body.components).toBeDefined();
      expect(res.body.components.backend).toBe('healthy');
      expect(res.body.components.aiProvider).toBeDefined();
      expect(JSON.stringify(res.body)).not.toContain('AIzaSy');
    });

    it('GET /api/ai/health returns AI service readiness and capabilities', async () => {
      const res = await request(app).get('/api/ai/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.service).toBe('pqm-ai-backend');
      expect(res.body.data.model).toBeDefined();
      expect(res.body.data.isConfigured).toBeDefined();
      expect(res.body.data.providerStatus).toBeDefined();
      expect(Array.isArray(res.body.data.supportedTypes)).toBe(true);
      expect(JSON.stringify(res.body)).not.toContain('AIzaSy');
    });
  });

  describe('2. Get AI Configuration (GET /api/ai/config)', () => {
    it('rejects unauthenticated request with 401 UNAUTHENTICATED', async () => {
      const res = await request(app).get('/api/ai/config');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects non-admin user (QA role) with 403 PERMISSION_DENIED', async () => {
      const res = await request(app)
        .get('/api/ai/config')
        .set('Authorization', `Bearer ${qaToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('allows ADMIN user to retrieve configuration and masks full API key', async () => {
      AIService.setRuntimeConfig('AIzaSyTestApiKeyForUnitTest123456');

      const res = await request(app)
        .get('/api/ai/config')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isConfigured).toBe(true);
      expect(res.body.data.maskedKey).toBe('AIzaSy...3456');
      expect(res.body.data.maskedKey).not.toBe('AIzaSyTestApiKeyForUnitTest123456');
      expect(JSON.stringify(res.body)).not.toContain('AIzaSyTestApiKeyForUnitTest123456');
    });
  });

  describe('3. Update AI Configuration (POST /api/ai/config)', () => {
    it('rejects unauthenticated request with 401 UNAUTHENTICATED', async () => {
      const res = await request(app)
        .post('/api/ai/config')
        .send({ apiKey: 'AIzaSyValidLengthKey123' });
      expect(res.status).toBe(401);
    });

    it('rejects non-admin user with 403 PERMISSION_DENIED', async () => {
      const res = await request(app)
        .post('/api/ai/config')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({ apiKey: 'AIzaSyValidLengthKey123' });
      expect(res.status).toBe(403);
    });

    it('validates apiKey length and rejects short key with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/ai/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ apiKey: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('successfully validates candidate key, updates runtime config, and returns masked key', async () => {
      const res = await request(app)
        .post('/api/ai/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          apiKey: 'AIzaSyUpdatedKeyFromFrontend987654',
          model: 'gemini-2.5-pro',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isConfigured).toBe(true);
      expect(res.body.data.maskedKey).toBe('AIzaSy...7654');
      expect(res.body.data.model).toBe('gemini-2.5-pro');
      expect(JSON.stringify(res.body)).not.toContain('AIzaSyUpdatedKeyFromFrontend987654');

      // Verify AIService state
      expect(AIService.isConfigured()).toBe(true);
      expect(AIService.getModelName()).toBe('gemini-2.5-pro');
    });
  });

  describe('4. Test Connection Endpoint (POST /api/ai/config/test)', () => {
    it('rejects non-admin user with 403 PERMISSION_DENIED', async () => {
      const res = await request(app)
        .post('/api/ai/config/test')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('allows ADMIN to test connection and returns latency metrics', async () => {
      const res = await request(app)
        .post('/api/ai/config/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ apiKey: 'AIzaSyCandidateTestKey55555' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.latencyMs).toBeTypeOf('number');
      expect(res.body.data.model).toBeDefined();
    });
  });
});
