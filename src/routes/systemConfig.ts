import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getRetentionPeriod, setRetentionPeriod, getQueuePosition } from '../controllers/systemConfig';

const router = Router();

// GET /config/retention - Admin
router.get('/retention', authenticate, requireRole('admin'), getRetentionPeriod);

// PUT /config/retention - Admin: Configure retention period
router.put('/retention', authenticate, requireRole('admin'), setRetentionPeriod);

// GET /config/queue/:branchId - Authenticated: Queue position
router.get('/queue/:branchId', authenticate, getQueuePosition);

export default router;
