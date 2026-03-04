import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  staffId?: string;
  customerId?: string;
  branchId?: string;
  isManager?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.status(401).json({ error: 'Authentication required. Use Basic Auth.' });
    return;
  }

  const base64 = authHeader.slice(6);
  let decoded: string;
  try {
    decoded = Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    res.status(401).json({ error: 'Invalid authorization header.' });
    return;
  }

  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) {
    res.status(401).json({ error: 'Invalid authorization format. Use email:password.' });
    return;
  }

  const email = decoded.slice(0, colonIndex);
  const password = decoded.slice(colonIndex + 1);

  if (!email || !password) {
    res.status(401).json({ error: 'Email and password required.' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: true,
      staff: true,
      customer: true,
    },
  });

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role.name,
    staffId: user.staff?.id,
    customerId: user.customer?.id,
    branchId: user.staff?.branchId,
    isManager: user.staff?.isManager,
  };

  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions.' });
      return;
    }
    next();
  };
}

export function requireManagerOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const { role } = req.user;
  if (role !== 'admin' && role !== 'branch_manager') {
    res.status(403).json({ error: 'Insufficient permissions.' });
    return;
  }
  next();
}

export function requireStaffOrAbove(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const { role } = req.user;
  if (!['admin', 'branch_manager', 'staff'].includes(role)) {
    res.status(403).json({ error: 'Insufficient permissions.' });
    return;
  }
  next();
}
