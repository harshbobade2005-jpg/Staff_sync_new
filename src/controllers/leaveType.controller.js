import { LeaveType } from '../models/leaveType.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { ensureBalancesForLeaveType } from '../services/leave.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function getLeaveTypes(req, res, next) {
  try {
    const leaveTypes = await LeaveType.find().sort({ name: 1 });
    res.json({ leaveTypes });
  } catch (err) {
    next(err);
  }
}

export async function createLeaveType(req, res, next) {
  try {
    const { name, code, annualQuota, isPaid, isUnlimited, isActive, description } = req.body;
    const existing = await LeaveType.findOne({ code: code.toUpperCase() });
    if (existing) {
      throw ApiError.conflict(`Leave type with code '${code.toUpperCase()}' already exists`);
    }

    const leaveType = await LeaveType.create({
      name,
      code: code.toUpperCase(),
      annualQuota,
      isPaid,
      isUnlimited,
      isActive,
      description,
    });

    const currentYear = new Date().getFullYear();
    await ensureBalancesForLeaveType(leaveType, currentYear);

    res.status(201).json({
      message: 'Leave type created successfully',
      leaveType,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateLeaveType(req, res, next) {
  try {
    const { id } = req.params;
    const { name, code, annualQuota, isPaid, isUnlimited, isActive, description } = req.body;

    const leaveType = await LeaveType.findById(id);
    if (!leaveType) {
      throw ApiError.notFound('Leave type not found');
    }

    if (code && code.toUpperCase() !== leaveType.code) {
      const conflict = await LeaveType.findOne({
        code: code.toUpperCase(),
        _id: { $ne: id },
      });
      if (conflict) {
        throw ApiError.conflict(`Leave type with code '${code.toUpperCase()}' already exists`);
      }
      leaveType.code = code.toUpperCase();
    }

    if (name !== undefined) leaveType.name = name;
    if (annualQuota !== undefined) leaveType.annualQuota = annualQuota;
    if (isPaid !== undefined) leaveType.isPaid = isPaid;
    if (isUnlimited !== undefined) leaveType.isUnlimited = isUnlimited;
    if (isActive !== undefined) leaveType.isActive = isActive;
    if (description !== undefined) leaveType.description = description;

    await leaveType.save();

    res.json({
      message: 'Leave type updated successfully',
      leaveType,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteLeaveType(req, res, next) {
  try {
    const { id } = req.params;
    const leaveType = await LeaveType.findById(id);
    if (!leaveType) {
      throw ApiError.notFound('Leave type not found');
    }

    const hasRequests = await LeaveRequest.exists({ leaveType: id });
    if (hasRequests) {
      throw ApiError.conflict(
        'Leave type has associated requests; deactivate it instead of deleting'
      );
    }

    await LeaveType.findByIdAndDelete(id);
    res.json({ message: 'Leave type deleted successfully' });
  } catch (err) {
    next(err);
  }
}
