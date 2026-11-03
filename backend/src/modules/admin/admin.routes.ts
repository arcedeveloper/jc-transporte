import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { dashboardRouter } from './dashboard.js';
import { busesRouter } from './buses.js';
import { routesAdminRouter } from './routes-admin.js';
import { tripsAdminRouter } from './trips-admin.js';
import { bookingsAdminRouter } from './bookings-admin.js';
import { settingsAdminRouter } from './settings-admin.js';
import { usersAdminRouter } from './users-admin.js';
import { suggestionsAdminRouter } from './suggestions-admin.js';
import { expensesAdminRouter, financeAdminRouter } from './finance-admin.js';
import { groupRequestsAdminRouter } from './group-requests-admin.js';

/** Todo lo que cuelga de /api/admin exige sesión de admin. */
export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'));
adminRouter.use('/dashboard', dashboardRouter);
adminRouter.use('/buses', busesRouter);
adminRouter.use('/routes', routesAdminRouter);
adminRouter.use('/trips', tripsAdminRouter);
adminRouter.use('/bookings', bookingsAdminRouter);
adminRouter.use('/settings', settingsAdminRouter);
adminRouter.use('/users', usersAdminRouter);
adminRouter.use('/group-requests', groupRequestsAdminRouter);
adminRouter.use('/suggestions', suggestionsAdminRouter);
adminRouter.use('/expenses', expensesAdminRouter);
adminRouter.use('/finance', financeAdminRouter);
