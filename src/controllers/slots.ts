import { Request, Response } from 'express';
import prisma from '../config/database';
import { createAuditLog } from '../services/auditLog';

function paginate(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt((query.page as string) || '1', 10));
  const size = Math.max(1, Math.min(100, parseInt((query.size as string) || '20', 10)));
  return { skip: (page - 1) * size, take: size, page, size };
}

export async function listAvailableSlots(req: Request, res: Response): Promise<void> {
  const { branchId } = req.params;
  const { serviceTypeId, date, term } = req.query as Record<string, string>;
  const { skip, take, page, size } = paginate(req.query as Record<string, unknown>);
  const user = req.user;
  const includeDeleted = user?.role === 'admin' && req.query.includeDeleted === 'true';

  const where: Record<string, unknown> = { branchId };

  if (!includeDeleted) {
    where.isAvailable = true;
    where.deletedAt = null;
    where.startTime = { gte: new Date() };
  }

  if (serviceTypeId) where.serviceTypeId = serviceTypeId;

  if (term) {
    where.OR = [
      { serviceType: { name: { contains: term, mode: 'insensitive' } } },
      { serviceType: { description: { contains: term, mode: 'insensitive' } } },
      { staff: { user: { firstName: { contains: term, mode: 'insensitive' } } } },
      { staff: { user: { lastName: { contains: term, mode: 'insensitive' } } } },
    ];
  }

  if (date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      res.status(400).json({ error: 'Invalid date format.' });
      return;
    }
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    where.startTime = { gte: start, lte: end };
  }

  const [slots, total] = await Promise.all([
    prisma.slot.findMany({
      where,
      skip,
      take,
      include: {
        serviceType: true,
        staff: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { startTime: 'asc' },
    }),
    prisma.slot.count({ where }),
  ]);

  res.json({ results: slots, total, page, size });
}

export async function createSlots(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { branchId } = req.params;

  // Branch manager can only manage their branch
  if (user.role === 'branch_manager' && user.branchId !== branchId) {
    res.status(403).json({ error: 'You can only create slots for your branch.' });
    return;
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    res.status(404).json({ error: 'Branch not found.' });
    return;
  }

  // Accept single slot or array of slots
  const payload = Array.isArray(req.body) ? req.body : [req.body];

  const created = [];
  for (const item of payload) {
    const { serviceTypeId, staffId, startTime, endTime } = item;

    if (!serviceTypeId || !startTime || !endTime) {
      res.status(400).json({ error: 'serviceTypeId, startTime, and endTime are required.' });
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: 'Invalid startTime or endTime.' });
      return;
    }

    if (end <= start) {
      res.status(400).json({ error: 'endTime must be after startTime.' });
      return;
    }

    // Verify service type belongs to this branch
    const bst = await prisma.branchServiceType.findUnique({
      where: { branchId_serviceTypeId: { branchId, serviceTypeId } },
    });
    if (!bst) {
      res.status(400).json({ error: `Service type ${serviceTypeId} not available in this branch.` });
      return;
    }

    // Verify staff belongs to this branch (if provided)
    if (staffId) {
      const staff = await prisma.staff.findFirst({ where: { id: staffId, branchId } });
      if (!staff) {
        res.status(400).json({ error: `Staff ${staffId} not found in this branch.` });
        return;
      }
    }

    const slot = await prisma.slot.create({
      data: { branchId, serviceTypeId, staffId: staffId || null, startTime: start, endTime: end },
    });

    await createAuditLog({
      action: 'SLOT_CREATED',
      actor: user,
      targetType: 'Slot',
      targetId: slot.id,
      branchId,
      metadata: { serviceTypeId, staffId, startTime, endTime },
    });

    created.push(slot);
  }

  res.status(201).json(created.length === 1 ? created[0] : created);
}

export async function updateSlot(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;

  const slot = await prisma.slot.findFirst({ where: { id, deletedAt: null } });
  if (!slot) {
    res.status(404).json({ error: 'Slot not found.' });
    return;
  }

  if (user.role === 'branch_manager' && user.branchId !== slot.branchId) {
    res.status(403).json({ error: 'You can only update slots in your branch.' });
    return;
  }

  const { startTime, endTime, isAvailable, staffId } = req.body;

  const data: Record<string, unknown> = {};
  if (startTime !== undefined) {
    const st = new Date(startTime);
    if (isNaN(st.getTime())) { res.status(400).json({ error: 'Invalid startTime.' }); return; }
    data.startTime = st;
  }
  if (endTime !== undefined) {
    const et = new Date(endTime);
    if (isNaN(et.getTime())) { res.status(400).json({ error: 'Invalid endTime.' }); return; }
    data.endTime = et;
  }
  if (isAvailable !== undefined) data.isAvailable = Boolean(isAvailable);
  if (staffId !== undefined) data.staffId = staffId;

  const updated = await prisma.slot.update({ where: { id }, data });

  await createAuditLog({
    action: 'SLOT_UPDATED',
    actor: user,
    targetType: 'Slot',
    targetId: id,
    branchId: slot.branchId,
    metadata: { changes: data },
  });

  res.json(updated);
}

export async function deleteSlot(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;

  const slot = await prisma.slot.findFirst({ where: { id, deletedAt: null } });
  if (!slot) {
    res.status(404).json({ error: 'Slot not found.' });
    return;
  }

  if (user.role === 'branch_manager' && user.branchId !== slot.branchId) {
    res.status(403).json({ error: 'You can only delete slots in your branch.' });
    return;
  }

  // Soft delete
  await prisma.slot.update({ where: { id }, data: { deletedAt: new Date(), isAvailable: false } });

  await createAuditLog({
    action: 'SLOT_DELETED',
    actor: user,
    targetType: 'Slot',
    targetId: id,
    branchId: slot.branchId,
    metadata: { softDeleted: true },
  });

  res.json({ message: 'Slot deleted successfully.' });
}

export async function cleanupSoftDeletedSlots(req: Request, res: Response): Promise<void> {
  const user = req.user!;

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
    res.json({ message: 'No expired soft-deleted slots to clean up.', deleted: 0 });
    return;
  }

  for (const slot of expired) {
    // Null out the slotId FK and cancel related appointments before hard delete
    await prisma.appointment.updateMany({
      where: { slotId: slot.id },
      data: { slotId: null, status: 'CANCELLED' },
    });

    // Hard delete slot (safe now that FK references are cleared)
    await prisma.slot.delete({ where: { id: slot.id } });

    await createAuditLog({
      action: 'SLOT_HARD_DELETED',
      actor: user,
      targetType: 'Slot',
      targetId: slot.id,
      branchId: slot.branchId,
      metadata: { reason: 'Retention period exceeded', retentionDays },
    });
  }

  res.json({ message: `Hard-deleted ${expired.length} expired slots.`, deleted: expired.length });
}
