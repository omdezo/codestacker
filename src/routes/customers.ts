import { Router } from 'express';
import { authenticate, requireManagerOrAdmin, requireRole } from '../middleware/auth';
import { listCustomers, getCustomer, getCustomerIdImage } from '../controllers/customers';

const router = Router();

// GET /customers - Manager/Admin
router.get('/', authenticate, requireManagerOrAdmin, listCustomers);

// GET /customers/:id - Manager/Admin
router.get('/:id', authenticate, requireManagerOrAdmin, getCustomer);

// GET /customers/:id/id-image - Admin only
router.get('/:id/id-image', authenticate, requireRole('admin'), getCustomerIdImage);

export default router;
