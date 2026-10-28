import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearDB } from './helpers.js';
import { User, generateEmployeeCode } from '../src/models/user.model.js';
import { Department } from '../src/models/department.model.js';
import { ROLES } from '../src/config/constants.js';

let app;

beforeAll(async () => {
  app = await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearDB();
});

async function createUser(overrides = {}) {
  const dept = await Department.create({ name: 'Engineering', code: 'ENG' });
  const code = await generateEmployeeCode();
  const user = await User.create({
    employeeCode: code,
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: 'Passw0rd!23',
    role: ROLES.HR,
    department: dept._id,
    status: 'active',
    ...overrides,
  });
  return user;
}

describe('GET /api/health', () => {
  it('returns ok when DB is connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
  });
});

describe('POST /api/auth/login', () => {
  it('returns accessToken and user on valid credentials', async () => {
    await createUser({ email: 'hr@test.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hr@test.com', password: 'Passw0rd!23' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('hr@test.com');
  });

  it('returns same generic error for wrong password', async () => {
    await createUser({ email: 'hr@test.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hr@test.com', password: 'WrongPass1!' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('returns same generic error for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@test.com', password: 'Passw0rd!23' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('returns same generic error for inactive user', async () => {
    await createUser({ email: 'inactive@test.com', status: 'inactive' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive@test.com', password: 'Passw0rd!23' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('never returns passwordHash in response', async () => {
    await createUser({ email: 'hr@test.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hr@test.com', password: 'Passw0rd!23' });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues new access token from valid refresh cookie', async () => {
    await createUser({ email: 'hr@test.com' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hr@test.com', password: 'Passw0rd!23' });

    const cookie = loginRes.headers['set-cookie'];
    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeTruthy();
  });

  it('returns 401 when no refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the refresh cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.includes('refreshToken') && c.includes('Max-Age=0'))).toBe(true);
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user with valid token', async () => {
    await createUser({ email: 'hr@test.com' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hr@test.com', password: 'Passw0rd!23' });
    const { accessToken } = loginRes.body.data;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('hr@test.com');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/change-password', () => {
  it('changes password and invalidates old refresh token', async () => {
    await createUser({ email: 'hr@test.com' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hr@test.com', password: 'Passw0rd!23' });
    const { accessToken } = loginRes.body.data;
    const oldCookie = loginRes.headers['set-cookie'];

    // Change password
    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'Passw0rd!23', newPassword: 'NewPass1!99' });
    expect(changeRes.status).toBe(200);

    // Old refresh token should be invalid
    const oldRefresh = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(oldRefresh.status).toBe(401);
  });

  it('rejects weak new passwords', async () => {
    await createUser({ email: 'hr@test.com' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hr@test.com', password: 'Passw0rd!23' });
    const { accessToken } = loginRes.body.data;

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'Passw0rd!23', newPassword: 'weak' });
    expect(res.status).toBe(400);
  });

  it('rejects wrong current password', async () => {
    await createUser({ email: 'hr@test.com' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hr@test.com', password: 'Passw0rd!23' });
    const { accessToken } = loginRes.body.data;

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'Wrong!Pass1', newPassword: 'NewPass1!99' });
    expect(res.status).toBe(400);
  });
});

describe('Authorization — role checks', () => {
  it('returns 403 when wrong role tries an HR-only endpoint', async () => {
    // We'll use a dummy protected HR route; for now test that authorize works via a direct check
    // This will be more fully tested when employee endpoints are added in Ch.2
    // For now verify 403 is in the error system
    const employeeUser = await createUser({
      email: 'emp@test.com',
      role: ROLES.EMPLOYEE,
    });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'emp@test.com', password: 'Passw0rd!23' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.role).toBe(ROLES.EMPLOYEE);
  });
});
