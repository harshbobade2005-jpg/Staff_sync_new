import mongoose from 'mongoose';
import { TrainingProgram } from '../models/trainingProgram.model.js';
import { TrainingEnrollment } from '../models/trainingEnrollment.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Create a new training program (Manager only)
 */
export async function createProgram(managerId, data) {
  const program = await TrainingProgram.create({
    ...data,
    createdBy: managerId,
    status: 'draft',
  });
  return program;
}

/**
 * List training programs based on user role and filters
 */
export async function getPrograms(user, query = {}) {
  const { status, type, q, page = 1, limit = 10, startDate, endDate } = query;
  const filter = {};

  if (user.role === 'employee') {
    // Employees see only programs they are enrolled in
    const enrollments = await TrainingEnrollment.find({ user: user._id }).select('program');
    const programIds = enrollments.map((e) => e.program);
    filter._id = { $in: programIds };
  } else if (user.role === 'manager') {
    // Managers see their own programs
    filter.createdBy = user._id;
  }
  // HR sees all programs (no createdBy filter)

  if (status) filter.status = status;
  if (type) filter.type = type;

  if (startDate || endDate) {
    filter.startDate = {};
    if (startDate) filter.startDate.$gte = new Date(startDate);
    if (endDate) filter.startDate.$lte = new Date(endDate);
  }

  if (q && q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      { trainer: { $regex: escaped, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [programs, total] = await Promise.all([
    TrainingProgram.find(filter)
      .populate('createdBy', 'name email employeeCode')
      .populate('department', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    TrainingProgram.countDocuments(filter),
  ]);

  // Attach enrollment counts to each program
  const programIds = programs.map((p) => p._id);
  const enrollmentCounts = await TrainingEnrollment.aggregate([
    { $match: { program: { $in: programIds }, status: { $ne: 'dropped' } } },
    { $group: { _id: '$program', count: { $sum: 1 } } },
  ]);

  const countMap = {};
  enrollmentCounts.forEach((c) => {
    countMap[c._id.toString()] = c.count;
  });

  const enriched = programs.map((p) => ({
    ...p,
    enrolledCount: countMap[p._id.toString()] || 0,
  }));

  return {
    programs: enriched,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  };
}

/**
 * Get program detail by ID
 */
export async function getProgramById(user, programId) {
  const program = await TrainingProgram.findById(programId)
    .populate('createdBy', 'name email employeeCode')
    .populate('department', 'name code');

  if (!program) {
    throw new ApiError(404, 'Training program not found');
  }

  // Access control
  if (user.role === 'employee') {
    const enrolled = await TrainingEnrollment.findOne({ program: programId, user: user._id });
    if (!enrolled) {
      throw new ApiError(403, 'You do not have access to this training program');
    }
  }

  let enrollments = [];
  if (user.role === 'hr' || (user.role === 'manager' && program.createdBy._id.equals(user._id))) {
    enrollments = await TrainingEnrollment.find({ program: programId })
      .populate('user', 'name email employeeCode designation department')
      .sort({ createdAt: 1 });
  }

  const activeEnrollmentsCount = enrollments.filter((e) => e.status !== 'dropped').length;

  return {
    program,
    enrollments,
    enrolledCount: activeEnrollmentsCount,
  };
}

/**
 * Update program (Manager only, restricted to draft or scheduled)
 */
export async function updateProgram(managerId, programId, data) {
  const program = await TrainingProgram.findById(programId);
  if (!program) {
    throw new ApiError(404, 'Training program not found');
  }

  if (!program.createdBy.equals(managerId)) {
    throw new ApiError(403, 'Only the creating manager can update this program');
  }

  if (program.status !== 'draft' && program.status !== 'scheduled') {
    throw new ApiError(400, `Cannot edit program in '${program.status}' status. Only draft or scheduled programs can be edited.`);
  }

  Object.assign(program, data);
  await program.save();
  return program;
}

/**
 * Update program status (Lifecycle transitions)
 */
export async function updateProgramStatus(managerId, programId, newStatus) {
  const program = await TrainingProgram.findById(programId);
  if (!program) {
    throw new ApiError(404, 'Training program not found');
  }

  if (!program.createdBy.equals(managerId)) {
    throw new ApiError(403, 'Only the creating manager can modify program status');
  }

  const current = program.status;

  if (current === 'completed' || current === 'cancelled') {
    throw new ApiError(400, `Cannot transition program from terminal status '${current}'`);
  }

  // Allowed transitions
  const allowed = {
    draft: ['scheduled', 'ongoing', 'cancelled'],
    scheduled: ['ongoing', 'completed', 'cancelled'],
    ongoing: ['completed', 'cancelled'],
  };

  if (!allowed[current] || !allowed[current].includes(newStatus)) {
    throw new ApiError(400, `Invalid status transition from '${current}' to '${newStatus}'`);
  }

  program.status = newStatus;
  await program.save();
  return program;
}

/**
 * Delete program (Allowed only in draft status with 0 enrollments)
 */
export async function deleteProgram(managerId, programId) {
  const program = await TrainingProgram.findById(programId);
  if (!program) {
    throw new ApiError(404, 'Training program not found');
  }

  if (!program.createdBy.equals(managerId)) {
    throw new ApiError(403, 'Only the creating manager can delete this program');
  }

  if (program.status !== 'draft') {
    throw new ApiError(400, "Only programs in 'draft' status can be deleted. Use cancellation instead.");
  }

  const enrollmentCount = await TrainingEnrollment.countDocuments({ program: programId });
  if (enrollmentCount > 0) {
    throw new ApiError(400, 'Cannot delete program with existing enrollments. Cancel the program instead.');
  }

  await TrainingProgram.findByIdAndDelete(programId);
  return { message: 'Training program deleted successfully' };
}

/**
 * Enroll team members (Manager only, must be direct reports)
 */
export async function enrollEmployees(managerId, programId, userIds) {
  const program = await TrainingProgram.findById(programId);
  if (!program) {
    throw new ApiError(404, 'Training program not found');
  }

  if (!program.createdBy.equals(managerId)) {
    throw new ApiError(403, 'Only the creating manager can enroll members in this program');
  }

  if (program.status === 'completed' || program.status === 'cancelled') {
    throw new ApiError(400, `Cannot enroll members in a '${program.status}' program`);
  }

  // 1. Verify all userIds are direct reports of managerId
  const directReports = await User.find({
    _id: { $in: userIds },
    manager: managerId,
    status: 'active',
  });

  if (directReports.length !== userIds.length) {
    throw new ApiError(403, 'You can only enroll active employees who are your direct reports');
  }

  // 2. Check current capacity
  const currentActiveEnrollments = await TrainingEnrollment.countDocuments({
    program: programId,
    status: { $ne: 'dropped' },
  });

  if (currentActiveEnrollments + userIds.length > program.capacity) {
    throw new ApiError(
      409,
      `Program capacity exceeded. Capacity: ${program.capacity}, Currently enrolled: ${currentActiveEnrollments}, Attempted: ${userIds.length}`
    );
  }

  // 3. Check for existing enrollments
  const existing = await TrainingEnrollment.find({
    program: programId,
    user: { $in: userIds },
  });

  if (existing.length > 0) {
    throw new ApiError(409, 'One or more selected employees are already enrolled in this program');
  }

  // 4. Create enrollments
  const docs = userIds.map((uid) => ({
    program: programId,
    user: uid,
    enrolledBy: managerId,
    status: 'enrolled',
    progress: 0,
  }));

  const created = await TrainingEnrollment.insertMany(docs);
  return created;
}

/**
 * Drop or remove employee enrollment
 */
export async function dropEnrollment(managerId, programId, targetUserId) {
  const program = await TrainingProgram.findById(programId);
  if (!program) {
    throw new ApiError(404, 'Training program not found');
  }

  if (!program.createdBy.equals(managerId)) {
    throw new ApiError(403, 'Only the program manager can modify enrollments');
  }

  const enrollment = await TrainingEnrollment.findOne({ program: programId, user: targetUserId });
  if (!enrollment) {
    throw new ApiError(404, 'Enrollment not found');
  }

  // If status is 'enrolled' (not started), completely delete the record
  if (enrollment.status === 'enrolled') {
    await TrainingEnrollment.findByIdAndDelete(enrollment._id);
    return { message: 'Enrollment removed successfully' };
  }

  // If already started or in-progress, mark as 'dropped'
  enrollment.status = 'dropped';
  await enrollment.save();
  return { message: 'Enrollment marked as dropped', enrollment };
}

/**
 * Get user's own enrollments
 */
export async function getMyEnrollments(user) {
  const enrollments = await TrainingEnrollment.find({ user: user._id })
    .populate({
      path: 'program',
      populate: [
        { path: 'createdBy', select: 'name email' },
        { path: 'department', select: 'name' },
      ],
    })
    .sort({ createdAt: -1 });

  return enrollments;
}

/**
 * Get specific user's enrollments (HR, Manager for their direct report, or self)
 */
export async function getUserEnrollments(requestingUser, targetUserId) {
  if (requestingUser.role !== 'hr' && requestingUser._id.toString() !== targetUserId.toString()) {
    // If manager, check if targetUserId is a direct report
    const isDirectReport = await User.findOne({ _id: targetUserId, manager: requestingUser._id });
    if (!isDirectReport) {
      throw new ApiError(403, 'You do not have access to view this employee’s training enrollments');
    }
  }

  const enrollments = await TrainingEnrollment.find({ user: targetUserId })
    .populate({
      path: 'program',
      populate: [
        { path: 'createdBy', select: 'name email' },
        { path: 'department', select: 'name' },
      ],
    })
    .sort({ createdAt: -1 });

  return enrollments;
}

/**
 * Update enrollment (Employee updates progress/feedback; Manager records score/completion)
 */
export async function updateEnrollment(user, enrollmentId, data) {
  const enrollment = await TrainingEnrollment.findById(enrollmentId).populate('program');
  if (!enrollment) {
    throw new ApiError(404, 'Enrollment not found');
  }

  const isOwner = enrollment.user.equals(user._id);
  const isManager = enrollment.program.createdBy.equals(user._id);

  if (!isOwner && !isManager && user.role !== 'hr') {
    throw new ApiError(403, 'You do not have permission to update this enrollment');
  }

  if (isOwner) {
    // Employee updates own progress/feedback
    if (data.progress !== undefined) {
      enrollment.progress = data.progress;
      if (enrollment.progress > 0 && enrollment.status === 'enrolled') {
        enrollment.status = 'in_progress';
      }
      if (enrollment.progress === 100 && enrollment.status !== 'completed') {
        enrollment.status = 'completed';
        enrollment.completedAt = new Date();
      }
    }
    if (data.status) {
      enrollment.status = data.status;
      if (data.status === 'completed' && !enrollment.completedAt) {
        enrollment.completedAt = new Date();
        enrollment.progress = 100;
      }
    }
    if (data.feedback !== undefined) {
      enrollment.feedback = data.feedback;
    }
  }

  if (isManager || user.role === 'hr') {
    // Manager/HR records score and managerNote
    if (data.score !== undefined) {
      enrollment.score = data.score;
    }
    if (data.managerNote !== undefined) {
      enrollment.managerNote = data.managerNote;
    }
    if (data.status) {
      enrollment.status = data.status;
      if (data.status === 'completed' && !enrollment.completedAt) {
        enrollment.completedAt = new Date();
      }
    }
  }

  await enrollment.save();
  return enrollment;
}

/**
 * Generate training summary reports
 */
export async function getTrainingSummary(user) {
  const programFilter = {};
  if (user.role === 'manager') {
    programFilter.createdBy = user._id;
  }

  const programs = await TrainingProgram.find(programFilter).lean();
  const programIds = programs.map((p) => p._id);

  const enrollments = await TrainingEnrollment.find({ program: { $in: programIds } })
    .populate('user', 'name employeeCode')
    .lean();

  const totalPrograms = programs.length;
  const programsByStatus = {
    draft: 0,
    scheduled: 0,
    ongoing: 0,
    completed: 0,
    cancelled: 0,
  };
  const programsByType = {};

  programs.forEach((p) => {
    programsByStatus[p.status] = (programsByStatus[p.status] || 0) + 1;
    programsByType[p.type] = (programsByType[p.type] || 0) + 1;
  });

  const totalEnrollments = enrollments.length;
  const completedEnrollments = enrollments.filter((e) => e.status === 'completed').length;
  const inProgressEnrollments = enrollments.filter((e) => e.status === 'in_progress').length;
  const droppedEnrollments = enrollments.filter((e) => e.status === 'dropped').length;

  const completionRate =
    totalEnrollments > 0
      ? Math.round((completedEnrollments / totalEnrollments) * 100)
      : 0;

  return {
    totalPrograms,
    programsByStatus,
    programsByType,
    totalEnrollments,
    completedEnrollments,
    inProgressEnrollments,
    droppedEnrollments,
    completionRate,
  };
}
