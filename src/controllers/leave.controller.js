import { LeaveRequest } from '../models/leaveRequest.model.js';
import { LeaveType } from '../models/leaveType.model.js';
import { LeaveBalance } from '../models/leaveBalance.model.js';
import { Holiday } from '../models/holiday.model.js';
import { User } from '../models/user.model.js';
import {
  calculateWorkingDays,
  ensureBalances,
  determineRouting,
  getTodayDateKey,
  getMinAllowedDateKey,
} from '../services/leave.service.js';
import { ROLES, LEAVE_STATUS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';

export async function previewLeave(req, res, next) {
  try {
    const { startDate, endDate, halfDay } = req.query;
    if (!startDate || !endDate) {
      throw ApiError.badRequest('startDate and endDate query parameters are required');
    }

    const isHalfDay = halfDay === 'true' || halfDay === true;
    const result = await calculateWorkingDays(startDate, endDate, isHalfDay);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOwnBalances(req, res, next) {
  try {
    const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
    const balances = await ensureBalances(req.user._id, year);
    res.json({ balances, year });
  } catch (err) {
    next(err);
  }
}

export async function getUserBalances(req, res, next) {
  try {
    const { userId } = req.params;
    const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();

    const targetUser = await User.findById(userId).populate('department', 'name code');
    if (!targetUser) {
      throw ApiError.notFound('User not found');
    }

    if (req.user.role === ROLES.MANAGER) {
      const isDirectReport = targetUser.manager?.toString() === req.user._id.toString();
      if (!isDirectReport && targetUser._id.toString() !== req.user._id.toString()) {
        throw ApiError.forbidden('You are only authorized to view balances for your direct reports');
      }
    } else if (req.user.role === ROLES.EMPLOYEE) {
      if (targetUser._id.toString() !== req.user._id.toString()) {
        throw ApiError.forbidden('Access denied');
      }
    }

    const balances = await ensureBalances(userId, year);
    res.json({ balances, year, user: targetUser });
  } catch (err) {
    next(err);
  }
}

export async function adjustBalance(req, res, next) {
  try {
    const { id } = req.params;
    const { allocated, reason } = req.body;

    const balance = await LeaveBalance.findById(id).populate('leaveType user');
    if (!balance) {
      throw ApiError.notFound('Leave balance record not found');
    }

    const minAllowed = balance.used + balance.pending;
    if (allocated < minAllowed) {
      throw ApiError.badRequest(
        `Allocated days cannot be less than already used (${balance.used}) + pending (${balance.pending}) days`
      );
    }

    balance.adjustments.push({
      reason,
      previousAllocated: balance.allocated,
      newAllocated: allocated,
      adjustedBy: req.user._id,
      adjustedAt: new Date(),
    });

    balance.allocated = allocated;
    await balance.save();

    res.json({
      message: 'Leave balance adjusted successfully',
      balance,
    });
  } catch (err) {
    next(err);
  }
}

export async function applyLeave(req, res, next) {
  try {
    const { leaveType, startDate, endDate, halfDay, reason } = req.body;

    const minAllowedDate = getMinAllowedDateKey();
    if (startDate < minAllowedDate) {
      throw ApiError.badRequest(`Leave start date cannot be earlier than ${minAllowedDate}`);
    }

    const startYear = startDate.slice(0, 4);
    const endYear = endDate.slice(0, 4);
    if (startYear !== endYear) {
      throw ApiError.badRequest(
        'Leave requests cannot span across calendar years. Please submit separate requests for each year.'
      );
    }

    const leaveTypeDoc = await LeaveType.findById(leaveType);
    if (!leaveTypeDoc || !leaveTypeDoc.isActive) {
      throw ApiError.badRequest('Selected leave type is invalid or inactive');
    }

    const { days } = await calculateWorkingDays(startDate, endDate, halfDay);

    const overlap = await LeaveRequest.findOne({
      user: req.user._id,
      status: { $in: [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });

    if (overlap) {
      throw ApiError.badRequest(
        'You already have a pending or approved leave request overlapping these dates'
      );
    }

    const reqYear = parseInt(startYear, 10);
    await ensureBalances(req.user._id, reqYear);

    const balance = await LeaveBalance.findOne({
      user: req.user._id,
      leaveType: leaveTypeDoc._id,
      year: reqYear,
    });

    if (!balance) {
      throw ApiError.badRequest('Leave balance record not found');
    }

    const available = balance.allocated - balance.used - balance.pending;
    if (!leaveTypeDoc.isUnlimited && days > available) {
      throw ApiError.badRequest(
        `Insufficient leave balance. Available: ${available} days, requested: ${days} days`
      );
    }

    const userDoc = await User.findById(req.user._id);
    const routing = determineRouting(userDoc);

    await LeaveBalance.updateOne(
      { _id: balance._id },
      { $inc: { pending: days } }
    );

    const leaveRequest = await LeaveRequest.create({
      user: req.user._id,
      leaveType: leaveTypeDoc._id,
      startDate,
      endDate,
      halfDay: !!halfDay,
      days,
      reason,
      status: LEAVE_STATUS.PENDING,
      approverRole: routing.approverRole,
      assignedTo: routing.assignedTo,
    });

    await leaveRequest.populate('leaveType');

    res.status(201).json({
      message: 'Leave request submitted successfully',
      leaveRequest,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyLeaves(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.year) {
      query.startDate = { $regex: `^${req.query.year}-` };
    }

    const [leaves, total] = await Promise.all([
      LeaveRequest.find(query)
        .populate('leaveType')
        .populate('assignedTo', 'name email')
        .populate('decidedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      LeaveRequest.countDocuments(query),
    ]);

    res.json({
      leaves,
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

export async function getAllLeaves(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.user.role === ROLES.MANAGER) {
      const directReports = await User.find({ manager: req.user._id }).select('_id');
      const directReportIds = directReports.map((d) => d._id);
      query.$or = [{ assignedTo: req.user._id }, { user: { $in: directReportIds } }];
    } else if (req.user.role === ROLES.EMPLOYEE) {
      throw ApiError.forbidden('Access denied');
    }

    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.userId) {
      query.user = req.query.userId;
    }
    if (req.query.department) {
      const usersInDept = await User.find({ department: req.query.department }).select('_id');
      const userIds = usersInDept.map((u) => u._id);
      query.user = { $in: userIds };
    }
    if (req.query.startDate && req.query.endDate) {
      query.startDate = { $lte: req.query.endDate };
      query.endDate = { $gte: req.query.startDate };
    }

    const [leaves, total] = await Promise.all([
      LeaveRequest.find(query)
        .populate('user', 'name email employeeCode department designation')
        .populate('leaveType')
        .populate('assignedTo', 'name email')
        .populate('decidedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      LeaveRequest.countDocuments(query),
    ]);

    res.json({
      leaves,
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

export async function getPendingApprovals(req, res, next) {
  try {
    let query;
    if (req.user.role === ROLES.MANAGER) {
      query = {
        assignedTo: req.user._id,
        status: LEAVE_STATUS.PENDING,
      };
    } else if (req.user.role === ROLES.HR) {
      query = {
        status: LEAVE_STATUS.PENDING,
      };
    } else {
      throw ApiError.forbidden('Access denied');
    }

    const leaves = await LeaveRequest.find(query)
      .populate('user', 'name email employeeCode department designation')
      .populate('leaveType')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: 1 });

    res.json({ leaves });
  } catch (err) {
    next(err);
  }
}

export async function getLeaveById(req, res, next) {
  try {
    const { id } = req.params;
    const leave = await LeaveRequest.findById(id)
      .populate('user', 'name email employeeCode department designation manager')
      .populate('leaveType')
      .populate('assignedTo', 'name email')
      .populate('decidedBy', 'name email');

    if (!leave) {
      throw ApiError.notFound('Leave request not found');
    }

    const isOwner = leave.user._id.toString() === req.user._id.toString();
    const isAssigned = leave.assignedTo?._id.toString() === req.user._id.toString();
    const isHr = req.user.role === ROLES.HR;

    if (!isOwner && !isAssigned && !isHr) {
      throw ApiError.forbidden('Access denied');
    }

    res.json({ leave });
  } catch (err) {
    next(err);
  }
}

export async function decideLeave(req, res, next) {
  try {
    const { id } = req.params;
    const { decision, note } = req.body;

    const request = await LeaveRequest.findById(id);
    if (!request) {
      throw ApiError.notFound('Leave request not found');
    }

    if (request.user.toString() === req.user._id.toString()) {
      throw ApiError.forbidden('You cannot approve or reject your own leave request');
    }

    if (req.user.role === ROLES.MANAGER) {
      const isAssigned = request.assignedTo?.toString() === req.user._id.toString();
      if (!isAssigned) {
        throw ApiError.forbidden('You are not authorized to decide on this leave request');
      }
    } else if (req.user.role !== ROLES.HR) {
      throw ApiError.forbidden('Access denied');
    }

    const updated = await LeaveRequest.findOneAndUpdate(
      { _id: id, status: LEAVE_STATUS.PENDING },
      {
        status: decision,
        decidedBy: req.user._id,
        decidedAt: new Date(),
        decisionNote: note || '',
      },
      { returnDocument: 'after' }
    )
      .populate('user', 'name email employeeCode')
      .populate('leaveType');

    if (!updated) {
      throw ApiError.conflict('Request has already been processed or is not in pending status');
    }

    const reqYear = parseInt(updated.startDate.slice(0, 4), 10);
    if (decision === LEAVE_STATUS.APPROVED) {
      await LeaveBalance.updateOne(
        { user: updated.user._id, leaveType: updated.leaveType._id, year: reqYear },
        { $inc: { pending: -updated.days, used: updated.days } }
      );
    } else if (decision === LEAVE_STATUS.REJECTED) {
      await LeaveBalance.updateOne(
        { user: updated.user._id, leaveType: updated.leaveType._id, year: reqYear },
        { $inc: { pending: -updated.days } }
      );
    }

    res.json({
      message: `Leave request ${decision} successfully`,
      leave: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelLeave(req, res, next) {
  try {
    const { id } = req.params;
    const request = await LeaveRequest.findById(id);
    if (!request) {
      throw ApiError.notFound('Leave request not found');
    }

    if (request.user.toString() !== req.user._id.toString()) {
      throw ApiError.forbidden('You can only cancel your own leave requests');
    }

    const reqYear = parseInt(request.startDate.slice(0, 4), 10);
    const today = getTodayDateKey();

    if (request.status === LEAVE_STATUS.PENDING) {
      request.status = LEAVE_STATUS.CANCELLED;
      request.cancelledAt = new Date();
      await request.save();

      await LeaveBalance.updateOne(
        { user: request.user, leaveType: request.leaveType, year: reqYear },
        { $inc: { pending: -request.days } }
      );
    } else if (request.status === LEAVE_STATUS.APPROVED) {
      if (request.startDate <= today) {
        throw ApiError.badRequest(
          'Cannot cancel an approved leave that has already started or is in the past'
        );
      }

      request.status = LEAVE_STATUS.CANCELLED;
      request.cancelledAt = new Date();
      await request.save();

      await LeaveBalance.updateOne(
        { user: request.user, leaveType: request.leaveType, year: reqYear },
        { $inc: { used: -request.days } }
      );
    } else {
      throw ApiError.badRequest('Leave request cannot be cancelled in its current state');
    }

    res.json({
      message: 'Leave request cancelled successfully',
      leave: request,
    });
  } catch (err) {
    next(err);
  }
}

export async function getLeaveCalendar(req, res, next) {
  try {
    const month = req.query.month || getTodayDateKey().slice(0, 7);
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    const leaveQuery = {
      status: LEAVE_STATUS.APPROVED,
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    };

    if (req.user.role === ROLES.MANAGER) {
      const directReports = await User.find({ manager: req.user._id }).select('_id');
      const directReportIds = directReports.map((d) => d._id);
      leaveQuery.user = { $in: [...directReportIds, req.user._id] };
    } else if (req.user.role === ROLES.EMPLOYEE) {
      const userDoc = await User.findById(req.user._id);
      if (userDoc.manager) {
        const teammates = await User.find({ manager: userDoc.manager }).select('_id');
        leaveQuery.user = { $in: teammates.map((t) => t._id) };
      } else {
        leaveQuery.user = req.user._id;
      }
    }

    const leaves = await LeaveRequest.find(leaveQuery)
      .populate('user', 'name employeeCode department designation')
      .populate('leaveType', 'name code isPaid')
      .sort({ startDate: 1 });

    res.json({
      month,
      holidays,
      leaves,
    });
  } catch (err) {
    next(err);
  }
}
