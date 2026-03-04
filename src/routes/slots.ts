import { Router } from 'express';
import { authenticate, requireManagerOrAdmin } from '../middleware/auth';
import {
  listAvailableSlots,
  createSlots,
  updateSlot,
  deleteSlot,
  cleanupSoftDeletedSlots,
} from '../controllers/slots';

const router = Router();

// GET /branches/:branchId/slots - Public
router.get('/:branchId/slots', listAvailableSlots);

// POST /branches/:branchId/slots - Manager/Admin
router.post('/:branchId/slots', authenticate, requireManagerOrAdmin, createSlots);

// PUT /branches/slots/:id - Manager/Admin
router.put('/slots/:id', authenticate, requireManagerOrAdmin, updateSlot);

// DELETE /branches/slots/:id - Manager/Admin (soft delete)
router.delete('/slots/:id', authenticate, requireManagerOrAdmin, deleteSlot);

// POST /branches/slots/cleanup - Admin only
router.post('/slots/cleanup', authenticate, (req, res, next) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin only.' });
    return;
  }
  next();
}, cleanupSoftDeletedSlots);

export default router;
