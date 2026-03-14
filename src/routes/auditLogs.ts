import { Router } from 'express';
import { authenticate, requireManagerOrAdmin, requireRole } from '../middleware/auth';
import { listAuditLogs, listAuditLogsCursor, exportAuditLogsCsv, paginationDemo } from '../controllers/auditLogs';

const router = Router();

// GET /audit-logs          - Offset pagination. Returns total count. Degrades at deep pages.
router.get('/', authenticate, requireManagerOrAdmin, listAuditLogs);

// GET /audit-logs/cursor   - Cursor pagination. No total. O(log n) at any depth.
router.get('/cursor', authenticate, requireManagerOrAdmin, listAuditLogsCursor);

// GET /audit-logs/demo     - Live side-by-side benchmark of offset vs cursor
router.get('/demo', authenticate, requireManagerOrAdmin, paginationDemo);

// GET /audit-logs/export   - Admin only: export filtered CSV
router.get('/export', authenticate, requireRole('admin'), exportAuditLogsCsv);

export default router;
