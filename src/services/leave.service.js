import { LeaveType } from '../models/leaveType.model.js';
import { LeaveBalance } from '../models/leaveBalance.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { Holiday } from '../models/holiday.model.js';
import { User } from '../models/user.model.js';
import { weekendDays, env } from '../config/env.js';
import { ROLES, APPROVER_ROLE, LEAVE_STATUS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';

export function getTodayDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMinAllowedDateKey(backdateDays = env.LEAVE_BACKDATE_DAYS || 7) {
  const now = new Date();
  now.setDate(now.getDate() - backdateDays);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDatesInRange(startStr, endStr) {
  const dates = [];
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const curr = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  while (curr <= end) {
    const y = curr.getUTCFullYear();
    const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const d = String(curr.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

export async function calculateWorkingDays(startDateStr, endDateStr, halfDay = false) {
  if (endDateStr < startDateStr) {
    throw ApiError.badRequest('End date must be greater than or equal to start date');
  }

  const allDates = getDatesInRange(startDateStr, endDateStr);
  const holidays = await Holiday.find({
    date: { $gte: startDateStr, $lte: endDateStr },
  }).lean();

  const holidayDateSet = new Set(holidays.map((h) => h.date));
  let workingDaysCount = 0;
  let holidaysInRange = 0;
  let weekendsInRange = 0;

  for (const dateStr of allDates) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

    if (weekendDays.includes(dayOfWeek)) {
      weekendsInRange++;
    } else if (holidayDateSet.has(dateStr)) {
      holidaysInRange++;
    } else {
      workingDaysCount++;
    }
  }

  if (halfDay) {
    if (startDateStr !== endDateStr) {
      throw ApiError.badRequest('Half day is only permitted for single-day leave requests');
    }
    if (workingDaysCount === 0) {
      throw ApiError.badRequest('Selected date contains no working days');
    }
    return {
      days: 0.5,
      workingDaysCount: 0.5,
      holidaysInRange,
      weekendsInRange,
    };
  }

  if (workingDaysCount === 0) {
    throw ApiError.badRequest('Selected dates contain no working days');
  }

  return {
    days: workingDaysCount,
    workingDaysCount,
    holidaysInRange,
    weekendsInRange,
  };
}

export async function ensureBalances(userId, year) {
  const activeLeaveTypes = await LeaveType.find({ isActive: true });
  for (const lt of activeLeaveTypes) {
    const existing = await LeaveBalance.findOne({
      user: userId,
      leaveType: lt._id,
      year,
    });
    if (!existing) {
      await LeaveBalance.create({
        user: userId,
        leaveType: lt._id,
        year,
        allocated: lt.annualQuota,
        used: 0,
        pending: 0,
      });
    }
  }

  return LeaveBalance.find({ user: userId, year }).populate('leaveType');
}

export async function ensureBalancesForLeaveType(leaveType, year) {
  const activeUsers = await User.find({ status: 'active' });
  for (const user of activeUsers) {
    const existing = await LeaveBalance.findOne({
      user: user._id,
      leaveType: leaveType._id,
      year,
    });
    if (!existing) {
      await LeaveBalance.create({
        user: user._id,
        leaveType: leaveType._id,
        year,
        allocated: leaveType.annualQuota,
        used: 0,
        pending: 0,
      });
    }
  }
}

export function determineRouting(user) {
  if (user.role === ROLES.EMPLOYEE) {
    if (user.manager) {
      return {
        approverRole: APPROVER_ROLE.MANAGER,
        assignedTo: user.manager,
      };
    }
    return {
      approverRole: APPROVER_ROLE.HR,
      assignedTo: null,
    };
  }

  return {
    approverRole: APPROVER_ROLE.HR,
    assignedTo: null,
  };
}
