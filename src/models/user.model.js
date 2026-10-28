import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, USER_STATUS } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    employeeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    designation: { type: String, trim: true },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    dateOfJoining: { type: Date },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    phone: { type: String, trim: true },
    dob: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', ''] },
    address: { type: String, trim: true },
    emergencyContact: {
      name: { type: String, trim: true },
      relation: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    mustChangePassword: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ manager: 1 });
userSchema.index({ department: 1, status: 1 });
userSchema.index({ name: 'text', email: 'text', employeeCode: 'text' });

// Hash password on save when modified
userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return;
  const rounds = process.env.NODE_ENV === 'test' ? 4 : 12;
  this.passwordHash = await bcrypt.hash(this.passwordHash, rounds);
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);

/** Generate the next employee code (EMP-0001, EMP-0002, …) */
export async function generateEmployeeCode() {
  const MAX_RETRIES = 5;
  for (let i = 0; i < MAX_RETRIES; i++) {
    const last = await User.findOne({}, { employeeCode: 1 })
      .sort({ employeeCode: -1 })
      .lean();

    let nextNum = 1;
    if (last?.employeeCode) {
      const match = last.employeeCode.match(/(\d+)$/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const code = `EMP-${String(nextNum).padStart(4, '0')}`;
    // Verify it doesn't exist (race condition guard)
    const exists = await User.exists({ employeeCode: code });
    if (!exists) return code;
  }
  throw new Error('Could not generate unique employee code');
}
