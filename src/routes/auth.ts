import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadIdImage } from '../middleware/upload';
import { register, login } from '../controllers/auth';

const router = Router();

// POST /auth/register - Public, requires ID image upload
router.post('/register', (req, res, next) => {
  uploadIdImage(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}, register);

// POST /auth/login - Basic Auth
router.post('/login', authenticate, login);

export default router;
