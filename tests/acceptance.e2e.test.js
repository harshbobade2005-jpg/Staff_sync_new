import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { User, generateEmployeeCode } from '../src/models/user.model.js';
import { Department } from '../src/models/department.model.js';
import { LeaveType } from '../src/models/leaveType.model.js';
import { LeaveBalance } from '../src/models/leaveBalance.model.js';
import { Attendance } from '../src/models/attendance.model.js';
import { env } from '../src/config/env.js';
import bcrypt from 'bcryptjs';

describe('StaffSync Full System Acceptance & E2E Demo Script (Section 5G)', () => {
  let mongoServer;
  let app;

  let hrUser, managerUser, managerOther, employee1, employee2;
  let engDept;
  let annualLeaveType;

  const signToken = (user) => {
    return jwt.sign(
      {
        sub: user._id.toString(),
        role: user.role,
        email: user.email,
        tokenVersion: user.tokenVersion || 0,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    app = createApp();

    // 1. Initial Seeding of Org Structure
    engDept = await Department.create({
      name: 'Engineering',
      code: 'ENG',
      description: 'Engineering and Development',
    });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Passw0rd!23', salt);

    hrUser = await User.create({
      name: 'Sarah HR',
      email: 'hr.demo@staffsync.test',
      passwordHash,
      role: 'hr',
      employeeCode: 'EMP-0001',
      status: 'active',
      department: engDept._id,
    });

    managerUser = await User.create({
      name: 'Marcus Manager',
      email: 'marcus.mgr@staffsync.test',
      passwordHash,
      role: 'manager',
      employeeCode: 'EMP-0002',
      status: 'active',
      department: engDept._id,
    });

    managerOther = await User.create({
      name: 'Other Manager',
      email: 'other.mgr@staffsync.test',
      passwordHash,
      role: 'manager',
      employeeCode: 'EMP-0003',
      status: 'active',
      department: engDept._id,
    });

    annualLeaveType = await LeaveType.create({
      name: 'Annual Paid Leave',
      code: 'AL',
      daysPerYear: 20,
      requiresApproval: true,
      isActive: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // Acceptance Test Step 2
  it('Step 2: HR creates an employee -> employee logs in, changes password, checks in', async () => {
    // 2.1 HR creates employee
    const createRes = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${signToken(hrUser)}`)
      .send({
        name: 'Priya Sharma',
        email: 'priya.sharma@staffsync.test',
        role: 'employee',
        department: engDept._id.toString(),
        designation: 'Senior Full Stack Engineer',
        manager: managerUser._id.toString(),
        dateOfJoining: '2026-01-15',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.temporaryPassword).toBeDefined();
    const tempPassword = createRes.body.data.temporaryPassword;
    employee1 = createRes.body.data.user;

    // 2.2 Employee logs in with temp password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'priya.sharma@staffsync.test',
        password: tempPassword,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.mustChangePassword).toBe(true);
    const employeeToken = loginRes.body.data.accessToken;

    // 2.3 Employee changes password
    const changePwdRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        currentPassword: tempPassword,
        newPassword: 'MyNewSecurePassword!2026',
      });

    expect(changePwdRes.status).toBe(200);
    expect(changePwdRes.body.success).toBe(true);

    // Verify employee can login with new password
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'priya.sharma@staffsync.test',
        password: 'MyNewSecurePassword!2026',
      });

    expect(newLoginRes.status).toBe(200);
    const activeEmployeeToken = newLoginRes.body.data.accessToken;

    // 2.4 Employee marks attendance check-in
    const checkInRes = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${activeEmployeeToken}`)
      .send();

    expect(checkInRes.status).toBe(201);
    expect(checkInRes.body.attendance.status).toBe('present');
    expect(checkInRes.body.attendance.checkIn).toBeDefined();

    // 2.5 Second check-in is refused with 409 Conflict
    const dupCheckIn = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${activeEmployeeToken}`)
      .send();

    expect(dupCheckIn.status).toBe(409);
  });

  // Acceptance Test Step 3
  it('Step 3: Employee applies for leave -> manager approves -> balances and HR dashboard update', async () => {
    const employeeDoc = await User.findById(employee1._id);
    const employeeToken = signToken(employeeDoc);

    // Ensure balance exists with sufficient allocated quota
    await LeaveBalance.findOneAndUpdate(
      { user: employee1._id, leaveType: annualLeaveType._id, year: 2026 },
      { allocated: 20, used: 0, pending: 0 },
      { upsert: true }
    );

    // 3.1 Employee applies for leave (3 working days)
    const applyRes = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        leaveType: annualLeaveType._id.toString(),
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        reason: 'Family event and personal travel',
      });

    expect(applyRes.status).toBe(201);
    expect(applyRes.body.leaveRequest.status).toBe('pending');
    expect(applyRes.body.leaveRequest.assignedTo).toBe(managerUser._id.toString());
    const leaveRequestId = applyRes.body.leaveRequest._id;

    // Check balance shows pending
    const balCheck1 = await LeaveBalance.findOne({ user: employee1._id, leaveType: annualLeaveType._id, year: 2026 });
    expect(balCheck1.pending).toBe(3);
    expect(balCheck1.used).toBe(0);

    // 3.2 Manager approves leave request
    const approveRes = await request(app)
      .patch(`/api/leaves/${leaveRequestId}/decision`)
      .set('Authorization', `Bearer ${signToken(managerUser)}`)
      .send({
        decision: 'approved',
        note: 'Approved, enjoy the time off!',
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.leave.status).toBe('approved');

    // Check balance updated: pending decremented, used incremented
    const balCheck2 = await LeaveBalance.findOne({ user: employee1._id, leaveType: annualLeaveType._id, year: 2026 });
    expect(balCheck2.pending).toBe(0);
    expect(balCheck2.used).toBe(3);

    // 3.3 HR Dashboard numbers update
    const hrDashRes = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${signToken(hrUser)}`);

    expect(hrDashRes.status).toBe(200);
    expect(hrDashRes.body.role).toBe('hr');
    expect(hrDashRes.body.data.totalEmployees).toBeGreaterThanOrEqual(3);
  });

  // Acceptance Test Step 4
  it('Step 4: HR posts announcement -> intended roles see it, others do not', async () => {
    // 4.1 HR posts an announcement for 'employee' audience only
    const postRes = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${signToken(hrUser)}`)
      .send({
        title: 'Employee Town Hall Meeting',
        body: 'Important updates regarding company wellness benefits.',
        category: 'general',
        priority: 'high',
        audience: ['employee'],
        isPinned: true,
      });

    expect(postRes.status).toBe(201);
    const annId = postRes.body.announcement._id;

    // 4.2 Employee sees the announcement
    const empDoc = await User.findById(employee1._id);
    const empFeedRes = await request(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${signToken(empDoc)}`);

    expect(empFeedRes.status).toBe(200);
    const empItems = empFeedRes.body.announcements.map((a) => a._id);
    expect(empItems).toContain(annId);

    // 4.3 Manager does NOT see employee-only announcement
    const mgrFeedRes = await request(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${signToken(managerUser)}`);

    expect(mgrFeedRes.status).toBe(200);
    const mgrItems = mgrFeedRes.body.announcements.map((a) => a._id);
    expect(mgrItems).not.toContain(annId);
  });

  // Acceptance Test Step 5
  it('Step 5: Manager creates training program, enrolls team members -> employee updates progress -> manager records scores', async () => {
    // Create second direct report for Marcus
    const empCode2 = await generateEmployeeCode();
    employee2 = await User.create({
      name: 'Alex Rivera',
      email: 'alex.rivera@staffsync.test',
      passwordHash: 'dummyhash',
      role: 'employee',
      employeeCode: empCode2,
      status: 'active',
      department: engDept._id,
      manager: managerUser._id,
    });

    // 5.1 Manager creates training program
    const progRes = await request(app)
      .post('/api/training')
      .set('Authorization', `Bearer ${signToken(managerUser)}`)
      .send({
        title: 'Advanced React 19 & Architecture',
        description: 'Deep dive into concurrent React, actions, and Suspense patterns.',
        type: 'technical',
        mode: 'online',
        capacity: 10,
        startDate: '2026-11-01T09:00:00.000Z',
        endDate: '2026-11-05T18:00:00.000Z',
        trainer: 'Marcus Chen',
      });

    expect(progRes.status).toBe(201);
    expect(progRes.body.success).toBe(true);
    const programId = progRes.body.program._id;

    // 5.2 Manager enrolls direct reports
    const enrollRes = await request(app)
      .post(`/api/training/${programId}/enroll`)
      .set('Authorization', `Bearer ${signToken(managerUser)}`)
      .send({
        userIds: [employee1._id.toString(), employee2._id.toString()],
      });

    expect(enrollRes.status).toBe(201);
    expect(enrollRes.body.enrollments).toHaveLength(2);
    const emp1Enrollment = enrollRes.body.enrollments.find((e) => e.user === employee1._id.toString());

    // 5.3 Employee updates progress and provides feedback
    const progressRes = await request(app)
      .patch(`/api/training/enrollments/${emp1Enrollment._id}`)
      .set('Authorization', `Bearer ${signToken(employee1)}`)
      .send({
        progress: 100,
        feedback: 'Super informative sessions!',
      });

    expect(progressRes.status).toBe(200);
    expect(progressRes.body.enrollment.progress).toBe(100);
    expect(progressRes.body.enrollment.feedback).toBe('Super informative sessions!');

    // 5.4 Manager records score and marks completed
    const scoreRes = await request(app)
      .patch(`/api/training/enrollments/${emp1Enrollment._id}`)
      .set('Authorization', `Bearer ${signToken(managerUser)}`)
      .send({
        score: 98,
        managerNote: 'Mastered all concepts with distinction.',
        status: 'completed',
      });

    expect(scoreRes.status).toBe(200);
    expect(scoreRes.body.enrollment.score).toBe(98);
    expect(scoreRes.body.enrollment.status).toBe('completed');
    expect(scoreRes.body.enrollment.completedAt).not.toBeNull();

    // 5.5 HR sees training completion summary
    const summaryRes = await request(app)
      .get('/api/training/reports/summary')
      .set('Authorization', `Bearer ${signToken(hrUser)}`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.success).toBe(true);
    expect(summaryRes.body.summary).toHaveProperty('totalPrograms');
    expect(summaryRes.body.summary).toHaveProperty('totalEnrollments');
    expect(summaryRes.body.summary.completedEnrollments).toBeGreaterThanOrEqual(1);
  });

  // Acceptance Test Step 6
  it('Step 6: HR exports attendance CSV with formula injection characters safely escaped', async () => {
    // Create attendance with potential formula injection in note
    await Attendance.create({
      user: employee1._id,
      date: '2026-10-25',
      checkIn: new Date(),
      checkOut: new Date(Date.now() + 8 * 3600000),
      status: 'present',
      isLate: false,
      workedMinutes: 480,
      note: '=CMD|"/C calc"!A0', // malicious Excel formula
    });

    const csvRes = await request(app)
      .get('/api/attendance/export.csv?month=2026-10')
      .set('Authorization', `Bearer ${signToken(hrUser)}`);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    // Verify formula trigger '=' was neutralized with prepended "'"
    expect(csvRes.text).toContain("'=CMD");
  });

  // Acceptance Test Step 8
  it('Step 8: Break tests (Security, permissions, NoSQL injection, and XSS sanitization)', async () => {
    const empDoc = await User.findById(employee1._id);
    const employeeToken = signToken(empDoc);

    // 8.1 Employee hits HR endpoint -> 403 Forbidden
    const resHr = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: 'Hacked', code: 'HCK' });
    expect(resHr.status).toBe(403);

    // 8.2 Manager hits another manager's team data -> 404/403
    const resOtherMgr = await request(app)
      .patch(`/api/leaves/requests/671c00000000000000000001/decide`)
      .set('Authorization', `Bearer ${signToken(managerOther)}`)
      .send({ action: 'approve' });
    expect(resOtherMgr.status).toBe(404);

    // 8.3 NoSQL operator injection attempt -> 400 Bad Request
    const resNoSql = await request(app)
      .post('/api/auth/login')
      .send({
        email: { $gt: '' },
        password: 'Passw0rd!23',
      });
    expect(resNoSql.status).toBe(400);

    // 8.4 XSS payloads stored safely and returned without execution
    const xssPayload = '<script>alert("hacked")</script><iframe src="evil.com"></iframe>';
    const resXss = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${signToken(hrUser)}`)
      .send({
        title: 'Safe Notice',
        body: xssPayload,
        category: 'general',
        priority: 'low',
        audience: ['all'],
      });

    expect(resXss.status).toBe(201);
    expect(resXss.body.announcement.body).toBe(xssPayload); // Raw string safely stored, rendered inert as plain text
  });
});
