import { Request, Response } from 'express';
import prisma from '../config/database';
import { createAuditLog } from '../services/auditLog';

function paginate(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt((query.page as string) || '1', 10));
  const size = Math.max(1, Math.min(100, parseInt((query.size as string) || '20', 10)));
  return { skip: (page - 1) * size, take: size, page, size };
}

export async function listStaff(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { skip, take, page, size } = paginate(req.query as Record<string, unknown>);
  const term = (req.query.term as string) || '';

  const where: Record<string, unknown> = {};

  if (user.role === 'branch_manager') {
    where.branchId = user.branchId;
  }

  if (term) {
    where.OR = [
      { user: { firstName: { contains: term, mode: 'insensitive' } } },
      { user: { lastName: { contains: term, mode: 'insensitive' } } },
      { user: { email: { contains: term, mode: 'insensitive' } } },
      { branch: { name: { contains: term, mode: 'insensitive' } } },
    ];
  }

  const [staff, total] = await Promise.all([
    prisma.staff.findMany({
      where,
      skip,
      take,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        serviceTypes: { include: { serviceType: true } },
      },
      orderBy: { user: { firstName: 'asc' } },
    }),
    prisma.staff.count({ where }),
  ]);

  res.json({ results: staff, total, page, size });
}

export async function assignStaffToService(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { staffId } = req.params;
  const { serviceTypeId } = req.body;

  if (!serviceTypeId) {
    res.status(400).json({ error: 'serviceTypeId is required.' });
    return;
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) {
    res.status(404).json({ error: 'Staff not found.' });
    return;
  }

  // Branch manager can only assign staff in their branch
  if (user.role === 'branch_manager' && staff.branchId !== user.branchId) {
    res.status(403).json({ error: 'You can only assign staff in your branch.' });
    return;
  }

  // Verify service type exists in the branch
  const bst = await prisma.branchServiceType.findUnique({
    where: { branchId_serviceTypeId: { branchId: staff.branchId, serviceTypeId } },
  });
  if (!bst) {
    res.status(400).json({ error: 'Service type not available in this branch.' });
    return;
  }

  const assignment = await prisma.staffServiceType.upsert({
    where: { staffId_serviceTypeId: { staffId, serviceTypeId } },
    update: {},
    create: { staffId, serviceTypeId },
    include: { serviceType: true },
  });

  await createAuditLog({
    action: 'STAFF_ASSIGNED_TO_SERVICE',
    actor: user,
    targetType: 'Staff',
    targetId: staffId,
    branchId: staff.branchId,
    metadata: { serviceTypeId },
  });

  res.status(201).json(assignment);
}

export async function removeStaffFromService(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { staffId, serviceTypeId } = req.params;

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) {
    res.status(404).json({ error: 'Staff not found.' });
    return;
  }

  if (user.role === 'branch_manager' && staff.branchId !== user.branchId) {
    res.status(403).json({ error: 'You can only manage staff in your branch.' });
    return;
  }

  const assignment = await prisma.staffServiceType.findUnique({
    where: { staffId_serviceTypeId: { staffId, serviceTypeId } },
  });
  if (!assignment) {
    res.status(404).json({ error: 'Assignment not found.' });
    return;
  }

  await prisma.staffServiceType.delete({
    where: { staffId_serviceTypeId: { staffId, serviceTypeId } },
  });

  await createAuditLog({
    action: 'STAFF_REMOVED_FROM_SERVICE',
    actor: user,
    targetType: 'Staff',
    targetId: staffId,
    branchId: staff.branchId,
    metadata: { serviceTypeId },
  });

  res.json({ message: 'Staff removed from service successfully.' });
}
