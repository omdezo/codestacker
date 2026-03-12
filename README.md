# FlowCare — Queue & Appointment Booking System

![CI](https://github.com/omdezo/codestacker/actions/workflows/ci.yml/badge.svg)

> Rihal Codestacker 2026 — Backend Challenge submission

---

## Description

FlowCare is a production-ready REST API that powers a multi-branch appointment and queue management platform for Oman-based service centers. It handles scheduling, rescheduling, cancellations, real-time queue tracking, staff management, audit trails, and file storage — all secured with role-based access control.

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

The full test suite is included as a Postman collection (`FlowCare.postman_collection.json`).

**Run with Newman:**
```bash
npm install -g newman
newman run FlowCare.postman_collection.json \
  --env-var "baseUrl=http://localhost:3000" \
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

> Free tier spins down after inactivity — first request may take ~30s.

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
| GET | `/api/audit-logs` | List audit logs (manager: branch, admin: all) |
| GET | `/api/audit-logs/export` | Export audit logs as CSV (admin only) |

### Admin Only

| Method | Endpoint | Description |
|---|---|---|
| PUT | `/api/staff/:id/branch` | Reassign staff to different branch |
| GET | `/api/config/retention` | Get soft-delete retention period |
| PUT | `/api/config/retention` | Set retention period (days) |
| POST | `/api/branches/slots/cleanup` | Trigger manual hard-delete of expired slots |
| GET | `/api/config/queue/:branchId` | Live branch queue count |

---

## Contributing

This project was built for the Rihal Codestacker 2026 Backend Challenge.
Requirements are defined in `sysrequaments.md` (provided by Rihal).

---

## License

MIT

---

## Author

**Omar**
Rihal Codestacker 2026 — Backend Challenge
