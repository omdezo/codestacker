import { Request, Response } from 'express';
import prisma from '../config/database';
import { createAuditLog } from '../services/auditLog';
import { paginate } from '../utils/pagination';
import { AppointmentStatus, UPDATABLE_STATUSES } from '../utils/roles';
import { todayRange } from '../utils/dateUtils';

// Customer: Book appointment
export async function bookAppointment(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { slotId, notes } = req.body;

  if (!slotId) {
    res.status(400).json({ error: 'slotId is required.' });
    return;
  }

  // Get customer record
  const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
  if (!customer) {
    res.status(403).json({ error: 'Only customers can book appointments.' });
    return;
  }

  // Per-customer daily booking limit
  const { gte: todayStart, lt: todayEnd } = todayRange();
  const dailyLimit = parseInt(process.env.DAILY_BOOKING_LIMIT || '3', 10);
  const dailyBookings = await prisma.appointment.count({
    where: {
      customerId: customer.id,
      createdAt: { gte: todayStart, lt: todayEnd },
      status: { not: AppointmentStatus.CANCELLED },
    },
  });
  if (dailyBookings >= dailyLimit) {
    res.status(429).json({ error: `You have reached the maximum of ${dailyLimit} bookings per day.` });
    return;
  }

  // Check slot not already booked (409 before availability check)
  const existing = await prisma.appointment.findUnique({ where: { slotId } });
  if (existing) {
    res.status(409).json({ error: 'This slot is already booked.' });
    return;
  }

  // Check slot exists, is available, and not soft-deleted
  const slot = await prisma.slot.findFirst({
    where: { id: slotId, isAvailable: true, deletedAt: null },
  });
  if (!slot) {
    res.status(404).json({ error: 'Slot not found or not available.' });
    return;
  }

  const appointment = await prisma.appointment.create({
    data: {
      customerId: customer.id,
      slotId,
      branchId: slot.branchId,
      serviceTypeId: slot.serviceTypeId,
      staffId: slot.staffId || null,
      notes: notes || null,
      attachmentPath: req.file?.path || null,
      status: AppointmentStatus.PENDING,
    },
    include: {
      slot: true,
      branch: true,
      serviceType: true,
      staff: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  // Mark slot as unavailable
  await prisma.slot.update({ where: { id: slotId }, data: { isAvailable: false } });

  await createAuditLog({
    action: 'APPOINTMENT_CREATED',
    actor: user,
    targetType: 'Appointment',
    targetId: appointment.id,
    branchId: slot.branchId,
    metadata: { slotId, serviceTypeId: slot.serviceTypeId },
  });

  res.status(201).json(appointment);
}

// Customer: List my appointments
export async function listMyAppointments(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { skip, take, page, size } = paginate(req.query as Record<string, unknown>);
  const term = (req.query.term as string) || '';

  const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
  if (!customer) {
    res.status(403).json({ error: 'Only customers can list their appointments.' });
    return;
  }

  const where: Record<string, unknown> = { customerId: customer.id };
  if (term) {
    where.OR = [
      { branch: { name: { contains: term, mode: 'insensitive' } } },
      { serviceType: { name: { contains: term, mode: 'insensitive' } } },
      { status: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      skip,
      take,
      include: { slot: true, branch: true, serviceType: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.appointment.count({ where }),
  ]);

  res.json({ results: appointments, total, page, size });
}

// Customer: Get appointment details
export async function getMyAppointment(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;

  const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
  if (!customer) {
    res.status(403).json({ error: 'Only customers can access their appointments.' });
    return;
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, customerId: customer.id },
    include: {
      slot: true,
      branch: true,
      serviceType: true,
      staff: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
    },
  });

  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  res.json(appointment);
}

// Customer: Cancel appointment
export async function cancelMyAppointment(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;

  const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
  if (!customer) {
    res.status(403).json({ error: 'Only customers can cancel their appointments.' });
    return;
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, customerId: customer.id },
  });

  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  if ([AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW].includes(appointment.status as any)) {
    res.status(400).json({ error: `Cannot cancel an appointment with status: ${appointment.status}` });
    return;
  }

  const cancelSlotId = appointment.slotId;
  await prisma.appointment.update({ where: { id }, data: { status: 'CANCELLED', slotId: null } });

  // Free up the slot
  if (cancelSlotId) {
    await prisma.slot.update({ where: { id: cancelSlotId }, data: { isAvailable: true } });
  }

  await createAuditLog({
    action: 'APPOINTMENT_CANCELLED',
    actor: user,
    targetType: 'Appointment',
    targetId: id,
    branchId: appointment.branchId,
    metadata: { previousStatus: appointment.status },
  });

  res.json({ message: 'Appointment cancelled successfully.' });
}

// Customer: Reschedule appointment
export async function rescheduleMyAppointment(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;
  const { newSlotId } = req.body;

  if (!newSlotId) {
    res.status(400).json({ error: 'newSlotId is required.' });
    return;
  }

  const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
  if (!customer) {
    res.status(403).json({ error: 'Only customers can reschedule their appointments.' });
    return;
  }

  // Per-customer daily reschedule limit
  const { gte: todayStart, lt: todayEnd } = todayRange();
  const rescheduleLimit = parseInt(process.env.DAILY_RESCHEDULE_LIMIT || '3', 10);
  const dailyReschedules = await prisma.auditLog.count({
    where: {
      action: 'APPOINTMENT_RESCHEDULED',
      actorId: user.id,
      createdAt: { gte: todayStart, lt: todayEnd },
    },
  });
  if (dailyReschedules >= rescheduleLimit) {
    res.status(429).json({ error: `You have reached the maximum of ${rescheduleLimit} reschedules per day.` });
    return;
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, customerId: customer.id },
  });

  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  if ([AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW].includes(appointment.status as any)) {
    res.status(400).json({ error: `Cannot reschedule an appointment with status: ${appointment.status}` });
    return;
  }

  // Check new slot
  const newSlot = await prisma.slot.findFirst({
    where: { id: newSlotId, isAvailable: true, deletedAt: null },
  });
  if (!newSlot) {
    res.status(404).json({ error: 'New slot not found or not available.' });
    return;
  }

  // New slot must be in the same branch
  if (newSlot.branchId !== appointment.branchId) {
    res.status(400).json({ error: 'New slot must be in the same branch.' });
    return;
  }

  const oldSlotId = appointment.slotId;

  // Update appointment to new slot
  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      slotId: newSlotId,
      staffId: newSlot.staffId || null,
      serviceTypeId: newSlot.serviceTypeId,
    },
  });

  // Free old slot, book new slot
  if (oldSlotId) {
    await prisma.slot.update({ where: { id: oldSlotId }, data: { isAvailable: true } });
  }
  await prisma.slot.update({ where: { id: newSlotId }, data: { isAvailable: false } });

  await createAuditLog({
    action: 'APPOINTMENT_RESCHEDULED',
    actor: user,
    targetType: 'Appointment',
    targetId: id,
    branchId: appointment.branchId,
    metadata: { oldSlotId, newSlotId },
  });

  res.json(updated);
}

