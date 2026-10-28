import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { getDBStatus } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import departmentRoutes from './routes/department.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import leaveTypeRoutes from './routes/leaveType.routes.js';
import holidayRoutes from './routes/holiday.routes.js';
import leaveRoutes from './routes/leave.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import announcementRoutes from './routes/announcement.routes.js';
import trainingRoutes from './routes/training.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", env.CLIENT_ORIGIN],
        },
      },
    })
  );
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Request logging (dev only)
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Global rate limit: 300 req / 15 min / IP in prod (5000 in dev/test)
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: env.NODE_ENV === 'production' ? 300 : 5000,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Stricter rate limit on login: 10 / 15 min / IP in prod (1000 in dev/test)
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: env.NODE_ENV === 'production' ? 10 : 1000,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Too many login attempts. Please try again in a few minutes.' },
    })
  );

  // Health check
  app.get('/api/health', (_req, res) => {
    const dbStatus = getDBStatus();
    const status = dbStatus === 'connected' ? 200 : 503;
    res.status(status).json({ status: 'ok', db: dbStatus });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/leave-types', leaveTypeRoutes);
  app.use('/api/holidays', holidayRoutes);
  app.use('/api/leaves', leaveRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/announcements', announcementRoutes);
  app.use('/api/training', trainingRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Production static client serving
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // Express 5 catch-all splat for SPA routing on non-API paths
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  // 404 + error handler
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
