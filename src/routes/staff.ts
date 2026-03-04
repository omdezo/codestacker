import { Router } from 'express';
import { authenticate, requireManagerOrAdmin } from '../middleware/auth';
import { listStaff, assignStaffToService, removeStaffFromService } from '../controllers/staff';

const router = Router();

// GET /staff - Manager/Admin
router.get('/', authenticate, requireManagerOrAdmin, listStaff);

// POST /staff/:staffId/services - Manager/Admin: Assign to service
router.post('/:staffId/services', authenticate, requireManagerOrAdmin, assignStaffToService);

// DELETE /staff/:staffId/services/:serviceTypeId - Manager/Admin: Remove from service
router.delete('/:staffId/services/:serviceTypeId', authenticate, requireManagerOrAdmin, removeStaffFromService);

export default router;
