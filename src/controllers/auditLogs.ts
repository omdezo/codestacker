import { Request, Response } from 'express';
import { stringify } from 'csv-stringify/sync';
import prisma from '../config/database';

function paginate(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt((query.page as string) || '1', 10));
  const size = Math.max(1, Math.min(100, parseInt((query.size as string) || '20', 10)));
  return { skip: (page - 1) * size, take: size, page, size };
}

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { skip, take, page, size } = paginate(req.query as Record<string, unknown>);
  const term = (req.query.term as string) || '';

  const where: Record<string, unknown> = {};

  if (user.role === 'branch_manager') {
    where.branchId = user.branchId;
  }

  if (term) {
    where.OR = [
      { action: { contains: term, mode: 'insensitive' } },
      { actorRole: { contains: term, mode: 'insensitive' } },
      { targetType: { contains: term, mode: 'insensitive' } },
    ];
  }

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
  const logs = await prisma.auditLog.findMany({
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
