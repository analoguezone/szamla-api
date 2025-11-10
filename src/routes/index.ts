import { Router } from 'express';
import { healthRoutes } from './health.routes';
import organizationRoutes from './organization.routes';
import apiKeyRoutes from './api-key.routes';

const router = Router();

// Mount routes
router.use('/', healthRoutes);
router.use('/organizations', organizationRoutes);
router.use('/api-keys', apiKeyRoutes);

// API routes (to be added)
// router.use('/partners', partnerRoutes);
// router.use('/invoices', invoiceRoutes);
// router.use('/billing', billingRoutes);
// router.use('/nav', navRoutes);

export { router };
