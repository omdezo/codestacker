import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import prisma from './config/database';
import routes from './routes/index';
import { createAuditLog } from './services/auditLog';

// Ensure upload directories exist
const uploadDir = process.env.UPLOAD_DIR || './uploads';
['id-images', 'attachments'].forEach((sub) => {
  const dir = path.join(uploadDir, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for booking endpoints
const bookingLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_BOOKINGS || '5', 10),
  message: { error: 'Too many booking requests. Please try again later.' },
  skip: (req) => !['POST', 'PUT'].includes(req.method),
});
app.use('/api/appointments', bookingLimiter);

// API routes
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

// Background cron: hard-delete expired soft-deleted slots (runs daily at midnight)
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Running soft-delete cleanup...');

  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'soft_delete_retention_days' },
    });
    const retentionDays = parseInt(config?.value || '30', 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const expired = await prisma.slot.findMany({
      where: { deletedAt: { not: null, lte: cutoff } },
      select: { id: true, branchId: true },
    });

    if (expired.length === 0) {
      console.log('[Cron] No expired slots to clean up.');
      return;
    }

    const adminUser = await prisma.user.findFirst({
      where: { role: { name: 'admin' } },
    });

    for (const slot of expired) {
      await prisma.appointment.updateMany({
        where: { slotId: slot.id },
        data: { status: 'CANCELLED' },
      });

      await prisma.slot.delete({ where: { id: slot.id } });

      if (adminUser) {
        await prisma.auditLog.create({
          data: {
            action: 'SLOT_HARD_DELETED',
            actorId: adminUser.id,
            actorRole: 'admin',
            targetType: 'Slot',
            targetId: slot.id,
            branchId: slot.branchId,
            metadata: { reason: 'Cron cleanup - retention period exceeded', retentionDays },
          },
        });
      }
    }

    console.log(`[Cron] Hard-deleted ${expired.length} expired slots.`);
  } catch (err) {
    console.error('[Cron] Cleanup error:', err);
  }
});

// Start server + auto-seed
async function main() {
  try {
    // Run seed on startup
    const { default: seed } = await import('./seed/startup');
    await seed();

    app.listen(PORT, () => {
      console.log(`FlowCare API running on http://localhost:${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
