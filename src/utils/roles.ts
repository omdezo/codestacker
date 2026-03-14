import { AuthUser } from '../middleware/auth';

export const AppointmentStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
} as const;

export type AppointmentStatusType = typeof AppointmentStatus[keyof typeof AppointmentStatus];

export const UPDATABLE_STATUSES: AppointmentStatusType[] = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
];

/** Returns true if the user is a branch_manager scoped to a specific branch. */
export function isBranchManager(user: AuthUser): boolean {
  return user.role === 'branch_manager';
}

/** Returns true if the user can access the given branchId (admin bypasses, manager is scoped). */
export function canAccessBranch(user: AuthUser, branchId: string): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'branch_manager') return user.branchId === branchId;
  return false;
}
