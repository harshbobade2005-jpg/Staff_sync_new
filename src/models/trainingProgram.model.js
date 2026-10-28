import mongoose from 'mongoose';

const trainingProgramSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
    },
    type: {
      type: String,
      required: true,
      enum: ['technical', 'soft_skills', 'compliance', 'leadership', 'onboarding'],
      default: 'technical',
    },
    mode: {
      type: String,
      required: true,
      enum: ['online', 'in_person', 'hybrid'],
      default: 'online',
    },
    trainer: {
      type: String,
      trim: true,
      default: 'Internal Instructor',
    },
    location: {
      type: String,
      trim: true,
      default: 'Remote / Virtual',
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      default: 20,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying manager programs by status
trainingProgramSchema.index({ createdBy: 1, status: 1 });
trainingProgramSchema.index({ startDate: 1, endDate: 1 });

export const TrainingProgram = mongoose.model('TrainingProgram', trainingProgramSchema);