// Staff/Manager/Admin: List appointments
export async function listAppointments(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { skip, take, page, size } = paginate(req.query as Record<string, unknown>);
  const term = (req.query.term as string) || '';
  const statusFilter = req.query.status as string;

  let where: Record<string, unknown> = {};

  if (user.role === 'staff') {
    where.staffId = user.staffId;
  } else if (user.role === 'branch_manager') {
    where.branchId = user.branchId;
  }
  // admin sees all

  if (statusFilter) where.status = statusFilter;

  if (term) {
    where.OR = [
      { branch: { name: { contains: term, mode: 'insensitive' } } },
      { serviceType: { name: { contains: term, mode: 'insensitive' } } },
      { customer: { user: { firstName: { contains: term, mode: 'insensitive' } } } },
      { customer: { user: { lastName: { contains: term, mode: 'insensitive' } } } },
      { customer: { user: { email: { contains: term, mode: 'insensitive' } } } },
    ];
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      skip,
      take,
      include: {
        slot: true,
        branch: true,
        serviceType: true,
        customer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        staff: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.appointment.count({ where }),
  ]);

  res.json({ results: appointments, total, page, size });
}

// Staff: Update appointment status
export async function updateAppointmentStatus(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!status || !UPDATABLE_STATUSES.includes(status as any)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${UPDATABLE_STATUSES.join(', ')}` });
    return;
  }

  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  // Staff can only update appointments assigned to them
  if (user.role === 'staff' && appointment.staffId !== user.staffId) {
    res.status(403).json({ error: 'You can only update your own appointments.' });
    return;
  }

  // Branch manager can only update appointments in their branch
  if (user.role === 'branch_manager' && appointment.branchId !== user.branchId) {
    res.status(403).json({ error: 'You can only update appointments in your branch.' });
    return;
  }

  const data: Record<string, unknown> = { status };
  if (notes !== undefined) data.notes = notes;

  const updated = await prisma.appointment.update({ where: { id }, data });

  await createAuditLog({
    action: 'APPOINTMENT_STATUS_UPDATED',
    actor: user,
    targetType: 'Appointment',
    targetId: id,
    branchId: appointment.branchId,
    metadata: { previousStatus: appointment.status, newStatus: status },
  });

  res.json(updated);
}

// Authenticated: Get queue position for a specific appointment
export async function getAppointmentQueuePosition(req: Request, res: Response): Promise<void> {
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

  // Permission checks
  if (user.role === 'customer' && appointment.customer.userId !== user.id) {
    res.status(403).json({ error: 'Insufficient permissions.' });
    return;
  }
  if (user.role === 'branch_manager' && appointment.branchId !== user.branchId) {
    res.status(403).json({ error: 'Insufficient permissions.' });
    return;
  }
  if (user.role === 'staff' && appointment.staffId !== user.staffId) {
    res.status(403).json({ error: 'Insufficient permissions.' });
    return;
  }

  if (![AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(appointment.status as any)) {
    res.json({ appointmentId: id, branchId: appointment.branchId, queuePosition: null, message: 'Appointment is not in active queue.' });
    return;
  }

  // Count active appointments in same branch created before this one
  const position = await prisma.appointment.count({
    where: {
      branchId: appointment.branchId,
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      createdAt: { lt: appointment.createdAt },
    },
  });

  res.json({ appointmentId: id, branchId: appointment.branchId, queuePosition: position + 1 });
}
