import mongoose from 'mongoose';

const adjustmentSchema = new mongoose.Schema(
  {
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    previousAllocated: {
      type: Number,
      required: true,
    },
    newAllocated: {
      type: Number,
      required: true,
    },
    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adjustedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const leaveBalanceSchema = new mongoose.Schema(
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
    year: {
      type: Number,
      required: true,
      index: true,
    },
    allocated: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    used: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    pending: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    adjustments: [adjustmentSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

leaveBalanceSchema.virtual('available').get(function () {
  return Math.max(0, this.allocated - this.used - this.pending);
});

leaveBalanceSchema.index({ user: 1, leaveType: 1, year: 1 }, { unique: true });

export const LeaveBalance = mongoose.model('LeaveBalance', leaveBalanceSchema);
