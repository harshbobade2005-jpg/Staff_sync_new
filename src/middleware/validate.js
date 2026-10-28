import { ApiError } from '../utils/ApiError.js';

/**
 * Middleware factory — validates req.body against a Zod schema.
 * Puts the parsed result on req.validated.
 */
export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw ApiError.badRequest('Validation failed', errors);
    }
    req.validated = result.data;
    next();
  };
}
