import { Request, Response } from 'express';
import prisma from '../config/database';
import { paginate } from '../utils/pagination';

export async function listServicesByBranch(req: Request, res: Response): Promise<void> {
  const { branchId } = req.params;
  const { skip, take, page, size } = paginate(req.query as Record<string, unknown>);
  const term = (req.query.term as string) || '';

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    res.status(404).json({ error: 'Branch not found.' });
    return;
  }

  const where = {
    branchId,
    ...(term
      ? {
          serviceType: {
            OR: [
              { name: { contains: term, mode: 'insensitive' as const } },
              { description: { contains: term, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  };

  const [records, total] = await Promise.all([
    prisma.branchServiceType.findMany({
      where,
      skip,
      take,
      include: { serviceType: true },
      orderBy: { serviceType: { name: 'asc' } },
    }),
    prisma.branchServiceType.count({ where }),
  ]);

  res.json({
    results: records.map((r: typeof records[number]) => r.serviceType),
    total,
    page,
    size,
  });
}
