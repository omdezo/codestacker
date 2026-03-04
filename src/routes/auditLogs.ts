import { Router } from 'express';
import { authenticate, requireManagerOrAdmin, requireRole } from '../middleware/auth';
import { listAuditLogs, exportAuditLogsCsv } from '../controllers/auditLogs';

const router = Router();

// GET /audit-logs - Manager (branch-only) / Admin (all)
router.get('/', authenticate, requireManagerOrAdmin, listAuditLogs);

// GET /audit-logs/export - Admin: Export CSV
router.get('/export', authenticate, requireRole('admin'), exportAuditLogsCsv);

export default router;
