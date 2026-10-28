import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearDB } from './helpers.js';
import { User, generateEmployeeCode } from '../src/models/user.model.js';
import { Department } from '../src/models/department.model.js';
import { ROLES, USER_STATUS } from '../src/config/constants.js';

let app;
let hrUser;
let managerUser;
let employeeUser;
let otherManagerUser;
let engDept;
let salesDept;

let hrToken;
let managerToken;
let employeeToken;

async function createUser(overrides = {}) {
  const code = await generateEmployeeCode();
  const user = await User.create({
    employeeCode: code,
    name: 'Test Person',
    email: `user_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
    passwordHash: 'Passw0rd!23',
    role: ROLES.EMPLOYEE,
    department: engDept._id,
    status: USER_STATUS.ACTIVE,
    ...overrides,
  });
  return user;
}

async function loginUser(email, password = 'Passw0rd!23') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.accessToken;
}

beforeAll(async () => {
  app = await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearDB();

  engDept = await Department.create({ name: 'Engineering', code: 'ENG' });
  salesDept = await Department.create({ name: 'Sales', code: 'SALES' });

  hrUser = await createUser({
    name: 'HR Alice',
    email: 'hr@test.com',
    role: ROLES.HR,
    department: engDept._id,
  });

  managerUser = await createUser({
    name: 'Manager Bob',
    email: 'manager@test.com',
    role: ROLES.MANAGER,
    department: engDept._id,
  });

  otherManagerUser = await createUser({
    name: 'Manager Carol',
    email: 'othermanager@test.com',
    role: ROLES.MANAGER,
    department: salesDept._id,
  });

  employeeUser = await createUser({
    name: 'Employee Dave',
    email: 'employee@test.com',
    role: ROLES.EMPLOYEE,
    department: engDept._id,
    manager: managerUser._id,
  });

  hrToken = await loginUser('hr@test.com');
  managerToken = await loginUser('manager@test.com');
  employeeToken = await loginUser('employee@test.com');
});

describe('Department Management', () => {
  it('allows HR to create a department', async () => {
    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ name: 'Human Resources', code: 'HR', description: 'People team' });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('HR');
  });

  it('rejects duplicate department code with 409', async () => {
    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ name: 'New Engineering', code: 'ENG' });

    expect(res.status).toBe(409);
  });

  it('blocks department deletion when employees are assigned (409)', async () => {
    const res = await request(app)
      .delete(`/api/departments/${engDept._id}`)
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Cannot delete department with active employees');
  });

  it('allows department deletion when empty', async () => {
    const emptyDept = await Department.create({ name: 'Legal', code: 'LEG' });
    const res = await request(app)
      .delete(`/api/departments/${emptyDept._id}`)
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    const exists = await Department.findById(emptyDept._id);
    expect(exists).toBeNull();
  });
});

describe('GET /api/employees', () => {
  it('allows HR to see all employees with pagination', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(4);
  });

  it('forces Manager to see ONLY their direct reports', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].email).toBe('employee@test.com');
  });

  it('prevents Manager from bypassing scoping via query param ?manager=', async () => {
    const res = await request(app)
      .get(`/api/employees?manager=${otherManagerUser._id}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    // Still scoped to Bob's direct reports, not Carol's
    expect(res.body.data.every((e) => e.manager?._id?.toString() === managerUser._id.toString())).toBe(true);
  });

  it('rejects Employee from calling GET /api/employees with 403', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });

  it('supports search query q for HR', async () => {
    const res = await request(app)
      .get('/api/employees?q=Dave')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Employee Dave');
  });
});

describe('GET /api/employees/directory', () => {
  it('allows all roles (even Employee) to view active directory', async () => {
    const res = await request(app)
      .get('/api/employees/directory')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    // Minimal fields check
    const first = res.body.data[0];
    expect(first.name).toBeTruthy();
    expect(first.employeeCode).toBeTruthy();
    expect(first.passwordHash).toBeUndefined();
  });
});

describe('GET /api/employees/team', () => {
  it('allows Manager to view direct reports', async () => {
    const res = await request(app)
      .get('/api/employees/team')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].email).toBe('employee@test.com');
  });
});

describe('POST /api/employees', () => {
  it('allows HR to create employee and returns temporary password once', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'New Hire',
        email: 'newhire@test.com',
        role: ROLES.EMPLOYEE,
        department: engDept._id.toString(),
        designation: 'Junior Developer',
        manager: managerUser._id.toString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('newhire@test.com');
    expect(res.body.data.user.employeeCode).toMatch(/^EMP-\d{4}$/);
    expect(res.body.data.user.mustChangePassword).toBe(true);
    expect(res.body.data.temporaryPassword).toBeTruthy();

    // Verify password is NOT in plain text in database
    const saved = await User.findById(res.body.data.user._id).select('+passwordHash');
    expect(saved.passwordHash).not.toBe(res.body.data.temporaryPassword);
    // But login with temporaryPassword works!
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'newhire@test.com', password: res.body.data.temporaryPassword });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.mustChangePassword).toBe(true);
  });

  it('rejects duplicate email with 409', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Duplicate',
        email: 'employee@test.com',
        role: ROLES.EMPLOYEE,
        department: engDept._id.toString(),
        designation: 'Dev',
      });

    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/employees/me (Self Profile)', () => {
  it('allows Employee to update allowed personal fields', async () => {
    const res = await request(app)
      .patch('/api/employees/me')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        phone: '123-456-7890',
        address: '123 Tech Way, Silicon Valley',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('123-456-7890');
    expect(res.body.data.address).toBe('123 Tech Way, Silicon Valley');
  });

  it('strictly rejects any attempts to update role or designation via /me with 400', async () => {
    const res = await request(app)
      .patch('/api/employees/me')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        phone: '123-456-7890',
        role: ROLES.HR, // unauthorized attempt
      });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/employees/:id/status & Deactivation Security', () => {
  it('allows HR to deactivate an employee and increments tokenVersion', async () => {
    const initialTv = employeeUser.tokenVersion;
    const res = await request(app)
      .patch(`/api/employees/${employeeUser._id}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: USER_STATUS.INACTIVE });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(USER_STATUS.INACTIVE);

    const updated = await User.findById(employeeUser._id);
    expect(updated.status).toBe(USER_STATUS.INACTIVE);
    expect(updated.tokenVersion).toBe(initialTv + 1);

    // Deactivated user cannot log in
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@test.com', password: 'Passw0rd!23' });
    expect(loginRes.status).toBe(401);
  });

  it('prevents HR from deactivating themselves (400)', async () => {
    const res = await request(app)
      .patch(`/api/employees/${hrUser._id}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: USER_STATUS.INACTIVE });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('cannot deactivate your own account');
  });

  it('prevents deactivating the last active HR administrator (400)', async () => {
    // Only 1 HR user exists right now
    const res = await request(app)
      .patch(`/api/employees/${hrUser._id}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: USER_STATUS.INACTIVE });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/employees/:id/reset-password', () => {
  it('allows HR to reset password and generates a new temporary password', async () => {
    const res = await request(app)
      .post(`/api/employees/${employeeUser._id}/reset-password`)
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.temporaryPassword).toBeTruthy();

    // Verify employee mustChangePassword is set to true and login works with new password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@test.com', password: res.body.data.temporaryPassword });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.mustChangePassword).toBe(true);
  });
});
