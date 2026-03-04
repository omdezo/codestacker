import { Router } from 'express';
import { listBranches, getBranch } from '../controllers/branches';

const router = Router();

// GET /branches - Public
router.get('/', listBranches);

// GET /branches/:id - Public
router.get('/:id', getBranch);

export default router;
