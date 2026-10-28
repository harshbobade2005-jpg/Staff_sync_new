import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Department } from '../src/models/department.model.js';
import { TrainingProgram } from '../src/models/trainingProgram.model.js';
import { TrainingEnrollment } from '../src/models/trainingEnrollment.model.js';
import { LeaveType } from '../src/models/leaveType.model.js';
import { LeaveBalance } from '../src/models/leaveBalance.model.js';
import { env } from '../src/config/env.js';

describe('Chapter 5: Training & Development, Dashboards & Hardening', () => {
  let mongoServer;
  let app;

  let hrUser, manager1, manager2, employee1, employee2, outsideEmployee;
  let engineeringDept;
  let casualLeaveType;

  const signToken = (user) => {
    return jwt.sign(
      { sub: user._id.toString(), role: user.role, email: user.email, tokenVersion: user.tokenVersion || 0 },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    app = createApp();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    // Create Departments
    engineeringDept = await Department.create({
      name: 'Engineering',
      code: 'ENG',
    });

    // Create Users
    hrUser = await User.create({
      name: 'HR Admin',
      email: 'hr@staffsync.test',
      passwordHash: 'dummyhash',
      role: 'hr',
      employeeCode: 'EMP001',
      status: 'active',
      department: engineeringDept._id,
    });

    manager1 = await User.create({
      name: 'Manager One',
      email: 'manager1@staffsync.test',
      passwordHash: 'dummyhash',
      role: 'manager',
      employeeCode: 'EMP002',
      status: 'active',
      department: engineeringDept._id,
    });

    manager2 = await User.create({
      name: 'Manager Two',
      email: 'manager2@staffsync.test',
      passwordHash: 'dummyhash',
      role: 'manager',
      employeeCode: 'EMP003',
      status: 'active',
      department: engineeringDept._id,
    });

    employee1 = await User.create({
      name: 'Dev Alice',
      email: 'alice@staffsync.test',
      passwordHash: 'dummyhash',
      role: 'employee',
      employeeCode: 'EMP004',
      status: 'active',
      manager: manager1._id,
      department: engineeringDept._id,
    });

    employee2 = await User.create({
      name: 'Dev Bob',
      email: 'bob@staffsync.test',
      passwordHash: 'dummyhash',
      role: 'employee',
      employeeCode: 'EMP005',
      status: 'active',
      manager: manager1._id,
      department: engineeringDept._id,
    });

    outsideEmployee = await User.create({
      name: 'Dev Charlie',
      email: 'charlie@staffsync.test',
      passwordHash: 'dummyhash',
      role: 'employee',
      employeeCode: 'EMP006',
      status: 'active',
      manager: manager2._id,
      department: engineeringDept._id,
    });

    casualLeaveType = await LeaveType.create({
      name: 'Casual Leave',
      code: 'CL',
      annualQuota: 12,
      isPaid: true,
      isActive: true,
    });

    await LeaveBalance.create({
      user: employee1._id,
      leaveType: casualLeaveType._id,
      year: new Date().getFullYear(),
      allocated: 12,
      used: 0,
      pending: 0,
    });
  });

  describe('Training Program Lifecycle & Rules', () => {
    it('allows Manager to create a program starting in draft status', async () => {
      const res = await request(app)
        .post('/api/training')
        .set('Authorization', `Bearer ${signToken(manager1)}`)
        .send({
          title: 'Advanced React 19 Workshop',
          description: 'Hands-on architectural masterclass on React 19 server actions and hooks',
          type: 'technical',
          mode: 'online',
          startDate: '2026-11-10T10:00:00.000Z',
          endDate: '2026-11-12T17:00:00.000Z',
          capacity: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.program.title).toBe('Advanced React 19 Workshop');
      expect(res.body.program.status).toBe('draft');
      expect(res.body.program.capacity).toBe(5);
    });

    it('forbids Employee from creating a training program (403)', async () => {
      const res = await request(app)
        .post('/api/training')
        .set('Authorization', `Bearer ${signToken(employee1)}`)
        .send({
          title: 'Unauthorized Course',
          description: 'Should be rejected',
          startDate: '2026-11-10T10:00:00.000Z',
          endDate: '2026-11-12T17:00:00.000Z',
        });

      expect(res.status).toBe(403);
    });

    it('allows editing only in draft and scheduled status, blocking edits once ongoing or completed', async () => {
      const program = await TrainingProgram.create({
        title: 'Initial Title',
        description: 'Initial description',
        startDate: '2026-11-10T10:00:00.000Z',
        endDate: '2026-11-12T17:00:00.000Z',
        capacity: 10,
        status: 'draft',
        createdBy: manager1._id,
      });

      // 1. Edit in draft -> succeeds
      const updateRes1 = await request(app)
        .put(`/api/training/${program._id}`)
        .set('Authorization', `Bearer ${signToken(manager1)}`)
        .send({ title: 'Updated Title' });

      expect(updateRes1.status).toBe(200);
      expect(updateRes1.body.program.title).toBe('Updated Title');

      // 2. Transition to ongoing
      program.status = 'ongoing';
      await program.save();

      // 3. Edit in ongoing -> rejected with 400
      const updateRes2 = await request(app)
        .put(`/api/training/${program._id}`)
        .set('Authorization', `Bearer ${signToken(manager1)}`)
        .send({ title: 'Another Title' });

      expect(updateRes2.status).toBe(400);
      expect(updateRes2.body.message).toMatch(/cannot edit program/i);
    });

    it('allows deleting a program ONLY in draft status with 0 enrollments', async () => {
      const draftProgram = await TrainingProgram.create({
        title: 'Draft Course',
        description: 'A course with no enrollments',
        startDate: '2026-11-10T10:00:00.000Z',
        endDate: '2026-11-12T17:00:00.000Z',
        capacity: 10,
        status: 'draft',
        createdBy: manager1._id,
      });

      // 1. Delete draft with 0 enrollments -> 200
      const delRes = await request(app)
        .delete(`/api/training/${draftProgram._id}`)
        .set('Authorization', `Bearer ${signToken(manager1)}`);

      expect(delRes.status).toBe(200);

      // 2. Create another program and enroll someone
      const enrolledProgram = await TrainingProgram.create({
        title: 'Course With Students',
        description: 'Has enrollments',
        startDate: '2026-11-10T10:00:00.000Z',
        endDate: '2026-11-12T17:00:00.000Z',
        capacity: 10,
        status: 'draft',
        createdBy: manager1._id,
      });
      await TrainingEnrollment.create({
        program: enrolledProgram._id,
        user: employee1._id,
        enrolledBy: manager1._id,
      });

      // 3. Deleting program with enrollments -> 400
      const failDel = await request(app)
        .delete(`/api/training/${enrolledProgram._id}`)
        .set('Authorization', `Bearer ${signToken(manager1)}`);

      expect(failDel.status).toBe(400);
      expect(failDel.body.message).toMatch(/cannot delete program with existing enrollments/i);
    });
  });

  describe('Enrollment Lifecycle & Boundary Constraints', () => {
    let program;

    beforeEach(async () => {
      program = await TrainingProgram.create({
        title: 'Microservices with Node.js',
        description: 'Event-driven architecture with RabbitMQ and Kafka',
        startDate: '2026-11-15T10:00:00.000Z',
        endDate: '2026-11-18T17:00:00.000Z',
        capacity: 2,
        status: 'scheduled',
        createdBy: manager1._id,
      });
    });

    it('allows Manager to enroll their direct reports', async () => {
      const res = await request(app)
        .post(`/api/training/${program._id}/enroll`)
        .set('Authorization', `Bearer ${signToken(manager1)}`)
        .send({ userIds: [employee1._id.toString()] });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
    });

    it('strictly forbids enrolling an employee who is NOT a direct report (403)', async () => {
      // outsideEmployee reports to manager2, not manager1
      const res = await request(app)
        .post(`/api/training/${program._id}/enroll`)
        .set('Authorization', `Bearer ${signToken(manager1)}`)
        .send({ userIds: [outsideEmployee._id.toString()] });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/direct reports/i);
    });

    it('enforces program capacity and returns 409 when exceeded', async () => {
      // Program capacity is 2
      // Enroll 2 direct reports (Alice & Bob)
      const res1 = await request(app)
        .post(`/api/training/${program._id}/enroll`)
        .set('Authorization', `Bearer ${signToken(manager1)}`)
        .send({ userIds: [employee1._id.toString(), employee2._id.toString()] });

      expect(res1.status).toBe(201);

      // Create a 3rd direct report for manager1
      const employee3 = await User.create({
        name: 'Dev Diana',
        email: 'diana@staffsync.test',
        passwordHash: 'dummyhash',
        role: 'employee',
        employeeCode: 'EMP007',
        status: 'active',
        manager: manager1._id,
      });

      // Try enrolling a 3rd member -> exceeds capacity (409)
      const res2 = await request(app)
        .post(`/api/training/${program._id}/enroll`)
        .set('Authorization', `Bearer ${signToken(manager1)}`)
        .send({ userIds: [employee3._id.toString()] });

      expect(res2.status).toBe(409);
      expect(res2.body.message).toMatch(/capacity exceeded/i);
    });

    it('prevents enrolling the same employee twice into the same program (409)', async () => {
      await request(app)
        .post(`/api/training/${program._id}/enroll`)
        .set('Authorization', `Bearer ${signToken(manager1)}`)
        .send({ userIds: [employee1._id.toString()] });

      const duplicateRes = await request(app)
        .post(`/api/training/${program._id}/enroll`)
        .set('Authorization', `Bearer ${signToken(manager1)}`)
        .send({ userIds: [employee1._id.toString()] });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.message).toMatch(/already enrolled/i);
    });

    it('removes enrollment if unstarted (status = enrolled), or marks dropped if already in_progress', async () => {
      // 1. Enroll Alice & Bob
      await request(app)
        .post(`/api/training/${program._id}/enroll`)
        .set('Authorization', `Bearer ${signToken(manager1)}`)
        .send({ userIds: [employee1._id.toString(), employee2._id.toString()] });

      // Alice has not started -> delete enrollment completely
      const dropAliceRes = await request(app)
        .delete(`/api/training/${program._id}/enroll/${employee1._id}`)
        .set('Authorization', `Bearer ${signToken(manager1)}`);

      expect(dropAliceRes.status).toBe(200);
      const aliceDoc = await TrainingEnrollment.findOne({ program: program._id, user: employee1._id });
      expect(aliceDoc).toBeNull();

      // Bob starts course -> status becomes in_progress
      const bobEnrollment = await TrainingEnrollment.findOne({ program: program._id, user: employee2._id });
      bobEnrollment.status = 'in_progress';
      bobEnrollment.progress = 30;
      await bobEnrollment.save();

      // Drop Bob -> marked 'dropped'
      const dropBobRes = await request(app)
        .delete(`/api/training/${program._id}/enroll/${employee2._id}`)
        .set('Authorization', `Bearer ${signToken(manager1)}`);

      expect(dropBobRes.status).toBe(200);
      const bobDocAfter = await TrainingEnrollment.findOne({ program: program._id, user: employee2._id });
      expect(bobDocAfter.status).toBe('dropped');
    });

    it('allows Employee to update their progress & feedback, and Manager to record score & complete', async () => {
      const enrollRes = await request(app)
        .post(`/api/training/${program._id}/enroll`)
        .set('Authorization', `Bearer ${signToken(manager1)}`)
        .send({ userIds: [employee1._id.toString()] });

      const enrollmentId = enrollRes.body.enrollments[0]._id;

      // 1. Employee updates progress to 50%
      const empRes = await request(app)
        .patch(`/api/training/enrollments/${enrollmentId}`)
        .set('Authorization', `Bearer ${signToken(employee1)}`)
        .send({ progress: 50, feedback: 'Great practical exercises so far!' });

      expect(empRes.status).toBe(200);
      expect(empRes.body.enrollment.progress).toBe(50);
      expect(empRes.body.enrollment.status).toBe('in_progress');
      expect(empRes.body.enrollment.feedback).toBe('Great practical exercises so far!');

      // 2. Manager records score (95) and marks complete
      const mgrRes = await request(app)
        .patch(`/api/training/enrollments/${enrollmentId}`)
        .set('Authorization', `Bearer ${signToken(manager1)}`)
        .send({ score: 95, managerNote: 'Outstanding implementation!', status: 'completed' });

      expect(mgrRes.status).toBe(200);
      expect(mgrRes.body.enrollment.score).toBe(95);
      expect(mgrRes.body.enrollment.status).toBe('completed');
      expect(mgrRes.body.enrollment.completedAt).not.toBeNull();
    });
  });

  describe('Unified Dashboard Endpoint (/api/dashboard)', () => {
    it('returns HR specific payload with employee counts, department headcount, and leave/attendance trends', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${signToken(hrUser)}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.role).toBe('hr');
      expect(res.body.data).toHaveProperty('totalEmployees');
      expect(res.body.data).toHaveProperty('activeEmployees');
      expect(res.body.data).toHaveProperty('headcountByDepartment');
      expect(res.body.data).toHaveProperty('leaveRequestsByStatus');
      expect(res.body.data).toHaveProperty('attendanceRateTrend');
      expect(res.body.data).toHaveProperty('trainingCompletionRate');
    });

    it('returns Manager specific payload with team size, team attendance, and pending approvals', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${signToken(manager1)}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.role).toBe('manager');
      expect(res.body.data).toHaveProperty('teamSize');
      expect(res.body.data.teamSize).toBe(2); // Alice & Bob
      expect(res.body.data).toHaveProperty('teamPresentToday');
      expect(res.body.data).toHaveProperty('pendingApprovals');
      expect(res.body.data).toHaveProperty('upcomingTeamTrainings');
    });

    it('returns Employee specific payload with attendance status, leave balances, and enrolled trainings', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${signToken(employee1)}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.role).toBe('employee');
      expect(res.body.data).toHaveProperty('leaveBalances');
      expect(res.body.data).toHaveProperty('myUpcomingTrainings');
      expect(res.body.data).toHaveProperty('latestAnnouncements');
    });
  });

  describe('Security, Injections & Hardening Guardrails', () => {
    it('rejects NoSQL operator injection attempt on login with 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: { $gt: '' },
          password: 'Passw0rd!23',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('enforces route permission matrix: Employee cannot hit Manager/HR endpoints', async () => {
      const employeeToken = signToken(employee1);

      // 1. Employee hitting HR-only route
      const resHr = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ name: 'Hacked Department', code: 'HACK' });
      expect(resHr.status).toBe(403);

      // 2. Employee hitting Manager-only route
      const resMgr = await request(app)
        .post('/api/training')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ title: 'Hack' });
      expect(resMgr.status).toBe(403);

      // 3. Employee hitting HR-only attendance correction route
      const resCorrect = await request(app)
        .post('/api/attendance/correct')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({});
      expect(resCorrect.status).toBe(403);
    });
  });
});
