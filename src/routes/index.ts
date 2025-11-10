import { Router } from 'express';
import { healthRoutes } from './health.routes';
import organizationRoutes from './organization.routes';
import apiKeyRoutes from './api-key.routes';
import partnerRoutes from './partner.routes';
import invoiceRoutes from './invoice.routes';
import navRoutes from './nav.routes';
import billingRoutes from './billing.routes';

const router = Router();

// Mount routes
router.use('/', healthRoutes);
router.use('/organizations', organizationRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/partners', partnerRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/nav', navRoutes);
router.use('/billing', billingRoutes);

export { router };
