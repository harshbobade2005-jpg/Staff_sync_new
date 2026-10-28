import { Attendance } from '../models/attendance.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { Holiday } from '../models/holiday.model.js';
import { weekendDays, env } from '../config/env.js';
import { ATTENDANCE_STATUS, LEAVE_STATUS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';

export function getLocalDateKey(date = new Date(), timeZone = env.COMPANY_TZ || 'Asia/Kolkata') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function getLocalTime(date = new Date(), timeZone = env.COMPANY_TZ || 'Asia/Kolkata') {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

export function isCheckInLate(checkInDate = new Date(), timeZone = env.COMPANY_TZ || 'Asia/Kolkata') {
  const checkInTime = getLocalTime(checkInDate, timeZone);
  const [startH, startM] = (env.WORK_START || '09:30').split(':').map(Number);
  const graceMinutes = env.LATE_GRACE_MINUTES || 15;

  const thresholdTotalMinutes = startH * 60 + startM + graceMinutes;
  const threshH = String(Math.floor(thresholdTotalMinutes / 60)).padStart(2, '0');
  const threshM = String(thresholdTotalMinutes % 60).padStart(2, '0');
  const lateThresholdTime = `${threshH}:${threshM}`;

  return checkInTime > lateThresholdTime;
}

export async function checkInUser(userId, serverTime = new Date()) {
  const dateKey = getLocalDateKey(serverTime);

  const existing = await Attendance.findOne({ user: userId, date: dateKey });
  if (existing) {
    throw ApiError.conflict('You have already checked in for today');
  }

  // Check if user has an approved leave today
  const approvedLeave = await LeaveRequest.findOne({
    user: userId,
    status: LEAVE_STATUS.APPROVED,
    startDate: { $lte: dateKey },
    endDate: { $gte: dateKey },
  });

  if (approvedLeave && !approvedLeave.halfDay) {
    throw ApiError.conflict('You are on approved leave today');
  }

  // Check if weekend or holiday
  const [y, m, d] = dateKey.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const isWeekend = weekendDays.includes(dayOfWeek);
  const isHoliday = await Holiday.exists({ date: dateKey });

  let note = '';
  if (isWeekend || isHoliday) {
    note = 'non-working day';
  }

  const isLate = isCheckInLate(serverTime);

  const attendance = await Attendance.create({
    user: userId,
    date: dateKey,
    checkIn: serverTime,
    isLate,
    note,
    status: ATTENDANCE_STATUS.PRESENT,
  });

  return attendance;
}

export async function checkOutUser(userId, serverTime = new Date()) {
  const dateKey = getLocalDateKey(serverTime);

  const record = await Attendance.findOne({ user: userId, date: dateKey });
  if (!record) {
    throw ApiError.badRequest('No active check-in record found for today');
  }

  if (record.checkOut) {
    throw ApiError.conflict('You have already checked out for today');
  }

  record.checkOut = serverTime;
  const workedMinutes = Math.max(0, Math.round((serverTime.getTime() - record.checkIn.getTime()) / 60000));
  record.workedMinutes = workedMinutes;

  const fullDayThreshold = env.FULL_DAY_MINUTES || 480;
  const halfDayThreshold = env.HALF_DAY_MINUTES || 240;

  if (workedMinutes >= fullDayThreshold) {
    record.status = ATTENDANCE_STATUS.PRESENT;
  } else if (workedMinutes >= halfDayThreshold) {
    record.status = ATTENDANCE_STATUS.HALF_DAY;
  } else {
    record.status = ATTENDANCE_STATUS.ABSENT;
    record.note = record.note ? `${record.note}, insufficient hours` : 'insufficient hours';
  }

  await record.save();
  return record;
}
