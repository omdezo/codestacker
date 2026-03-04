import { Request, Response } from 'express';
import prisma from '../config/database';

export async function getRetentionPeriod(req: Request, res: Response): Promise<void> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: 'soft_delete_retention_days' },
  });
  res.json({ soft_delete_retention_days: parseInt(config?.value || '30', 10) });
}

export async function setRetentionPeriod(req: Request, res: Response): Promise<void> {
  const { days } = req.body;

  if (days === undefined || isNaN(parseInt(days, 10)) || parseInt(days, 10) < 1) {
    res.status(400).json({ error: 'days must be a positive integer.' });
    return;
  }

  const config = await prisma.systemConfig.upsert({
    where: { key: 'soft_delete_retention_days' },
    update: { value: String(parseInt(days, 10)) },
    create: { key: 'soft_delete_retention_days', value: String(parseInt(days, 10)) },
  });

  res.json({ soft_delete_retention_days: parseInt(config.value, 10) });
}

export async function getQueuePosition(req: Request, res: Response): Promise<void> {
  const { branchId } = req.params;

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    res.status(404).json({ error: 'Branch not found.' });
    return;
  }

  const count = await prisma.appointment.count({
    where: {
      branchId,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
  });

  res.json({ branchId, branchName: branch.name, activeQueueCount: count });
}
