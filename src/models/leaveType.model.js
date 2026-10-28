import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Leave type name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Leave type code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    annualQuota: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    isPaid: {
      type: Boolean,
      default: true,
    },
    isUnlimited: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

export const LeaveType = mongoose.model('LeaveType', leaveTypeSchema);
