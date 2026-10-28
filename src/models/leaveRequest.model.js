import mongoose from 'mongoose';
import { LEAVE_STATUS, APPROVER_ROLE } from '../config/constants.js';

const leaveRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveType',
      required: true,
    },
    startDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Start date must be formatted as YYYY-MM-DD'],
    },
    endDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'End date must be formatted as YYYY-MM-DD'],
    },
    halfDay: {
      type: Boolean,
      default: false,
    },
    days: {
      type: Number,
      required: true,
      min: [0.5, 'Days must be at least 0.5'],
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
      minlength: [5, 'Reason must be at least 5 characters'],
    },
    status: {
      type: String,
      enum: Object.values(LEAVE_STATUS),
      default: LEAVE_STATUS.PENDING,
      index: true,
    },
    approverRole: {
      type: String,
      enum: Object.values(APPROVER_ROLE),
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    decisionNote: {
      type: String,
      trim: true,
      default: '',
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ user: 1, startDate: 1 });
leaveRequestSchema.index({ assignedTo: 1, status: 1 });
leaveRequestSchema.index({ status: 1, startDate: 1 });

export const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
