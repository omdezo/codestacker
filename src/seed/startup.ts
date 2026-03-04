/**
 * Startup seeder - called automatically when the server starts.
 * Runs idempotently: safe to call multiple times.
 */
import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import seedData from './seed.json';

export default async function runStartupSeed() {
  console.log('[Seed] Checking seed data...');

  // 1. Roles
  for (const role of seedData.roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: {},
      create: { id: role.id, name: role.name },
    });
  }

  // 2. System config
  for (const config of seedData.systemConfig) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: { key: config.key, value: config.value },
    });
  }

  // 3. Admin user
  const adminHashedPw = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || seedData.admin.password,
    10
  );
  await prisma.user.upsert({
    where: { id: seedData.admin.id },
    update: {},
    create: {
      id: seedData.admin.id,
      email: process.env.ADMIN_EMAIL || seedData.admin.email,
      password: adminHashedPw,
      firstName: seedData.admin.firstName,
      lastName: seedData.admin.lastName,
      roleId: seedData.admin.roleId,
    },
  });

  // 4. Branches
  for (const branch of seedData.branches) {
    await prisma.branch.upsert({
      where: { id: branch.id },
      update: {},
      create: {
        id: branch.id,
        name: branch.name,
        location: branch.location,
        phone: branch.phone,
      },
    });
  }

  // 5. Service types
  for (const svc of seedData.serviceTypes) {
    await prisma.serviceType.upsert({
      where: { id: svc.id },
      update: {},
      create: {
        id: svc.id,
        name: svc.name,
        description: svc.description,
        duration: svc.duration,
      },
    });
  }

  // 6. Branch service types
  for (const bst of seedData.branchServiceTypes) {
    await prisma.branchServiceType.upsert({
      where: {
        branchId_serviceTypeId: {
          branchId: bst.branchId,
          serviceTypeId: bst.serviceTypeId,
        },
      },
      update: {},
      create: { branchId: bst.branchId, serviceTypeId: bst.serviceTypeId },
    });
  }

  // 7. Staff
  for (const s of seedData.staff) {
    const hashed = await bcrypt.hash(s.password, 10);
    await prisma.user.upsert({
      where: { id: s.userId },
      update: {},
      create: {
        id: s.userId,
        email: s.email,
        password: hashed,
        firstName: s.firstName,
        lastName: s.lastName,
        roleId: s.roleId,
      },
    });

    await prisma.staff.upsert({
      where: { id: s.staffId },
      update: {},
      create: {
        id: s.staffId,
        userId: s.userId,
        branchId: s.branchId,
        isManager: s.isManager,
      },
    });

    for (const svcId of s.serviceTypes) {
      await prisma.staffServiceType.upsert({
        where: { staffId_serviceTypeId: { staffId: s.staffId, serviceTypeId: svcId } },
        update: {},
        create: { staffId: s.staffId, serviceTypeId: svcId },
      });
    }
  }

  // 8. Slots for next 5 days (idempotent)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  type SlotTemplate = {
    branchId: string;
    serviceTypeId: string;
    staffId: string;
    dayOffset: number;
    hour: number;
    minute: number;
    duration: number;
  };

  const muscatTemplates = [
    { branchId: 'branch-muscat', serviceTypeId: 'svc-general-consult', staffId: 'staff-muscat1', hour: 9, minute: 0, duration: 30 },
    { branchId: 'branch-muscat', serviceTypeId: 'svc-general-consult', staffId: 'staff-muscat1', hour: 9, minute: 30, duration: 30 },
    { branchId: 'branch-muscat', serviceTypeId: 'svc-general-consult', staffId: 'staff-muscat1', hour: 10, minute: 0, duration: 30 },
    { branchId: 'branch-muscat', serviceTypeId: 'svc-blood-test', staffId: 'staff-muscat2', hour: 8, minute: 0, duration: 15 },
    { branchId: 'branch-muscat', serviceTypeId: 'svc-blood-test', staffId: 'staff-muscat2', hour: 8, minute: 15, duration: 15 },
    { branchId: 'branch-muscat', serviceTypeId: 'svc-xray', staffId: 'staff-muscat2', hour: 11, minute: 0, duration: 20 },
    { branchId: 'branch-muscat', serviceTypeId: 'svc-dental', staffId: 'staff-muscat3', hour: 10, minute: 0, duration: 45 },
  ];

  const salalahTemplates = [
    { branchId: 'branch-salalah', serviceTypeId: 'svc-general-consult', staffId: 'staff-salalah1', hour: 9, minute: 0, duration: 30 },
    { branchId: 'branch-salalah', serviceTypeId: 'svc-general-consult', staffId: 'staff-salalah1', hour: 9, minute: 30, duration: 30 },
    { branchId: 'branch-salalah', serviceTypeId: 'svc-blood-test', staffId: 'staff-salalah2', hour: 8, minute: 0, duration: 15 },
    { branchId: 'branch-salalah', serviceTypeId: 'svc-eye-exam', staffId: 'staff-salalah2', hour: 10, minute: 0, duration: 30 },
    { branchId: 'branch-salalah', serviceTypeId: 'svc-pharmacy', staffId: 'staff-salalah3', hour: 8, minute: 0, duration: 10 },
    { branchId: 'branch-salalah', serviceTypeId: 'svc-pharmacy', staffId: 'staff-salalah3', hour: 8, minute: 10, duration: 10 },
  ];

  const allTemplates: SlotTemplate[] = [];
  for (let day = 1; day <= 5; day++) {
    for (const t of muscatTemplates) allTemplates.push({ ...t, dayOffset: day });
    for (const t of salalahTemplates) allTemplates.push({ ...t, dayOffset: day });
  }

  let newSlots = 0;
  for (const tmpl of allTemplates) {
    const startTime = new Date(today);
    startTime.setDate(startTime.getDate() + tmpl.dayOffset);
    startTime.setHours(tmpl.hour, tmpl.minute, 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + tmpl.duration);

    const existing = await prisma.slot.findFirst({
      where: {
        branchId: tmpl.branchId,
        serviceTypeId: tmpl.serviceTypeId,
        staffId: tmpl.staffId,
        startTime,
        deletedAt: null,
      },
    });

    if (!existing) {
      await prisma.slot.create({
        data: {
          branchId: tmpl.branchId,
          serviceTypeId: tmpl.serviceTypeId,
          staffId: tmpl.staffId,
          startTime,
          endTime,
          isAvailable: true,
        },
      });
      newSlots++;
    }
  }

  console.log(`[Seed] Done. ${newSlots} new slots created.`);
}
