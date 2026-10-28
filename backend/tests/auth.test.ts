/**
 * backend/tests/auth.test.ts
 * Unit tests for Authentication & Authorization Middlewares
 */

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authenticateToken, requireRoles, requireFreshSession } from '../src/middleware/auth';
import { setCustomAdminInstances } from '../src/config/firebaseAdmin';
import { createStrictMockDatabase, createMockAuth } from './mockDb';

describe('Auth Middleware Units', () => {
  function createTestApp() {
    const testApp = express();
    testApp.use(express.json());

    testApp.get('/test/protected', authenticateToken, (req, res) => {
      res.json({ success: true, user: req.user });
    });

    testApp.get('/test/qa-only', authenticateToken, requireRoles(['QA', 'ADMIN']), (req, res) => {
      res.json({ success: true, user: req.user });
    });

    testApp.get('/test/fresh-only', authenticateToken, requireFreshSession(300), (req, res) => {
      res.json({ success: true, user: req.user });
    });

    return testApp;
  }

  it('should reject missing Authorization header with 401', async () => {
    const mockDb = createStrictMockDatabase();
    const mockAuth = createMockAuth();
    setCustomAdminInstances({ db: mockDb, auth: mockAuth });

    const app = createTestApp();
    const res = await request(app).get('/test/protected');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('should reject non-Bearer authorization header with 401', async () => {
    const mockDb = createStrictMockDatabase();
    const mockAuth = createMockAuth();
    setCustomAdminInstances({ db: mockDb, auth: mockAuth });

    const app = createTestApp();
    const res = await request(app).get('/test/protected').set('Authorization', 'Basic 123456');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('should enforce requireRoles denying unauthorized roles with 403', async () => {
    const mockDb = createStrictMockDatabase();
    const mockAuth = createMockAuth();
    setCustomAdminInstances({ db: mockDb, auth: mockAuth });

    mockDb._storage['users/u-prod-1'] = {
      uid: 'u-prod-1',
      email: 'prod@vbiotech.com',
      role: 'PRODUCTION',
    };

    const token = JSON.stringify({
      uid: 'u-prod-1',
      email: 'prod@vbiotech.com',
      role: 'PRODUCTION',
      auth_time: Math.floor(Date.now() / 1000) - 20,
    });

    const app = createTestApp();
    const res = await request(app).get('/test/qa-only').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('should allow admin through requireRoles even if not in explicit list', async () => {
    const mockDb = createStrictMockDatabase();
    const mockAuth = createMockAuth();
    setCustomAdminInstances({ db: mockDb, auth: mockAuth });

    mockDb._storage['users/u-admin-1'] = {
      uid: 'u-admin-1',
      email: 'admin@vbiotech.com',
      role: 'ADMIN',
    };
    mockDb._storage['users/admins/u-admin-1'] = true;

    const token = JSON.stringify({
      uid: 'u-admin-1',
      email: 'admin@vbiotech.com',
      auth_time: Math.floor(Date.now() / 1000) - 20,
    });

    const app = createTestApp();
    const res = await request(app).get('/test/qa-only').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
  });
});
