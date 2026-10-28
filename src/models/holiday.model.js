import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Holiday name is required'],
      trim: true,
    },
    date: {
      type: String,
      required: [true, 'Holiday date is required'],
      unique: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'],
    },
  },
  { timestamps: true }
);

export const Holiday = mongoose.model('Holiday', holidaySchema);
