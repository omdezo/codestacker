import prisma from '../config/database';
import { AuthUser } from '../middleware/auth';

export async function createAuditLog(params: {
  action: string;
  actor: AuthUser;
  targetType: string;
  targetId: string;
  branchId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      action: params.action,
      actorId: params.actor.id,
      actorRole: params.actor.role,
      targetType: params.targetType,
      targetId: params.targetId,
      branchId: params.branchId || null,
      metadata: params.metadata as object | undefined,
    },
  });
}
