import { Router } from 'express';
import authRoutes from './auth';
import branchRoutes from './branches';
import serviceRoutes from './services';
import slotRoutes from './slots';
import appointmentRoutes from './appointments';
import staffRoutes from './staff';
import customerRoutes from './customers';
import auditLogRoutes from './auditLogs';
import configRoutes from './systemConfig';

const router = Router();

router.use('/auth', authRoutes);
router.use('/branches', branchRoutes);
router.use('/branches', serviceRoutes);
router.use('/branches', slotRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/staff', staffRoutes);
router.use('/customers', customerRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/config', configRoutes);

export default router;
