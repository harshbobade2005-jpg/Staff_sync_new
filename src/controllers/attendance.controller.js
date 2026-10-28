import { Attendance } from '../models/attendance.model.js';
import { User } from '../models/user.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { Holiday } from '../models/holiday.model.js';
import {
  checkInUser,
  checkOutUser,
  getLocalDateKey,
  getLocalTime,
  isCheckInLate,
} from '../services/attendance.service.js';
import { weekendDays, env } from '../config/env.js';
import { ATTENDANCE_STATUS, LEAVE_STATUS, ROLES } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';

export async function checkIn(req, res, next) {
  try {
    const attendance = await checkInUser(req.user._id);
    res.status(201).json({
      message: 'Checked in successfully',
      attendance,
    });
  } catch (err) {
    next(err);
  }
}

export async function checkOut(req, res, next) {
  try {
    const attendance = await checkOutUser(req.user._id);
    res.json({
      message: 'Checked out successfully',
      attendance,
    });
  } catch (err) {
    next(err);
  }
}

export async function getTodayStatus(req, res, next) {
  try {
    const now = new Date();
    const dateKey = getLocalDateKey(now);
    const record = await Attendance.findOne({ user: req.user._id, date: dateKey });

    const canCheckIn = !record;
    const canCheckOut = !!record && !record.checkOut;

    res.json({
      date: dateKey,
      serverTime: now,
      localTime: getLocalTime(now),
      record,
      canCheckIn,
      canCheckOut,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyMonthlyAttendance(req, res, next) {
  try {
    const todayKey = getLocalDateKey(new Date());
    const month = req.query.month || todayKey.slice(0, 7);
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const [records, holidays, leaves] = await Promise.all([
      Attendance.find({
        user: req.user._id,
        date: { $gte: startDate, $lte: endDate },
      }).sort({ date: 1 }),
      Holiday.find({
        date: { $gte: startDate, $lte: endDate },
      }).lean(),
      LeaveRequest.find({
        user: req.user._id,
        status: LEAVE_STATUS.APPROVED,
        startDate: { $lte: endDate },
        endDate: { $gte: startDate },
      }).populate('leaveType', 'name code'),
    ]);

    const recordMap = new Map(records.map((r) => [r.date, r]));
    const holidayMap = new Map(holidays.map((h) => [h.date, h.name]));

    const [yNum, mNum] = month.split('-').map(Number);
    const daysInMonth = new Date(yNum, mNum, 0).getDate();

    const days = [];
    let presentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let totalWorkedMinutes = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${yNum}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(Date.UTC(yNum, mNum - 1, day)).getUTCDay();
      const isWeekend = weekendDays.includes(dayOfWeek);
      const isPast = dateKey < todayKey;
      const isToday = dateKey === todayKey;

      const record = recordMap.get(dateKey);
      const holidayName = holidayMap.get(dateKey);
      const leave = leaves.find((l) => dateKey >= l.startDate && dateKey <= l.endDate);

      let derivedStatus = null;
      if (record) {
        derivedStatus = record.status;
        if (record.status === ATTENDANCE_STATUS.PRESENT) presentCount++;
        else if (record.status === ATTENDANCE_STATUS.HALF_DAY) halfDayCount++;
        else if (record.status === ATTENDANCE_STATUS.ABSENT) absentCount++;
        if (record.isLate) lateCount++;
        totalWorkedMinutes += record.workedMinutes || 0;
      } else if (leave) {
        derivedStatus = 'on-leave';
        leaveCount++;
      } else if (holidayName) {
        derivedStatus = 'holiday';
      } else if (isWeekend) {
        derivedStatus = 'weekend';
      } else if (isPast) {
        derivedStatus = 'absent';
        absentCount++;
      } else if (isToday) {
        derivedStatus = 'not-checked-in';
      } else {
        derivedStatus = null; // future
      }

      days.push({
        date: dateKey,
        day,
        dayOfWeek,
        isWeekend,
        derivedStatus,
        holidayName,
        leave: leave ? { leaveType: leave.leaveType?.name, halfDay: leave.halfDay } : null,
        record: record || null,
      });
    }

    res.json({
      month,
      summary: {
        presentCount,
        lateCount,
        halfDayCount,
        absentCount,
        leaveCount,
        totalWorkedMinutes,
        totalWorkedHours: (totalWorkedMinutes / 60).toFixed(1),
      },
      days,
    });
  } catch (err) {
    next(err);
  }
}

export async function getTeamAttendance(req, res, next) {
  try {
    const date = req.query.date || getLocalDateKey(new Date());

    const directReports = await User.find(
      { manager: req.user._id, status: 'active' },
      'name employeeCode designation department email'
    ).populate('department', 'name code').sort({ name: 1 });

    const reportIds = directReports.map((d) => d._id);

    const [attendances, leaves] = await Promise.all([
      Attendance.find({ user: { $in: reportIds }, date }).populate('user', 'name employeeCode designation'),
      LeaveRequest.find({
        user: { $in: reportIds },
        status: LEAVE_STATUS.APPROVED,
        startDate: { $lte: date },
        endDate: { $gte: date },
      }).populate('leaveType', 'name code'),
    ]);

    const attMap = new Map(attendances.map((a) => [a.user._id.toString(), a]));
    const leaveMap = new Map(leaves.map((l) => [l.user.toString(), l]));

    const team = directReports.map((emp) => {
      const empIdStr = emp._id.toString();
      const att = attMap.get(empIdStr);
      const leave = leaveMap.get(empIdStr);

      let status = 'not-checked-in';
      if (att) {
        status = att.status;
      } else if (leave) {
        status = 'on-leave';
      }

      return {
        user: emp,
        status,
        attendance: att || null,
        leave: leave || null,
      };
    });

    res.json({ date, team });
  } catch (err) {
    next(err);
  }
}

export async function getTeamAttendanceSummary(req, res, next) {
  try {
    const todayKey = getLocalDateKey(new Date());
    const month = req.query.month || todayKey.slice(0, 7);
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const directReports = await User.find(
      { manager: req.user._id, status: 'active' },
      'name employeeCode designation department'
    ).populate('department', 'name code').sort({ name: 1 });

    const reportIds = directReports.map((d) => d._id);

    const attendances = await Attendance.find({
      user: { $in: reportIds },
      date: { $gte: startDate, $lte: endDate },
    });

    const summaryMap = new Map();
    for (const emp of directReports) {
      summaryMap.set(emp._id.toString(), {
        user: emp,
        present: 0,
        late: 0,
        halfDay: 0,
        absent: 0,
        totalMinutes: 0,
      });
    }

    for (const att of attendances) {
      const entry = summaryMap.get(att.user.toString());
      if (entry) {
        if (att.status === ATTENDANCE_STATUS.PRESENT) entry.present++;
        else if (att.status === ATTENDANCE_STATUS.HALF_DAY) entry.halfDay++;
        else if (att.status === ATTENDANCE_STATUS.ABSENT) entry.absent++;
        if (att.isLate) entry.late++;
        entry.totalMinutes += att.workedMinutes || 0;
      }
    }

    res.json({
      month,
      summaries: Array.from(summaryMap.values()),
    });
  } catch (err) {
    next(err);
  }
}

export async function getAllAttendance(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.date) query.date = req.query.date;
    if (req.query.status) query.status = req.query.status;
    if (req.query.userId) query.user = req.query.userId;
    if (req.query.department) {
      const users = await User.find({ department: req.query.department }).select('_id');
      query.user = { $in: users.map((u) => u._id) };
    }

    const [attendances, total] = await Promise.all([
      Attendance.find(query)
        .populate('user', 'name email employeeCode department designation')
        .populate('correctedBy', 'name email')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Attendance.countDocuments(query),
    ]);

    res.json({
      attendances,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMonthlyAttendanceSummary(req, res, next) {
  try {
    const todayKey = getLocalDateKey(new Date());
    const month = req.query.month || todayKey.slice(0, 7);
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const userQuery = { status: 'active' };
    if (req.query.department) userQuery.department = req.query.department;

    const users = await User.find(userQuery, 'name employeeCode designation department')
      .populate('department', 'name code')
      .sort({ name: 1 });

    const userIds = users.map((u) => u._id);

    const attendances = await Attendance.find({
      user: { $in: userIds },
      date: { $gte: startDate, $lte: endDate },
    });

    const summaryMap = new Map();
    for (const u of users) {
      summaryMap.set(u._id.toString(), {
        user: u,
        present: 0,
        late: 0,
        halfDay: 0,
        absent: 0,
        totalMinutes: 0,
      });
    }

    for (const att of attendances) {
      const entry = summaryMap.get(att.user.toString());
      if (entry) {
        if (att.status === ATTENDANCE_STATUS.PRESENT) entry.present++;
        else if (att.status === ATTENDANCE_STATUS.HALF_DAY) entry.halfDay++;
        else if (att.status === ATTENDANCE_STATUS.ABSENT) entry.absent++;
        if (att.isLate) entry.late++;
        entry.totalMinutes += att.workedMinutes || 0;
      }
    }

    res.json({
      month,
      summaries: Array.from(summaryMap.values()),
    });
  } catch (err) {
    next(err);
  }
}

function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Formula injection prevention: characters = + - @ at cell start
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportAttendanceCsv(req, res, next) {
  try {
    const month = req.query.month || getLocalDateKey(new Date()).slice(0, 7);
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const attendances = await Attendance.find({
      date: { $gte: startDate, $lte: endDate },
    })
      .populate('user', 'name employeeCode designation department')
      .sort({ date: 1 });

    const headers = [
      'Date',
      'Employee Code',
      'Employee Name',
      'Check In',
      'Check Out',
      'Worked Minutes',
      'Status',
      'Late',
      'Note',
    ];

    const rows = attendances.map((a) => [
      sanitizeCsvCell(a.date),
      sanitizeCsvCell(a.user?.employeeCode || ''),
      sanitizeCsvCell(a.user?.name || ''),
      sanitizeCsvCell(a.checkIn ? a.checkIn.toISOString() : ''),
      sanitizeCsvCell(a.checkOut ? a.checkOut.toISOString() : ''),
      sanitizeCsvCell(a.workedMinutes || 0),
      sanitizeCsvCell(a.status),
      sanitizeCsvCell(a.isLate ? 'Yes' : 'No'),
      sanitizeCsvCell(a.note || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${month}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
}

export async function correctAttendance(req, res, next) {
  try {
    const { id } = req.params;
    const { checkIn, checkOut, status, correctionReason } = req.body;

    const record = await Attendance.findById(id);
    if (!record) {
      throw ApiError.notFound('Attendance record not found');
    }

    // Preserve current state in history
    record.history.push({
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      workedMinutes: record.workedMinutes,
      status: record.status,
      note: record.note,
      correctedBy: req.user._id,
      correctionReason,
      correctedAt: new Date(),
    });

    if (checkIn) record.checkIn = new Date(checkIn);
    if (checkOut !== undefined) {
      record.checkOut = checkOut ? new Date(checkOut) : null;
    }

    if (record.checkIn && record.checkOut) {
      record.workedMinutes = Math.max(0, Math.round((record.checkOut.getTime() - record.checkIn.getTime()) / 60000));
    }

    if (status) {
      record.status = status;
    }

    record.correctedBy = req.user._id;
    record.correctionReason = correctionReason;

    await record.save();

    res.json({
      message: 'Attendance corrected successfully',
      attendance: record,
    });
  } catch (err) {
    next(err);
  }
}

export async function createMissingAttendance(req, res, next) {
  try {
    const { userId, date, checkIn, checkOut, status, correctionReason } = req.body;

    const existing = await Attendance.findOne({ user: userId, date });
    if (existing) {
      throw ApiError.conflict('An attendance record already exists for this date. Use edit/correct instead.');
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = checkOut ? new Date(checkOut) : null;
    let workedMinutes = 0;
    if (checkOutDate) {
      workedMinutes = Math.max(0, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 60000));
    }

    const isLate = isCheckInLate(checkInDate);

    const attendance = await Attendance.create({
      user: userId,
      date,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      workedMinutes,
      isLate,
      status: status || ATTENDANCE_STATUS.PRESENT,
      correctedBy: req.user._id,
      correctionReason,
      history: [
        {
          checkIn: checkInDate,
          checkOut: checkOutDate,
          workedMinutes,
          status: status || ATTENDANCE_STATUS.PRESENT,
          correctedBy: req.user._id,
          correctionReason,
          correctedAt: new Date(),
        },
      ],
    });

    res.status(201).json({
      message: 'Missing attendance record created successfully',
      attendance,
    });
  } catch (err) {
    next(err);
  }
}
