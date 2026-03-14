import { Request, Response } from 'express';
import { stringify } from 'csv-stringify/sync';
import prisma from '../config/database';
import { paginate } from '../utils/pagination';

function buildAuditWhere(user: Express.Request['user'], query: Record<string, unknown>): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (user!.role === 'branch_manager') {
    where.branchId = user!.branchId;
  }

  const { term, from, to, actorId, targetId } = query as Record<string, string>;

  if (term) {
    where.OR = [
      { action: { contains: term, mode: 'insensitive' } },
      { actorRole: { contains: term, mode: 'insensitive' } },
      { targetType: { contains: term, mode: 'insensitive' } },
    ];
  }

  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to);
    where.createdAt = createdAt;
  }

  if (actorId) where.actorId = actorId;
  if (targetId) where.targetId = targetId;

  return where;
}

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { skip, take, page, size } = paginate(req.query as Record<string, unknown>);
  const where = buildAuditWhere(user, req.query as Record<string, unknown>);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ results: logs, total, page, size });
}

export async function exportAuditLogsCsv(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const where = buildAuditWhere(user, req.query as Record<string, unknown>);

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      actor: { select: { email: true, firstName: true, lastName: true } },
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows = logs.map((log: typeof logs[number]) => ({
    id: log.id,
    action: log.action,
    actorEmail: log.actor.email,
    actorName: `${log.actor.firstName} ${log.actor.lastName}`,
    actorRole: log.actorRole,
    targetType: log.targetType,
    targetId: log.targetId,
    branchName: log.branch?.name || '',
    metadata: log.metadata ? JSON.stringify(log.metadata) : '',
    createdAt: log.createdAt.toISOString(),
  }));

  const csv = stringify(rows, { header: true });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
  res.send(csv);
}
