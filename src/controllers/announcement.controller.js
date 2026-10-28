import { Announcement } from '../models/announcement.model.js';
import { ROLES } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getAnnouncements(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const now = new Date();
    const query = {
      publishAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      audience: { $in: ['all', req.user.role] },
    };

    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.q) {
      const escaped = escapeRegex(req.query.q.trim());
      query.$and = [
        {
          $or: [
            { title: { $regex: escaped, $options: 'i' } },
            { body: { $regex: escaped, $options: 'i' } },
          ],
        },
      ];
    }

    const [announcements, total] = await Promise.all([
      Announcement.find(query)
        .populate('createdBy', 'name email')
        .sort({ isPinned: -1, publishAt: -1 })
        .skip(skip)
        .limit(limit),
      Announcement.countDocuments(query),
    ]);

    res.json({
      announcements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getLatestAnnouncements(req, res, next) {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const now = new Date();

    const query = {
      publishAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      audience: { $in: ['all', req.user.role] },
    };

    const announcements = await Announcement.find(query)
      .populate('createdBy', 'name')
      .sort({ isPinned: -1, publishAt: -1 })
      .limit(limit);

    res.json({ announcements });
  } catch (err) {
    next(err);
  }
}

export async function getAnnouncementById(req, res, next) {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findById(id).populate('createdBy', 'name email');

    if (!announcement) {
      throw ApiError.notFound('Announcement not found');
    }

    const now = new Date();
    const isHr = req.user.role === ROLES.HR;
    const isLive =
      announcement.publishAt <= now &&
      (!announcement.expiresAt || announcement.expiresAt > now);
    const hasAudience =
      announcement.audience.includes('all') ||
      announcement.audience.includes(req.user.role);

    if (!isHr && (!isLive || !hasAudience)) {
      throw ApiError.forbidden('Access denied');
    }

    res.json({ announcement });
  } catch (err) {
    next(err);
  }
}

export async function getManageAnnouncements(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.category) query.category = req.query.category;

    const [announcements, total] = await Promise.all([
      Announcement.find(query)
        .populate('createdBy', 'name email')
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Announcement.countDocuments(query),
    ]);

    const now = new Date();
    const withState = announcements.map((doc) => {
      const a = doc.toObject();
      if (a.publishAt > now) {
        a.state = 'scheduled';
      } else if (a.expiresAt && a.expiresAt <= now) {
        a.state = 'expired';
      } else {
        a.state = 'live';
      }
      return a;
    });

    res.json({
      announcements: withState,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createAnnouncement(req, res, next) {
  try {
    const { title, body, category, priority, audience, isPinned, publishAt, expiresAt } = req.body;

    const announcement = await Announcement.create({
      title,
      body,
      category,
      priority,
      audience: audience || ['all'],
      isPinned: !!isPinned,
      publishAt: publishAt ? new Date(publishAt) : new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: 'Announcement created successfully',
      announcement,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAnnouncement(req, res, next) {
  try {
    const { id } = req.params;
    const { title, body, category, priority, audience, isPinned, publishAt, expiresAt } = req.body;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      throw ApiError.notFound('Announcement not found');
    }

    if (title !== undefined) announcement.title = title;
    if (body !== undefined) announcement.body = body;
    if (category !== undefined) announcement.category = category;
    if (priority !== undefined) announcement.priority = priority;
    if (audience !== undefined) announcement.audience = audience;
    if (isPinned !== undefined) announcement.isPinned = isPinned;
    if (publishAt !== undefined) announcement.publishAt = new Date(publishAt);
    if (expiresAt !== undefined) {
      announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    await announcement.save();

    res.json({
      message: 'Announcement updated successfully',
      announcement,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAnnouncement(req, res, next) {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByIdAndDelete(id);
    if (!announcement) {
      throw ApiError.notFound('Announcement not found');
    }

    res.json({ message: 'Announcement deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function togglePin(req, res, next) {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      throw ApiError.notFound('Announcement not found');
    }

    announcement.isPinned = !announcement.isPinned;
    await announcement.save();

    res.json({
      message: `Announcement ${announcement.isPinned ? 'pinned' : 'unpinned'} successfully`,
      announcement,
    });
  } catch (err) {
    next(err);
  }
}
