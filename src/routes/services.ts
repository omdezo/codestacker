import { Router } from 'express';
import { listServicesByBranch } from '../controllers/services';

const router = Router();

// GET /branches/:branchId/services - Public
router.get('/:branchId/services', listServicesByBranch);

export default router;
