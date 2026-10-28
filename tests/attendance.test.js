import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { setupTestDB, teardownTestDB, clearDB } from './helpers.js';
import { User, generateEmployeeCode } from '../src/models/user.model.js';
import { Department } from '../src/models/department.model.js';
import { Attendance } from '../src/models/attendance.model.js';
import { Announcement } from '../src/models/announcement.model.js';
import { LeaveType } from '../src/models/leaveType.model.js';
import { LeaveRequest } from '../src/models/leaveRequest.model.js';
import { Holiday } from '../src/models/holiday.model.js';
import { ROLES, ATTENDANCE_STATUS, LEAVE_STATUS } from '../src/config/constants.js';
import { env } from '../src/config/env.js';
import {
  getLocalDateKey,
  getLocalTime,
  isCheckInLate,
} from '../src/services/attendance.service.js';

let app;

function signToken(user) {
  return jwt.sign(
    { sub: user._id, role: user.role, tv: user.tokenVersion || 0 },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

beforeAll(async () => {
  app = await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

describe('Chapter 4: Attendance & Announcements', () => {
  let hrToken, hrUser;
  let managerToken, managerUser;
  let emp1Token, emp1User;
  let emp2Token, emp2User;
  let testDept;
  let casualLeaveType;

  beforeEach(async () => {
    await clearDB();

    testDept = await Department.create({
      name: 'Engineering',
      code: 'ENG',
      description: 'Eng Dept',
    });

    casualLeaveType = await LeaveType.create({
      name: 'Casual Leave',
      code: 'CASUAL',
      annualQuota: 12,
    });

    const pwd = 'Password123!';

    hrUser = await User.create({
      employeeCode: await generateEmployeeCode(),
      name: 'Alice HR',
      email: 'alice.hr@example.com',
      passwordHash: pwd,
      role: ROLES.HR,
      department: testDept._id,
      designation: 'HR Lead',
      status: 'active',
      mustChangePassword: false,
    });

    managerUser = await User.create({
      employeeCode: await generateEmployeeCode(),
      name: 'Carol Manager',
      email: 'carol.mgr@example.com',
      passwordHash: pwd,
      role: ROLES.MANAGER,
      department: testDept._id,
      designation: 'Eng Manager',
      status: 'active',
      mustChangePassword: false,
    });

    emp1User = await User.create({
      employeeCode: await generateEmployeeCode(),
      name: 'Dave Employee',
      email: 'dave.emp@example.com',
      passwordHash: pwd,
      role: ROLES.EMPLOYEE,
      department: testDept._id,
      designation: 'Software Eng',
      manager: managerUser._id,
      status: 'active',
      mustChangePassword: false,
    });

    emp2User = await User.create({
      employeeCode: await generateEmployeeCode(),
      name: 'Eve Employee',
      email: 'eve.emp@example.com',
      passwordHash: pwd,
      role: ROLES.EMPLOYEE,
      department: testDept._id,
      designation: 'QA Eng',
      manager: managerUser._id,
      status: 'active',
      mustChangePassword: false,
    });

    hrToken = signToken(hrUser);
    managerToken = signToken(managerUser);
    emp1Token = signToken(emp1User);
    emp2Token = signToken(emp2User);
  });

  describe('Attendance State Machine & Check-In / Check-Out', () => {
    it('allows check-in and prevents second check-in on the same day (409)', async () => {
      // First check-in
      const res1 = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res1.status).toBe(201);
      expect(res1.body.attendance.status).toBe(ATTENDANCE_STATUS.PRESENT);
      expect(res1.body.attendance.checkIn).toBeDefined();
      expect(res1.body.attendance.checkOut).toBeNull();

      // Second check-in on same day -> 409
      const res2 = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res2.status).toBe(409);
      expect(res2.body.message).toMatch(/already checked in/i);
    });

    it('allows check-out and computes worked minutes; second check-out returns 409', async () => {
      // Check in
      await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${emp1Token}`);

      // Check out
      const res1 = await request(app)
        .post('/api/attendance/check-out')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res1.status).toBe(200);
      expect(res1.body.attendance.checkOut).toBeDefined();
      expect(res1.body.attendance.workedMinutes).toBeGreaterThanOrEqual(0);

      // Second check-out -> 409
      const res2 = await request(app)
        .post('/api/attendance/check-out')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res2.status).toBe(409);
      expect(res2.body.message).toMatch(/already checked out/i);
    });

    it('rejects check-out if user has not checked in (400)', async () => {
      const res = await request(app)
        .post('/api/attendance/check-out')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no active check-in/i);
    });

    it('blocks check-in when user is on approved full-day leave today (409)', async () => {
      const todayKey = getLocalDateKey(new Date());

      // Create an approved leave for emp1 today
      await LeaveRequest.create({
        user: emp1User._id,
        leaveType: casualLeaveType._id,
        startDate: todayKey,
        endDate: todayKey,
        days: 1,
        halfDay: false,
        reason: 'Doctor appointment day off',
        status: LEAVE_STATUS.APPROVED,
        approverRole: 'manager',
      });

      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/on approved leave/i);
    });

    it('returns today attendance status driving UI button states', async () => {
      const res1 = await request(app)
        .get('/api/attendance/today')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res1.status).toBe(200);
      expect(res1.body.canCheckIn).toBe(true);
      expect(res1.body.canCheckOut).toBe(false);

      // Check in
      await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${emp1Token}`);

      const res2 = await request(app)
        .get('/api/attendance/today')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res2.status).toBe(200);
      expect(res2.body.canCheckIn).toBe(false);
      expect(res2.body.canCheckOut).toBe(true);
    });
  });

  describe('Business Rules: Late Detection & Timezone Correctness', () => {
    it('correctly calculates late threshold based on company timezone and grace minutes', () => {
      // 09:30 + 15m grace = 09:45 threshold
      const onTime = new Date('2026-10-26T09:40:00+05:30');
      const late = new Date('2026-10-26T09:46:00+05:30');

      expect(isCheckInLate(onTime, 'Asia/Kolkata')).toBe(false);
      expect(isCheckInLate(late, 'Asia/Kolkata')).toBe(true);
    });

    it('verifies timezone rollover: 23:30 UTC belongs to the next calendar date in Asia/Kolkata', () => {
      // 2026-05-10 at 23:30 UTC is 2026-05-11 at 05:00 in Asia/Kolkata (+05:30)
      const dateUtc = new Date('2026-05-10T23:30:00Z');
      const kolkataDateKey = getLocalDateKey(dateUtc, 'Asia/Kolkata');

      expect(kolkataDateKey).toBe('2026-05-11');
    });

    it('flags check-in on a holiday or weekend with note: non-working day', async () => {
      const todayKey = getLocalDateKey(new Date());

      // Mark today as a Holiday
      await Holiday.create({
        name: 'Company Special Day',
        date: todayKey,
      });

      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.attendance.note).toMatch(/non-working day/i);
    });
  });

  describe('Manager & HR Scoping', () => {
    it('allows Manager to view team attendance and prevents Employee from calling it (403)', async () => {
      const todayKey = getLocalDateKey(new Date());

      // emp1 checks in
      await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${emp1Token}`);

      // Manager checks team
      const mgrRes = await request(app)
        .get(`/api/attendance/team?date=${todayKey}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(mgrRes.status).toBe(200);
      expect(mgrRes.body.team).toHaveLength(2); // Dave and Eve

      const dave = mgrRes.body.team.find((m) => m.user.name === 'Dave Employee');
      expect(dave.status).toBe(ATTENDANCE_STATUS.PRESENT);

      const eve = mgrRes.body.team.find((m) => m.user.name === 'Eve Employee');
      expect(eve.status).toBe('not-checked-in');

      // Regular employee cannot view team attendance
      const empRes = await request(app)
        .get(`/api/attendance/team?date=${todayKey}`)
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(empRes.status).toBe(403);
    });

    it('allows HR to correct attendance with reason, preserving audit history', async () => {
      const todayKey = getLocalDateKey(new Date());

      // Employee checks in
      const checkInRes = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${emp1Token}`);

      const recordId = checkInRes.body.attendance._id;

      // HR corrects checkout and status
      const correctionTime = new Date('2026-10-26T18:00:00+05:30');
      const correctRes = await request(app)
        .put(`/api/attendance/${recordId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          checkOut: correctionTime.toISOString(),
          status: ATTENDANCE_STATUS.PRESENT,
          correctionReason: 'Employee forgot to check out before leaving office',
        });

      expect(correctRes.status).toBe(200);
      expect(correctRes.body.attendance.correctionReason).toBe('Employee forgot to check out before leaving office');
      expect(correctRes.body.attendance.history).toHaveLength(1);
      expect(correctRes.body.attendance.history[0].correctionReason).toBe('Employee forgot to check out before leaving office');

      // Employee cannot correct attendance
      const empCorrectionRes = await request(app)
        .put(`/api/attendance/${recordId}`)
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({ correctionReason: 'Attempting self correction' });

      expect(empCorrectionRes.status).toBe(403);
    });

    it('allows HR to export attendance CSV with formula-injection characters safely escaped', async () => {
      // Seed a record with formula injection payload in user/note
      const dateKey = '2026-11-05';
      await Attendance.create({
        user: emp1User._id,
        date: dateKey,
        checkIn: new Date(),
        checkOut: new Date(),
        workedMinutes: 480,
        status: ATTENDANCE_STATUS.PRESENT,
        note: '=1+1', // formula injection payload
      });

      const res = await request(app)
        .get('/api/attendance/export.csv?month=2026-11')
        .set('Authorization', `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain("'=1+1"); // escaped with leading single quote!
    });
  });

  describe('Announcements & Audience Filtering', () => {
    it('delivers announcements matching user audience and filters out unassigned roles', async () => {
      // 1. All audience announcement
      await Announcement.create({
        title: 'Company Townhall Announcement',
        body: 'All staff meeting this Friday at 4 PM.',
        audience: ['all'],
        createdBy: hrUser._id,
      });

      // 2. Employee only announcement
      await Announcement.create({
        title: 'Employee Feedback Survey',
        body: 'Please complete the confidential employee pulse survey.',
        audience: [ROLES.EMPLOYEE],
        createdBy: hrUser._id,
      });

      // 3. Manager only announcement
      await Announcement.create({
        title: 'Q4 Budget Planning Meeting',
        body: 'Management review of departmental allocations.',
        audience: [ROLES.MANAGER],
        createdBy: hrUser._id,
      });

      // Employee views announcements: should see All + Employee, but NOT Manager!
      const empRes = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(empRes.status).toBe(200);
      const empTitles = empRes.body.announcements.map((a) => a.title);
      expect(empTitles).toContain('Company Townhall Announcement');
      expect(empTitles).toContain('Employee Feedback Survey');
      expect(empTitles).not.toContain('Q4 Budget Planning Meeting');

      // Manager views announcements: should see All + Manager, but NOT Employee!
      const mgrRes = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(mgrRes.status).toBe(200);
      const mgrTitles = mgrRes.body.announcements.map((a) => a.title);
      expect(mgrTitles).toContain('Company Townhall Announcement');
      expect(mgrTitles).toContain('Q4 Budget Planning Meeting');
      expect(mgrTitles).not.toContain('Employee Feedback Survey');
    });

    it('hides scheduled future announcements from public feed, but HR sees them in manage view', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow

      await Announcement.create({
        title: 'Future Scheduled Policy Launch',
        body: 'New travel policy effective next month.',
        audience: ['all'],
        publishAt: futureDate,
        createdBy: hrUser._id,
      });

      // Employee cannot see scheduled announcement
      const empRes = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${emp1Token}`);

      const empTitles = empRes.body.announcements.map((a) => a.title);
      expect(empTitles).not.toContain('Future Scheduled Policy Launch');

      // HR manages announcements and sees it with state 'scheduled'
      const hrRes = await request(app)
        .get('/api/announcements/manage')
        .set('Authorization', `Bearer ${hrToken}`);

      expect(hrRes.status).toBe(200);
      const scheduled = hrRes.body.announcements.find((a) => a.title === 'Future Scheduled Policy Launch');
      expect(scheduled).toBeDefined();
      expect(scheduled.state).toBe('scheduled');
    });

    it('prioritizes pinned announcements at top of results', async () => {
      await Announcement.create({
        title: 'Regular Notice',
        body: 'Normal bulletin text.',
        isPinned: false,
        createdBy: hrUser._id,
      });

      await Announcement.create({
        title: 'CRITICAL PINNED ALERT',
        body: 'Important security advisory for all personnel.',
        isPinned: true,
        createdBy: hrUser._id,
      });

      const res = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.announcements[0].title).toBe('CRITICAL PINNED ALERT');
    });

    it('stores XSS payload safely as harmless plain text', async () => {
      const xssPayload = '<script>alert("XSS")</script>';

      const createRes = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          title: 'Safe Notice',
          body: xssPayload,
          audience: ['all'],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.announcement.body).toBe(xssPayload); // stored as string text
    });
  });
});
