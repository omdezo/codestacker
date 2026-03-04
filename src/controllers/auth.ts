import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, firstName, lastName, phone } = req.body;

  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({ error: 'email, password, firstName, and lastName are required.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'ID image is required.' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered.' });
    return;
  }

  const customerRole = await prisma.role.findUnique({ where: { name: 'customer' } });
  if (!customerRole) {
    res.status(500).json({ error: 'Customer role not found. Please run seed first.' });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      firstName,
      lastName,
      roleId: customerRole.id,
      customer: {
        create: {
          phone: phone || null,
          idImagePath: req.file.path,
        },
      },
    },
    include: { customer: true, role: true },
  });

  res.status(201).json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role.name,
    customerId: user.customer?.id,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  // Basic Auth is handled by authenticate middleware
  // If we reach here, user is authenticated
  const user = req.user!;
  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    staffId: user.staffId,
    customerId: user.customerId,
    branchId: user.branchId,
  });
}
