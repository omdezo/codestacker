# FlowCare — Queue & Appointment Booking System

![CI](https://github.com/omdezo/codestacker/actions/workflows/ci.yml/badge.svg)

> Rihal Codestacker 2026 — Backend Challenge submission

---

## Description

FlowCare is a production-ready REST API that powers a multi-branch appointment and queue management platform for Oman-based service centers. It handles scheduling, rescheduling, cancellations, real-time queue tracking, staff management, audit trails, and file storage .. all secured with role-based access control.

---

## Features

**Core (all required items implemented)**
- Multi-branch appointment booking — each slot bookable once only
- Full appointment lifecycle: `PENDING → CONFIRMED → CHECKED_IN → COMPLETED / NO_SHOW / CANCELLED`
- Role-based access control: `admin`, `branch_manager`, `staff`, `customer`
- HTTP Basic Authentication
- Customer registration with ID image upload
- Appointment attachment upload (images + PDF)
- Slot management with soft delete + configurable retention period
- Automated daily hard-delete cron job
- Immutable audit log for all sensitive actions
- CSV export of audit logs
- Auto-seeding on startup (idempotent)
- Prisma migrations

**Bonus Points — all implemented**

| Bonus | Status |
|---|---|
| Pagination (`page`, `size`) + Search (`term`) on all listing APIs | Done |
| Queue position — per-appointment + per-branch live endpoints | Done |
| Rate limiting — daily booking limit + daily reschedule limit per customer | Done |
| Background cron — auto hard-deletes expired soft-deleted slots at midnight | Done |
| Dockerized — `Dockerfile` + `docker-compose.yml` | Done |
| GIN trigram indexes (`pg_trgm`) for `ILIKE '%term%'` search performance | Done |

---

## Demo / Tests

**Live API:** https://flowcare-api-q7ro.onrender.com

> Deployed on Render.

The full test suite is included as a Postman collection (`FlowCare.postman_collection.json`).

**Run with Newman against the live API:**
```bash
npm install -g newman
newman run FlowCare.postman_collection.json \
  --env-var "baseUrl=https://flowcare-api-q7ro.onrender.com" \
  --working-dir .
```

**Result: 128/128 assertions passed across 59 requests.**

Default seed credentials:

| Role | Email | Password |
|---|---|---|
| Admin | admin@flowcare.com | Admin@1234 |
| Manager (Muscat) | manager.muscat@flowcare.com | Manager@1234 |
| Manager (Salalah) | manager.salalah@flowcare.com | Manager@1234 |
| Staff (Muscat) | dr.sara@flowcare.com | Staff@1234 |
| Staff (Salalah) | dr.mona@flowcare.com | Staff@1234 |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Framework | Express.js |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Auth | HTTP Basic Authentication |
| File Storage | Local filesystem (Multer) |
| Background Jobs | node-cron |
| Containerization | Docker + Docker Compose |
| Search Indexes | PostgreSQL GIN + `pg_trgm` |

---

## Installation

### Docker (recommended)

```bash
git clone <repo-url>
cd codestacker
docker compose up --build
```

The API starts at `http://localhost:3000`. Migrations run automatically, and seed data is loaded on first startup.

### Local

**Prerequisites:** Node.js 20+, PostgreSQL 16+

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit DATABASE_URL and other vars

# 3. Run migrations
npx prisma migrate deploy

# 4. Start dev server (auto-seeds on startup)
npm run dev
```

---

## Usage

### Authentication

All protected endpoints use HTTP Basic Auth:

```bash
Authorization: Basic <base64(email:password)>

# Example
curl http://localhost:3000/api/appointments/my \
  -H "Authorization: Basic $(echo -n 'customer@example.com:pass' | base64)"
```

### Live API

Base URL: `https://flowcare-api-q7ro.onrender.com`


### Quick examples

```bash
BASE=https://flowcare-api-q7ro.onrender.com
ADMIN=$(echo -n 'admin@flowcare.com:Admin@1234' | base64)
MANAGER=$(echo -n 'manager.muscat@flowcare.com:Manager@1234' | base64)
STAFF=$(echo -n 'dr.sara@flowcare.com:Staff@1234' | base64)

# Health check (public)
curl $BASE/health

# Login as admin
curl -X POST $BASE/api/auth/login \
  -H "Authorization: Basic $ADMIN"

# List all branches (public)
curl "$BASE/api/branches"

# Search branches by name
curl "$BASE/api/branches?term=Muscat"

# List branches with pagination
curl "$BASE/api/branches?page=1&size=5"

# List services for a branch (public)
curl "$BASE/api/branches/branch-muscat/services"

# List available slots for a branch (public)
curl "$BASE/api/branches/branch-muscat/slots?date=2026-03-15"

# List all appointments (admin sees all)
curl "$BASE/api/appointments" \
  -H "Authorization: Basic $ADMIN"

# Search appointments by customer name or service
curl "$BASE/api/appointments?term=Sara&page=1&size=10" \
  -H "Authorization: Basic $ADMIN"

# Update appointment status (staff)
curl -X PUT "$BASE/api/appointments/<id>/status" \
  -H "Authorization: Basic $STAFF" \
  -H "Content-Type: application/json" \
  -d '{"status": "CHECKED_IN"}'

# Get queue position for an appointment
curl "$BASE/api/appointments/<id>/queue-position" \
  -H "Authorization: Basic $STAFF"

# Live branch queue count (admin)
curl "$BASE/api/config/queue/branch-muscat" \
  -H "Authorization: Basic $ADMIN"

# List all staff (admin)
curl "$BASE/api/staff" \
  -H "Authorization: Basic $ADMIN"

# List customers (manager)
curl "$BASE/api/customers" \
  -H "Authorization: Basic $MANAGER"

# List audit logs (admin)
curl "$BASE/api/audit-logs" \
  -H "Authorization: Basic $ADMIN"

# Export audit logs as CSV (admin)
curl "$BASE/api/audit-logs/export" \
  -H "Authorization: Basic $ADMIN" -o logs.csv

# Get soft-delete retention config (admin)
curl "$BASE/api/config/retention" \
  -H "Authorization: Basic $ADMIN"
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/flowcare` | PostgreSQL connection string |
| `PORT` | `3000` | Server port |
| `UPLOAD_DIR` | `./uploads` | File upload directory |
| `MAX_FILE_SIZE_MB` | `5` | Max upload size in MB |
| `ADMIN_EMAIL` | `admin@flowcare.com` | Seed admin email |
| `ADMIN_PASSWORD` | `Admin@1234` | Seed admin password |
| `DAILY_BOOKING_LIMIT` | `3` | Max bookings per customer per day |
| `DAILY_RESCHEDULE_LIMIT` | `3` | Max reschedules per customer per day |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_BOOKINGS` | `20` | Max POST/PUT requests per window per IP |

---

## Project Structure

```
codestacker/
├── Dockerfile
├── docker-compose.yml
├── FlowCare.postman_collection.json
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── 20240304000000_init/
│       ├── 20240305000000_make_slot_id_nullable/
│       └── 20240306000000_add_trgm_indexes/
└── src/
    ├── index.ts                  # Entry point + cron job
    ├── config/
    │   └── database.ts           # Prisma client
    ├── middleware/
    │   ├── auth.ts               # Basic Auth + RBAC
    │   └── upload.ts             # Multer file handling
    ├── controllers/
    │   ├── appointments.ts
    │   ├── auditLogs.ts
    │   ├── auth.ts
    │   ├── branches.ts
    │   ├── customers.ts
    │   ├── services.ts
    │   ├── slots.ts
    │   ├── staff.ts
    │   └── systemConfig.ts
    ├── routes/
    │   └── *.ts
    ├── services/
    │   └── auditLog.ts           # Audit log helper
    └── seed/
        ├── seed.json             # Seed data
        └── startup.ts            # Auto-seed on startup
```

---

## API Documentation

### Public (No Auth)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/branches` | List branches (`?term=`, `?page=`, `?size=`) |
| GET | `/api/branches/:id` | Get branch |
| GET | `/api/branches/:id/services` | List services by branch |
| GET | `/api/branches/:id/slots` | List available slots (`?serviceTypeId=`, `?date=`, `?term=`) |
| GET | `/health` | Health check |

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register customer (multipart: `idImage` required) |
| POST | `/api/auth/login` | Login — returns role, branchId, staffId |

### Customer

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/appointments` | Book appointment (optional `attachment`) |
| GET | `/api/appointments/my` | List my appointments (`?term=`, paginated) |
| GET | `/api/appointments/my/:id` | Get appointment details |
| PUT | `/api/appointments/my/:id/reschedule` | Reschedule (same branch, `newSlotId`) |
| DELETE | `/api/appointments/my/:id` | Cancel appointment |

### Staff / Manager / Admin

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/appointments` | List appointments (role-filtered) |
| PUT | `/api/appointments/:id/status` | Update status (`CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `NO_SHOW`) |
| GET | `/api/appointments/:id/queue-position` | Per-appointment queue position |
| GET | `/api/appointments/:id/attachment` | Download attachment |

### Manager / Admin

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/branches/:id/slots` | Create slot(s) — single object or array |
| PUT | `/api/branches/slots/:id` | Update slot |
| DELETE | `/api/branches/slots/:id` | Soft-delete slot |
| GET | `/api/staff` | List staff (admin: all, manager: branch) |
| POST | `/api/staff` | Create staff member |
| POST | `/api/staff/:id/services` | Assign staff to service |
| DELETE | `/api/staff/:id/services/:svcId` | Remove staff from service |
| GET | `/api/customers` | List customers |
| GET | `/api/customers/:id` | Get customer |
| GET | `/api/customers/:id/id-image` | Download ID image (admin only) |
| GET | `/api/audit-logs` | List audit logs — offset pagination (`page`, `size`, `term`, `from`, `to`, `actorId`, `targetId`) |
| GET | `/api/audit-logs/cursor` | Keyset pagination (`afterDate`, `afterId`, `size`) — O(log n) at any depth |
| GET | `/api/audit-logs/demo` | Live side-by-side benchmark of offset vs cursor (`?page=N`) |
| GET | `/api/audit-logs/export` | Export audit logs as CSV — same filters as list |

### Admin Only

| Method | Endpoint | Description |
|---|---|---|
| PUT | `/api/staff/:id/branch` | Reassign staff to different branch |
| GET | `/api/config/retention` | Get soft-delete retention period |
| PUT | `/api/config/retention` | Set retention period (days) |
| POST | `/api/branches/slots/cleanup` | Trigger manual hard-delete of expired slots |
| GET | `/api/config/queue/:branchId` | Live branch queue count |

---

## Load Test & Pagination Benchmark

### What I tested

I wanted to verify the audit log API holds up under real load before calling it done. I seeded the database with **1,000,000 audit log rows + 10,000 customers** and benchmarked the existing offset-based endpoint at increasing page depths.

### Try it live

There is a demo endpoint that runs both queries against the real database and returns the actual response times side by side:

```bash
BASE=https://flowcare-api-q7ro.onrender.com
ADMIN=$(echo -n 'admin@flowcare.com:Admin@1234' | base64)

# Default depth (page 1000)
curl "$BASE/api/audit-logs/demo" -H "Authorization: Basic $ADMIN"

# Crank it up — deeper = bigger gap
curl "$BASE/api/audit-logs/demo?page=50000" -H "Authorization: Basic $ADMIN"
```

Example response:
```json
{
  "total": 1000000,
  "testedDepth": { "page": 50000, "skip": 999980, "size": 10 },
  "offset": {
    "ms": 1332,
    "rowsDiscardedByDB": 999980,
    "note": "PostgreSQL had to scan past 999,980 rows before returning 10"
  },
  "cursor": {
    "ms": 74,
    "rowsDiscardedByDB": 0,
    "note": "PostgreSQL used a B-tree index seek — read exactly 10 rows, nothing discarded"
  },
  "verdict": "Cursor is 18.0x faster at page 50,000"
}
```

> The live Render database has only a few rows so the difference is small there. To see dramatic results, seed locally first (instructions below).

---

### How to reproduce locally

```bash
# 1. Normal seed (admin, branches, roles)
npm run db:seed

# 2. Insert 1M audit logs + 10K customers (~90 seconds)
npm run db:seed-load

# 3. Start API
npm run dev

# 4. Run the full benchmark script
npm run bench:audit
```

**Seed script** (`scripts/seed-load.js`):

| What | Count | Method |
|---|---|---|
| Customers | 10,000 | `createMany` in batches of 5,000 |
| Audit logs | 1,000,000 | `createMany` in batches of 5,000 |
| Time | ~90s | local PostgreSQL |

---

### Step 1 — Benchmark: offset only

I ran `npm run bench:audit` against 1,000,000 rows and got:

```
Total audit logs in DB: 1,000,000

[ OFFSET ]  GET /api/audit-logs?page=N&size=20

  page=1      (OFFSET 0)          avg=  141ms   p95=  181ms
  page=100    (OFFSET 1,980)      avg=  119ms   p95=  126ms
  page=500    (OFFSET 9,980)      avg=  122ms   p95=  137ms
  page=1000   (OFFSET 19,980)     avg=  127ms   p95=  139ms
  page=5000   (OFFSET 99,980)     avg=  197ms   p95=  208ms
  page=10000  (OFFSET 199,980)    avg=  322ms   p95=  331ms
  page=25000  (OFFSET 499,980)    avg=  715ms   p95=  778ms
  page=50000  (OFFSET 999,980)    avg= 1332ms   p95= 1414ms
```

Page 50,000 is **9.4x slower** than page 1. That told me the default offset approach had a real problem at scale.

---

### Why offset degrades

```sql
-- PostgreSQL runs this for page=50000, size=20:
SELECT * FROM audit_logs
ORDER BY "createdAt" DESC
LIMIT 20 OFFSET 999980;
--              ^^^^^^ scans through 999,980 rows and discards them
--                     before it can return the 20 you actually asked for
```

Even with an index on `createdAt`, PostgreSQL still has to step through 999,980 index entries to count them off. There is no shortcut — it's `O(n)`.

---

### Step 2 — Keyset (cursor) pagination

After seeing those results, I added `GET /api/audit-logs/cursor?afterDate=X&afterId=Y`.

Instead of `OFFSET N`, the client passes the `createdAt` and `id` of the last row it received. PostgreSQL translates that to a direct B-tree seek:

```sql
SELECT * FROM audit_logs
WHERE "createdAt" < '2025-06-15T10:23:44Z'
   OR ("createdAt" = '2025-06-15T10:23:44Z' AND id < 'abc-123')
ORDER BY "createdAt" DESC, id DESC
LIMIT 20;
-- Index seek — reads exactly 20 rows, discards nothing
```

I also added a B-tree index on `audit_logs("createdAt" DESC)` via a new Prisma migration.

> **Note:** I first tried Prisma's built-in `cursor: { id }` feature. It was equally slow at deep positions (~1,400ms) — Prisma still has to locate the cursor row in the ordered result set before paginating, which is effectively another scan. True keyset pagination — filtering directly on the sorted column — is the only approach that stays flat.

---

### Step 3 — Benchmark after adding cursor

```
[ CURSOR ]  GET /api/audit-logs/cursor?afterDate=X&afterId=Y&size=20

  first page  (no cursor)          avg=   88ms   p95=  104ms
  page~2      (cursor near top)    avg=   77ms   p95=   90ms
  page~50000  (cursor near bottom) avg=   74ms   p95=   79ms
```

Completely flat. The query speed is identical whether you're at record 1 or record 999,980.

---

### Result

| Depth | Offset | Cursor | Speedup |
|---|---|---|---|
| Page 1 (OFFSET 0) | 141ms | 88ms | 1.6x |
| Page 10,000 (OFFSET 199,980) | 322ms | 74ms | 4.4x |
| Page 25,000 (OFFSET 499,980) | 715ms | 74ms | 9.7x |
| **Page 50,000 (OFFSET 999,980)** | **1,332ms** | **74ms** | **18x** |

Offset degrades 9.4x going from page 1 to page 50,000. Cursor stays at ~74ms at any depth.

---

### Two endpoints, kept intentionally

| Endpoint | Pagination | Returns total? | When to use |
|---|---|---|---|
| `GET /api/audit-logs` | Offset (`page` + `size`) | Yes | Need total count or page numbers in a UI |
| `GET /api/audit-logs/cursor` | Keyset (`afterDate` + `afterId`) | No (`nextCursor` only) | Deep navigation, log streaming, infinite scroll |
| `GET /api/audit-logs/demo` | — | Both | Live side-by-side comparison of the two |

Both remain because they have different trade-offs — offset is the right choice when you need a total count for page numbers; cursor is the right choice when you're navigating deep or streaming.

---

## Contributing

This project was built for the Rihal Codestacker 2026 Backend Challenge.
Requirements are defined in the [official Rihal Codestacker README](https://github.com/rihal-om/rihal-codestacker/blob/main/BE/README.md).

---

## License

MIT

---

## Author

**Omar**
Rihal Codestacker 2026 — Backend Challenge
