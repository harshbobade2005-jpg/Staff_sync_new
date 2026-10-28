import { Holiday } from '../models/holiday.model.js';
import { ApiError } from '../utils/ApiError.js';

export async function getHolidays(req, res, next) {
  try {
    const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    res.json({ holidays, year });
  } catch (err) {
    next(err);
  }
}

export async function createHoliday(req, res, next) {
  try {
    const { name, date } = req.body;
    const existing = await Holiday.findOne({ date });
    if (existing) {
      throw ApiError.conflict(`A holiday already exists on ${date}`);
    }

    const holiday = await Holiday.create({ name, date });
    res.status(201).json({
      message: 'Holiday created successfully',
      holiday,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateHoliday(req, res, next) {
  try {
    const { id } = req.params;
    const { name, date } = req.body;

    const holiday = await Holiday.findById(id);
    if (!holiday) {
      throw ApiError.notFound('Holiday not found');
    }

    if (date && date !== holiday.date) {
      const conflict = await Holiday.findOne({ date, _id: { $ne: id } });
      if (conflict) {
        throw ApiError.conflict(`A holiday already exists on ${date}`);
      }
      holiday.date = date;
    }

    if (name !== undefined) holiday.name = name;

    await holiday.save();

    res.json({
      message: 'Holiday updated successfully',
      holiday,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteHoliday(req, res, next) {
  try {
    const { id } = req.params;
    const holiday = await Holiday.findByIdAndDelete(id);
    if (!holiday) {
      throw ApiError.notFound('Holiday not found');
    }

    res.json({ message: 'Holiday deleted successfully' });
  } catch (err) {
    next(err);
  }
}
