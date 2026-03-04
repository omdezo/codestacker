import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../config/database';

function paginate(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt((query.page as string) || '1', 10));
  const size = Math.max(1, Math.min(100, parseInt((query.size as string) || '20', 10)));
  return { skip: (page - 1) * size, take: size, page, size };
}

export async function listCustomers(req: Request, res: Response): Promise<void> {
  const { skip, take, page, size } = paginate(req.query as Record<string, unknown>);
  const term = (req.query.term as string) || '';

  const where = term
    ? {
        OR: [
          { user: { firstName: { contains: term, mode: 'insensitive' as const } } },
          { user: { lastName: { contains: term, mode: 'insensitive' as const } } },
          { user: { email: { contains: term, mode: 'insensitive' as const } } },
          { phone: { contains: term, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({
    results: customers.map((c) => ({
      id: c.id,
      userId: c.userId,
      phone: c.phone,
      createdAt: c.createdAt,
      user: c.user,
    })),
    total,
    page,
    size,
  });
}

export async function getCustomer(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, createdAt: true } },
    },
  });

  if (!customer) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }

  res.json({
    id: customer.id,
    userId: customer.userId,
    phone: customer.phone,
    idImagePath: customer.idImagePath,
    createdAt: customer.createdAt,
    user: customer.user,
  });
}

export async function getCustomerIdImage(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }

  const filePath = path.resolve(customer.idImagePath);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'ID image file not found.' });
    return;
  }

  res.sendFile(filePath);
}

export async function getAppointmentAttachment(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { customer: true },
  });

  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  // Only the customer who created it or staff/manager/admin
  if (
    user.role === 'customer' &&
    appointment.customer.userId !== user.id
  ) {
    res.status(403).json({ error: 'Insufficient permissions.' });
    return;
  }

  if (!appointment.attachmentPath) {
    res.status(404).json({ error: 'No attachment for this appointment.' });
    return;
  }

  const filePath = path.resolve(appointment.attachmentPath);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Attachment file not found.' });
    return;
  }

  res.sendFile(filePath);
}
