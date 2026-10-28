import mongoose from 'mongoose';
import { ROLES } from '../config/constants.js';

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
    },
    body: {
      type: String,
      required: [true, 'Announcement body is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['general', 'event', 'urgent', 'policy'],
      default: 'general',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    audience: {
      type: [String],
      enum: ['all', ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE],
      default: ['all'],
      index: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

announcementSchema.index({ isPinned: -1, publishAt: -1 });

export const Announcement = mongoose.model('Announcement', announcementSchema);
