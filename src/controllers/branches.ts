import { Request, Response } from 'express';
import prisma from '../config/database';
import { paginate, parseOrder } from '../utils/pagination';

export async function listBranches(req: Request, res: Response): Promise<void> {
  const { skip, take, page, size } = paginate(req.query as Record<string, unknown>);
  const { column, order } = parseOrder(req.query as Record<string, unknown>, ['name', 'location'], 'name');
  const term = (req.query.term as string) || '';

  const where = term
    ? {
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          { location: { contains: term, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [branches, total] = await Promise.all([
    prisma.branch.findMany({ where, skip, take, orderBy: { [column]: order } }),
    prisma.branch.count({ where }),
  ]);

  res.json({ results: branches, total, page, size });
}

export async function getBranch(req: Request, res: Response): Promise<void> {
  const branch = await prisma.branch.findUnique({
    where: { id: req.params.id },
    include: { services: { include: { serviceType: true } } },
  });

  if (!branch) {
    res.status(404).json({ error: 'Branch not found.' });
    return;
  }

  res.json(branch);
}
