import { Router } from 'express';
import { authenticate, requireRole, requireStaffOrAbove } from '../middleware/auth';
import { uploadAttachment } from '../middleware/upload';
import {
  bookAppointment,
  listMyAppointments,
  getMyAppointment,
  cancelMyAppointment,
  rescheduleMyAppointment,
  listAppointments,
  updateAppointmentStatus,
  getAppointmentQueuePosition,
} from '../controllers/appointments';
import { getAppointmentAttachment } from '../controllers/customers';

const router = Router();

// POST /appointments - Customer: Book
router.post(
  '/',
  authenticate,
  requireRole('customer'),
  (req, res, next) => {
    uploadAttachment(req, res, (err) => {
      if (err) { res.status(400).json({ error: err.message }); return; }
      next();
    });
  },
  bookAppointment
);

// GET /appointments/my - Customer: List mine
router.get('/my', authenticate, requireRole('customer'), listMyAppointments);

// GET /appointments/my/:id - Customer: Get mine
router.get('/my/:id', authenticate, requireRole('customer'), getMyAppointment);

// DELETE /appointments/my/:id - Customer: Cancel mine
router.delete('/my/:id', authenticate, requireRole('customer'), cancelMyAppointment);

// PUT /appointments/my/:id/reschedule - Customer: Reschedule
router.put('/my/:id/reschedule', authenticate, requireRole('customer'), rescheduleMyAppointment);

// GET /appointments - Staff/Manager/Admin: List all (filtered by role)
router.get('/', authenticate, requireStaffOrAbove, listAppointments);

// PUT /appointments/:id/status - Staff/Manager/Admin: Update status
router.put('/:id/status', authenticate, requireStaffOrAbove, updateAppointmentStatus);

// GET /appointments/:id/attachment - Auth: Get attachment
router.get('/:id/attachment', authenticate, getAppointmentAttachment);

// GET /appointments/:id/queue-position - Auth: Get real-time queue position
router.get('/:id/queue-position', authenticate, getAppointmentQueuePosition);

export default router;
