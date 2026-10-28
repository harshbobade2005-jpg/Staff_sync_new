import * as trainingService from '../services/training.service.js';

export async function createProgram(req, res, next) {
  try {
    const program = await trainingService.createProgram(req.user._id, req.body);
    res.status(201).json({ success: true, program });
  } catch (err) {
    next(err);
  }
}

export async function getPrograms(req, res, next) {
  try {
    const result = await trainingService.getPrograms(req.user, req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getProgramById(req, res, next) {
  try {
    const result = await trainingService.getProgramById(req.user, req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateProgram(req, res, next) {
  try {
    const program = await trainingService.updateProgram(req.user._id, req.params.id, req.body);
    res.json({ success: true, program });
  } catch (err) {
    next(err);
  }
}

export async function updateProgramStatus(req, res, next) {
  try {
    const program = await trainingService.updateProgramStatus(req.user._id, req.params.id, req.body.status);
    res.json({ success: true, program });
  } catch (err) {
    next(err);
  }
}

export async function deleteProgram(req, res, next) {
  try {
    const result = await trainingService.deleteProgram(req.user._id, req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function enrollEmployees(req, res, next) {
  try {
    const enrollments = await trainingService.enrollEmployees(
      req.user._id,
      req.params.id,
      req.body.userIds
    );
    res.status(201).json({ success: true, enrollments, count: enrollments.length });
  } catch (err) {
    next(err);
  }
}

export async function dropEnrollment(req, res, next) {
  try {
    const result = await trainingService.dropEnrollment(
      req.user._id,
      req.params.id,
      req.params.userId
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getMyEnrollments(req, res, next) {
  try {
    const enrollments = await trainingService.getMyEnrollments(req.user);
    res.json({ success: true, enrollments });
  } catch (err) {
    next(err);
  }
}

export async function getUserEnrollments(req, res, next) {
  try {
    const enrollments = await trainingService.getUserEnrollments(req.user, req.params.userId);
    res.json({ success: true, enrollments });
  } catch (err) {
    next(err);
  }
}

export async function updateEnrollment(req, res, next) {
  try {
    const enrollment = await trainingService.updateEnrollment(req.user, req.params.id, req.body);
    res.json({ success: true, enrollment });
  } catch (err) {
    next(err);
  }
}

export async function getTrainingSummary(req, res, next) {
  try {
    const summary = await trainingService.getTrainingSummary(req.user);
    res.json({ success: true, summary });
  } catch (err) {
    next(err);
  }
}
