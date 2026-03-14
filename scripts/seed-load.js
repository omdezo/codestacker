/**
 * Load-test seed: inserts 1,000,000 audit log rows + 10,000 customers.
 * Run AFTER the normal seed (npm run db:seed) so admin + branches exist.
 *
 * Usage:
 *   node scripts/seed-load.js
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const prisma = new PrismaClient();

const AUDIT_COUNT    = 1_000_000;
const CUSTOMER_COUNT = 10_000;
const BATCH          = 5_000;

const ACTIONS      = ['APPOINTMENT_CREATED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_STATUS_UPDATED',
                      'SLOT_CREATED', 'SLOT_UPDATED', 'SLOT_DELETED', 'STAFF_CREATED'];
const TARGET_TYPES = ['Appointment', 'Slot', 'Staff', 'Customer'];

async function main() {
  console.time('total');

  const admin = await prisma.user.findFirst({ include: { role: true } });
  if (!admin) throw new Error('No users found — run: npm run db:seed first.');

  const branches = await prisma.branch.findMany({ select: { id: true } });
  if (!branches.length) throw new Error('No branches found — run: npm run db:seed first.');

  const customerRole = await prisma.role.findUnique({ where: { name: 'customer' } });
  if (!customerRole) throw new Error('customer role not found.');

  console.log(`Using actor: ${admin.email}, ${branches.length} branches\n`);

  // ── 10 000 customers ────────────────────────────────────────────────────────
  console.log(`Creating ${CUSTOMER_COUNT.toLocaleString()} customers…`);
  console.time('customers');
  let inserted = 0;
  while (inserted < CUSTOMER_COUNT) {
    const n = Math.min(BATCH, CUSTOMER_COUNT - inserted);
    const users = Array.from({ length: n }, (_, i) => ({
      id: uuidv4(),
      email: `loadtest_${inserted + i}_${Date.now()}@test.com`,
      password: '$2a$10$placeholder_not_real_hash',
      firstName: `Load`,
      lastName: `User${inserted + i}`,
      roleId: customerRole.id,
    }));
    await prisma.user.createMany({ data: users, skipDuplicates: true });
    await prisma.customer.createMany({
      data: users.map(u => ({
        id: uuidv4(),
        userId: u.id,
        phone: null,
        idImagePath: './uploads/placeholder.jpg',
      })),
      skipDuplicates: true,
    });
    inserted += n;
    process.stdout.write(`\r  ${inserted.toLocaleString()}/${CUSTOMER_COUNT.toLocaleString()}`);
  }
  console.log();
  console.timeEnd('customers');

  // ── 1 000 000 audit logs ────────────────────────────────────────────────────
  console.log(`\nCreating ${AUDIT_COUNT.toLocaleString()} audit logs…`);
  console.time('audit_logs');
  const NOW      = Date.now();
  const YEAR_MS  = 365 * 24 * 60 * 60 * 1000;
  inserted = 0;

  while (inserted < AUDIT_COUNT) {
    const n = Math.min(BATCH, AUDIT_COUNT - inserted);
    const data = Array.from({ length: n }, (_, i) => {
      const idx = inserted + i;
      return {
        id:         uuidv4(),
        action:     ACTIONS[idx % ACTIONS.length],
        actorId:    admin.id,
        actorRole:  admin.role.name,
        targetType: TARGET_TYPES[idx % TARGET_TYPES.length],
        targetId:   uuidv4(),
        branchId:   branches[idx % branches.length].id,
        createdAt:  new Date(NOW - Math.floor(Math.random() * YEAR_MS)),
      };
    });
    await prisma.auditLog.createMany({ data, skipDuplicates: true });
    inserted += n;
    if (inserted % 50_000 === 0 || inserted === AUDIT_COUNT) {
      process.stdout.write(`\r  ${inserted.toLocaleString()}/${AUDIT_COUNT.toLocaleString()} (${Math.round(inserted / AUDIT_COUNT * 100)}%)`);
    }
  }
  console.log();
  console.timeEnd('audit_logs');

  const total = await prisma.auditLog.count();
  console.log(`\nTotal audit logs in DB: ${total.toLocaleString()}`);
  console.timeEnd('total');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
