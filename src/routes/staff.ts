import { Router } from 'express';
import { authenticate, requireManagerOrAdmin, requireRole } from '../middleware/auth';
import { createStaff, assignStaffToBranch, listStaff, assignStaffToService, removeStaffFromService } from '../controllers/staff';

const router = Router();

// POST /staff - Manager/Admin: Create a new staff member
router.post('/', authenticate, requireManagerOrAdmin, createStaff);

// GET /staff - Manager/Admin
router.get('/', authenticate, requireManagerOrAdmin, listStaff);

// PUT /staff/:staffId/branch - Admin only: Reassign staff to a different branch
router.put('/:staffId/branch', authenticate, requireRole('admin'), assignStaffToBranch);

// POST /staff/:staffId/services - Manager/Admin: Assign to service
router.post('/:staffId/services', authenticate, requireManagerOrAdmin, assignStaffToService);

// DELETE /staff/:staffId/services/:serviceTypeId - Manager/Admin: Remove from service
router.delete('/:staffId/services/:serviceTypeId', authenticate, requireManagerOrAdmin, removeStaffFromService);

export default router;
