# FlowCare — Queue & Appointment Booking System

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

### Quick examples

```bash
# List branches (public)
curl http://localhost:3000/api/branches?term=Muscat

# List available slots (public)
curl "http://localhost:3000/api/branches/branch-muscat/slots?serviceTypeId=svc-general-consult&date=2026-03-15"

# Book an appointment (customer)
curl -X POST http://localhost:3000/api/appointments \
  -H "Authorization: Basic ..." \
  -F "slotId=<slot-id>" \
  -F "notes=Optional notes" \
  -F "attachment=@/path/to/file.pdf"

# Update appointment status (staff/manager)
curl -X PUT http://localhost:3000/api/appointments/<id>/status \
  -H "Authorization: Basic ..." \
  -H "Content-Type: application/json" \
  -d '{"status": "CHECKED_IN"}'

# Get queue position for an appointment
curl http://localhost:3000/api/appointments/<id>/queue-position \
  -H "Authorization: Basic ..."

# Live branch queue count
curl http://localhost:3000/api/config/queue/branch-muscat \
  -H "Authorization: Basic ..."

# Export audit logs as CSV (admin)
curl http://localhost:3000/api/audit-logs/export \
  -H "Authorization: Basic ..." -o logs.csv
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
