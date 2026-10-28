import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { setupTestDB, teardownTestDB, clearDB } from './helpers.js';
import { User, generateEmployeeCode } from '../src/models/user.model.js';
import { Department } from '../src/models/department.model.js';
import { LeaveType } from '../src/models/leaveType.model.js';
import { Holiday } from '../src/models/holiday.model.js';
import { LeaveBalance } from '../src/models/leaveBalance.model.js';
import { LeaveRequest } from '../src/models/leaveRequest.model.js';
import { ROLES, LEAVE_STATUS, APPROVER_ROLE } from '../src/config/constants.js';
import { env } from '../src/config/env.js';

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

describe('Chapter 3: Leave Management', () => {
  let hrToken, hrUser;
  let hr2Token, hr2User;
  let managerToken, managerUser;
  let manager2Token, manager2User;
  let emp1Token, emp1User;
  let empNoMgrToken, empNoMgrUser;
  let casualLeaveType, sickLeaveType;
  let testDept;

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
      isPaid: true,
      isUnlimited: false,
      isActive: true,
    });

    sickLeaveType = await LeaveType.create({
      name: 'Sick Leave',
      code: 'SICK',
      annualQuota: 10,
      isPaid: true,
      isUnlimited: false,
      isActive: true,
    });

    // Seed Users
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

    hr2User = await User.create({
      employeeCode: await generateEmployeeCode(),
      name: 'Bob HR',
      email: 'bob.hr@example.com',
      passwordHash: pwd,
      role: ROLES.HR,
      department: testDept._id,
      designation: 'HR Specialist',
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

    manager2User = await User.create({
      employeeCode: await generateEmployeeCode(),
      name: 'Dave Manager',
      email: 'dave.mgr@example.com',
      passwordHash: pwd,
      role: ROLES.MANAGER,
      department: testDept._id,
      designation: 'QA Manager',
      status: 'active',
      mustChangePassword: false,
    });

    emp1User = await User.create({
      employeeCode: await generateEmployeeCode(),
      name: 'Eve Employee',
      email: 'eve.emp@example.com',
      passwordHash: pwd,
      role: ROLES.EMPLOYEE,
      department: testDept._id,
      designation: 'Software Eng',
      manager: managerUser._id,
      status: 'active',
      mustChangePassword: false,
    });

    empNoMgrUser = await User.create({
      employeeCode: await generateEmployeeCode(),
      name: 'Frank Lone Employee',
      email: 'frank.emp@example.com',
      passwordHash: pwd,
      role: ROLES.EMPLOYEE,
      department: testDept._id,
      designation: 'Independent Contributor',
      manager: null,
      status: 'active',
      mustChangePassword: false,
    });

    // Sign tokens directly for fast and isolated test execution
    hrToken = signToken(hrUser);
    hr2Token = signToken(hr2User);
    managerToken = signToken(managerUser);
    manager2Token = signToken(manager2User);
    emp1Token = signToken(emp1User);
    empNoMgrToken = signToken(empNoMgrUser);
  });

  describe('Working-Day Calculation & Preview', () => {
    it('accurately computes working days, excluding weekends and holidays', async () => {
      // Create a holiday on Monday 2026-11-09
      await Holiday.create({
        name: 'Mid-November Day',
        date: '2026-11-09',
      });

      // 2026-11-06 is Friday, 11-07 is Sat, 11-08 is Sun, 11-09 is Mon (holiday), 11-10 is Tue
      const res = await request(app)
        .get('/api/leaves/preview?startDate=2026-11-06&endDate=2026-11-10')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.days).toBe(2); // Friday and Tuesday
      expect(res.body.weekendsInRange).toBe(2);
      expect(res.body.holidaysInRange).toBe(1);
    });

    it('supports 0.5 days for halfDay only when startDate === endDate', async () => {
      // 2026-11-11 is Wednesday
      const res = await request(app)
        .get('/api/leaves/preview?startDate=2026-11-11&endDate=2026-11-11&halfDay=true')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.days).toBe(0.5);

      // Attempting halfDay over multiple days should fail
      const badRes = await request(app)
        .get('/api/leaves/preview?startDate=2026-11-11&endDate=2026-11-12&halfDay=true')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(badRes.status).toBe(400);
    });

    it('rejects dates containing 0 working days (e.g. weekend only)', async () => {
      // 2026-11-07 (Saturday) to 2026-11-08 (Sunday)
      const res = await request(app)
        .get('/api/leaves/preview?startDate=2026-11-07&endDate=2026-11-08')
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no working days/i);
    });
  });

  describe('Leave Type & Holiday Management', () => {
    it('allows HR to create a holiday and blocks duplicate dates with 409', async () => {
      const res1 = await request(app)
        .post('/api/holidays')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ name: 'Founders Day', date: '2026-11-15' });

      expect(res1.status).toBe(201);
      expect(res1.body.holiday.name).toBe('Founders Day');

      const res2 = await request(app)
        .post('/api/holidays')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ name: 'Another Holiday', date: '2026-11-15' });

      expect(res2.status).toBe(409);
    });

    it('blocks deleting a leave type that has existing leave requests (409)', async () => {
      // Create a leave request using casualLeaveType on future date
      const applyRes = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-11-12',
          endDate: '2026-11-13',
          reason: 'Family event vacation',
        });

      expect(applyRes.status).toBe(201);

      // Try to delete casualLeaveType
      const delRes = await request(app)
        .delete(`/api/leave-types/${casualLeaveType._id}`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(delRes.status).toBe(409);
      expect(delRes.body.message).toMatch(/associated requests/i);
    });
  });

  describe('Leave Application & Routing', () => {
    it('routes an employee with a manager to their manager', async () => {
      const res = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-11-16',
          endDate: '2026-11-18',
          reason: 'Short vacation break',
        });

      expect(res.status).toBe(201);
      expect(res.body.leaveRequest.approverRole).toBe(APPROVER_ROLE.MANAGER);
      expect(res.body.leaveRequest.assignedTo).toBe(managerUser._id.toString());
      expect(res.body.leaveRequest.status).toBe(LEAVE_STATUS.PENDING);
      expect(res.body.leaveRequest.days).toBe(3);

      // Check balance has pending increased
      const bal = await LeaveBalance.findOne({
        user: emp1User._id,
        leaveType: casualLeaveType._id,
        year: 2026,
      });
      expect(bal.pending).toBe(3);
      expect(bal.used).toBe(0);
    });

    it('routes an employee WITHOUT a manager to the HR pool (assignedTo = null)', async () => {
      const res = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${empNoMgrToken}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-11-16',
          endDate: '2026-11-17',
          reason: 'Personal leave time',
        });

      expect(res.status).toBe(201);
      expect(res.body.leaveRequest.approverRole).toBe(APPROVER_ROLE.HR);
      expect(res.body.leaveRequest.assignedTo).toBeNull();
    });

    it('routes a Manager requester to the HR pool (assignedTo = null)', async () => {
      const res = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-11-16',
          endDate: '2026-11-17',
          reason: 'Manager offsite rest',
        });

      expect(res.status).toBe(201);
      expect(res.body.leaveRequest.approverRole).toBe(APPROVER_ROLE.HR);
      expect(res.body.leaveRequest.assignedTo).toBeNull();
    });

    it('routes an HR requester to the HR pool (assignedTo = null)', async () => {
      const res = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-11-16',
          endDate: '2026-11-17',
          reason: 'HR annual leave break',
        });

      expect(res.status).toBe(201);
      expect(res.body.leaveRequest.approverRole).toBe(APPROVER_ROLE.HR);
      expect(res.body.leaveRequest.assignedTo).toBeNull();
    });
  });

  describe('Validation & Overlap Guards', () => {
    it('blocks overlapping leave applications for the same user (400)', async () => {
      const firstRes = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-11-23',
          endDate: '2026-11-27',
          reason: 'First booking period',
        });
      expect(firstRes.status).toBe(201);

      // Overlapping request: starts within the first range
      const overlapRes = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-11-25',
          endDate: '2026-11-30',
          reason: 'Second overlapping booking',
        });

      expect(overlapRes.status).toBe(400);
      expect(overlapRes.body.message).toMatch(/overlapping/i);
    });

    it('allows adjacent non-overlapping leave requests', async () => {
      // First: Mon-Tue
      const res1 = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-11-23',
          endDate: '2026-11-24',
          reason: 'First adjacent leave',
        });
      expect(res1.status).toBe(201);

      // Second: Wed-Thu (immediately adjacent, not overlapping)
      const res2 = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-11-25',
          endDate: '2026-11-26',
          reason: 'Second adjacent leave',
        });
      expect(res2.status).toBe(201);
    });

    it('rejects requests exceeding available leave balance (400)', async () => {
      // Casual quota is 12. Requesting 15 working days (Nov 2 to Nov 20) should fail.
      const res = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-11-02',
          endDate: '2026-11-20', // 15 working days
          reason: 'Attempting to take 15 casual days',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Insufficient leave balance/i);
    });

    it('rejects leave requests spanning across calendar years (400)', async () => {
      const res = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-12-30',
          endDate: '2027-01-04',
          reason: 'New year holiday span',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot span across calendar years/i);
    });
  });

  describe('Decision, Approvals & Concurrency', () => {
    it('prevents double-approval races: concurrent approvals allow only one to succeed', async () => {
      const applyRes = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-12-01',
          endDate: '2026-12-02',
          reason: 'Race condition test leave',
        });

      expect(applyRes.status).toBe(201);
      const requestId = applyRes.body.leaveRequest._id;

      // Two simultaneous approvals
      const [call1, call2] = await Promise.all([
        request(app)
          .patch(`/api/leaves/${requestId}/decision`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ decision: 'approved' }),
        request(app)
          .patch(`/api/leaves/${requestId}/decision`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ decision: 'approved' }),
      ]);

      const statuses = [call1.status, call2.status].sort();
      expect(statuses).toEqual([200, 409]);
    });

    it('forbids self-approval: HR cannot approve their own leave request (403)', async () => {
      const applyRes = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-12-03',
          endDate: '2026-12-04',
          reason: 'HR self-approval test',
        });

      expect(applyRes.status).toBe(201);
      const requestId = applyRes.body.leaveRequest._id;

      // Alice HR tries to approve her own request
      const selfApproveRes = await request(app)
        .patch(`/api/leaves/${requestId}/decision`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ decision: 'approved' });

      expect(selfApproveRes.status).toBe(403);
      expect(selfApproveRes.body.message).toMatch(/cannot approve.*own/i);

      // Another HR (Bob HR) CAN approve Alice HR's request!
      const peerApproveRes = await request(app)
        .patch(`/api/leaves/${requestId}/decision`)
        .set('Authorization', `Bearer ${hr2Token}`)
        .send({ decision: 'approved' });

      expect(peerApproveRes.status).toBe(200);
      expect(peerApproveRes.body.leave.status).toBe(LEAVE_STATUS.APPROVED);
    });

    it('forbids Manager A from deciding on requests for Manager B direct reports (403)', async () => {
      const applyRes = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-12-07',
          endDate: '2026-12-08',
          reason: 'Cross-manager authority test',
        });

      expect(applyRes.status).toBe(201);
      const requestId = applyRes.body.leaveRequest._id;

      // Dave Manager (manager2) tries to approve Eve's request (assigned to Carol Manager)
      const res = await request(app)
        .patch(`/api/leaves/${requestId}/decision`)
        .set('Authorization', `Bearer ${manager2Token}`)
        .send({ decision: 'approved' });

      expect(res.status).toBe(403);
    });

    it('updates balance accurately upon approval: reduces pending and increases used', async () => {
      const applyRes = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-12-09',
          endDate: '2026-12-10',
          reason: 'Approval balance arithmetic test',
        });

      expect(applyRes.status).toBe(201);
      const requestId = applyRes.body.leaveRequest._id;

      await request(app)
        .patch(`/api/leaves/${requestId}/decision`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ decision: 'approved' });

      const bal = await LeaveBalance.findOne({
        user: emp1User._id,
        leaveType: casualLeaveType._id,
        year: 2026,
      });

      expect(bal.used).toBe(2);
      expect(bal.pending).toBe(0);
    });

    it('requires a note when rejecting; rejection releases pending balance', async () => {
      const applyRes = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-12-11',
          endDate: '2026-12-11',
          halfDay: false,
          reason: 'Rejection test leave',
        });

      expect(applyRes.status).toBe(201);
      const requestId = applyRes.body.leaveRequest._id;

      // Reject without note -> 400
      const noNoteRes = await request(app)
        .patch(`/api/leaves/${requestId}/decision`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ decision: 'rejected' });

      expect(noNoteRes.status).toBe(400);

      // Reject with note -> 200
      const rejectRes = await request(app)
        .patch(`/api/leaves/${requestId}/decision`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ decision: 'rejected', note: 'Project deadline conflict' });

      expect(rejectRes.status).toBe(200);

      const bal = await LeaveBalance.findOne({
        user: emp1User._id,
        leaveType: casualLeaveType._id,
        year: 2026,
      });

      expect(bal.used).toBe(0);
      expect(bal.pending).toBe(0);
    });
  });

  describe('Cancellation Rules', () => {
    it('allows owner to cancel a pending leave and releases pending balance', async () => {
      const applyRes = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-12-14',
          endDate: '2026-12-15',
          reason: 'Cancel pending test leave',
        });

      expect(applyRes.status).toBe(201);
      const requestId = applyRes.body.leaveRequest._id;

      const cancelRes = await request(app)
        .patch(`/api/leaves/${requestId}/cancel`)
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.leave.status).toBe(LEAVE_STATUS.CANCELLED);

      const bal = await LeaveBalance.findOne({
        user: emp1User._id,
        leaveType: casualLeaveType._id,
        year: 2026,
      });
      expect(bal.pending).toBe(0);
    });

    it('allows owner to cancel a FUTURE approved leave and restores used balance', async () => {
      const applyRes = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-12-16',
          endDate: '2026-12-17',
          reason: 'Future approved leave for cancellation',
        });

      expect(applyRes.status).toBe(201);
      const requestId = applyRes.body.leaveRequest._id;

      // Manager approves it
      const approveRes = await request(app)
        .patch(`/api/leaves/${requestId}/decision`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ decision: 'approved' });
      expect(approveRes.status).toBe(200);

      // Employee cancels future approved leave
      const cancelRes = await request(app)
        .patch(`/api/leaves/${requestId}/cancel`)
        .set('Authorization', `Bearer ${emp1Token}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.leave.status).toBe(LEAVE_STATUS.CANCELLED);

      const bal = await LeaveBalance.findOne({
        user: emp1User._id,
        leaveType: casualLeaveType._id,
        year: 2026,
      });
      expect(bal.used).toBe(0);
    });
  });

  describe('HR Balance Adjustment', () => {
    it('allows HR to adjust allocated quota and forbids setting it below used + pending', async () => {
      // First ensure balance exists
      const userBalRes = await request(app)
        .get(`/api/leaves/balances/${emp1User._id}?year=2026`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(userBalRes.status).toBe(200);
      const casualBal = userBalRes.body.balances.find(
        (b) => b.leaveType.code === 'CASUAL'
      );
      expect(casualBal).toBeDefined();

      // HR increases quota to 16
      const adjRes = await request(app)
        .patch(`/api/leaves/balances/${casualBal._id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ allocated: 16, reason: 'Annual incentive bonus' });

      expect(adjRes.status).toBe(200);
      expect(adjRes.body.balance.allocated).toBe(16);

      // Now Eve uses 2 days
      const applyRes = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-12-21',
          endDate: '2026-12-22',
          reason: 'Taking 2 days',
        });
      expect(applyRes.status).toBe(201);

      await request(app)
        .patch(`/api/leaves/${applyRes.body.leaveRequest._id}/decision`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ decision: 'approved' });

      // HR tries to reduce allocated to 1 (below used = 2) -> 400
      const badAdjRes = await request(app)
        .patch(`/api/leaves/balances/${casualBal._id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ allocated: 1, reason: 'Attempting invalid reduction' });

      expect(badAdjRes.status).toBe(400);
      expect(badAdjRes.body.message).toMatch(/cannot be less than already used/i);
    });
  });

  describe('Calendar Endpoint', () => {
    it('returns holidays and approved leaves for the requested month', async () => {
      // Create holiday in December 2026
      await Holiday.create({
        name: 'Christmas Day',
        date: '2026-12-25',
      });

      // Create approved leave in December 2026 for emp1
      const applyRes = await request(app)
        .post('/api/leaves')
        .set('Authorization', `Bearer ${emp1Token}`)
        .send({
          leaveType: casualLeaveType._id.toString(),
          startDate: '2026-12-28',
          endDate: '2026-12-29',
          reason: 'End of year holiday break',
        });

      expect(applyRes.status).toBe(201);

      await request(app)
        .patch(`/api/leaves/${applyRes.body.leaveRequest._id}/decision`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ decision: 'approved' });

      const calRes = await request(app)
        .get('/api/leaves/calendar?month=2026-12')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(calRes.status).toBe(200);
      expect(calRes.body.holidays).toHaveLength(1);
      expect(calRes.body.leaves).toHaveLength(1);
      expect(calRes.body.leaves[0].user.name).toBe('Eve Employee');
    });
  });
});
