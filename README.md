# FlowCare Queue & Appointment Booking System API

A secure, role-based backend API for managing appointments, queues, and service slots across multiple branches.

---

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 16
- **ORM**: Prisma
- **Auth**: HTTP Basic Authentication
- **File Storage**: Local filesystem (Multer)
- **Background Jobs**: node-cron (daily soft-delete cleanup)
- **Containerization**: Docker + Docker Compose

---

## Quick Start (Local)

### Prerequisites
- Node.js 20+
- PostgreSQL 16+

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Run migrations
```bash
npx prisma migrate deploy
```

### 4. Start the server (auto-seeds on startup)
```bash
npm run dev
```

The server runs at `http://localhost:3000`

---

## Quick Start (Docker)

```bash
docker-compose up --build
```

This will:
1. Start PostgreSQL
2. Run migrations
3. Start the API (seeds automatically on first run)

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/flowcare` | PostgreSQL connection string |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment |
| `UPLOAD_DIR` | `./uploads` | Directory for file uploads |
| `MAX_FILE_SIZE_MB` | `5` | Maximum upload file size in MB |
| `ADMIN_EMAIL` | `admin@flowcare.com` | Default admin email |
| `ADMIN_PASSWORD` | `Admin@1234` | Default admin password |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in ms |
| `RATE_LIMIT_MAX_BOOKINGS` | `5` | Max booking requests per window |

---

## Database Schema

```
Branch → BranchServiceType ← ServiceType
Branch → Staff → StaffServiceType ← ServiceType
Branch → Slot ← ServiceType
       ↓
    Appointment ← Customer ← User ← Role
       ↓
    AuditLog ← User
```

**Key entities:**
- `Branch` — Service location
- `ServiceType` — Type of service (consultation, blood test, etc.)
- `BranchServiceType` — Which services a branch offers
- `Role` — admin | branch_manager | staff | customer
- `User` — Authentication entity
- `Staff` — Staff member linked to branch (+ isManager flag)
- `StaffServiceType` — Which services a staff member handles
- `Customer` — Customer with ID image
- `Slot` — Time slot with soft-delete support
- `Appointment` — Booked slot with status lifecycle
- `AuditLog` — Immutable audit trail
- `SystemConfig` — Key-value system settings

---

## Seeding

Seed data is loaded **automatically on server startup** (idempotent — safe to restart).

Manual seed:
```bash
npm run db:seed
```

**Default credentials from seed:**

| Role | Email | Password |
|---|---|---|
| Admin | admin@flowcare.com | Admin@1234 |
| Branch Manager (Muscat) | manager.muscat@flowcare.com | Manager@1234 |
| Branch Manager (Salalah) | manager.salalah@flowcare.com | Manager@1234 |
| Staff (Muscat) | dr.sara@flowcare.com | Staff@1234 |
| Staff (Salalah) | dr.mona@flowcare.com | Staff@1234 |

---

## Authentication

All protected endpoints use **HTTP Basic Authentication**.

```bash
# Header format:
Authorization: Basic <base64(email:password)>

# Example:
Authorization: Basic YWRtaW5AZmxvd2NhcmUuY29tOkFkbWluQDEyMzQ=
```

---

## API Reference

### Public Endpoints (No Auth)

#### List Branches
```bash
GET /api/branches?page=1&size=20&term=muscat
```

#### Get Branch
```bash
GET /api/branches/:id
```

#### List Services by Branch
```bash
GET /api/branches/:branchId/services?page=1&size=20&term=blood
```

#### List Available Slots
```bash
GET /api/branches/:branchId/slots?serviceTypeId=svc-blood-test&date=2024-03-10&page=1&size=20
```

---

### Authentication

#### Register Customer
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -F "email=customer@example.com" \
  -F "password=Secret@123" \
  -F "firstName=John" \
  -F "lastName=Doe" \
  -F "phone=+96891234567" \
  -F "idImage=@/path/to/id.jpg"
```

#### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Authorization: Basic $(echo -n 'admin@flowcare.com:Admin@1234' | base64)"
```

---

### Customer Endpoints

#### Book Appointment
```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Authorization: Basic $(echo -n 'customer@example.com:Secret@123' | base64)" \
  -F "slotId=<slot-id>" \
  -F "notes=Optional notes" \
  -F "attachment=@/path/to/doc.pdf"
```

#### List My Appointments
```bash
curl http://localhost:3000/api/appointments/my \
  -H "Authorization: Basic $(echo -n 'customer@example.com:Secret@123' | base64)"
```

#### Get Appointment Details
```bash
curl http://localhost:3000/api/appointments/my/:id \
  -H "Authorization: Basic ..."
```

#### Cancel Appointment
```bash
curl -X DELETE http://localhost:3000/api/appointments/my/:id \
  -H "Authorization: Basic ..."
```

#### Reschedule Appointment
```bash
curl -X PUT http://localhost:3000/api/appointments/my/:id/reschedule \
  -H "Authorization: Basic ..." \
  -H "Content-Type: application/json" \
  -d '{"newSlotId": "<new-slot-id>"}'
```

---

### Staff / Manager / Admin Endpoints

#### List Appointments (role-filtered)
```bash
# Admin sees all, Manager sees branch-only, Staff sees assigned-only
curl http://localhost:3000/api/appointments?page=1&size=20&status=PENDING \
  -H "Authorization: Basic $(echo -n 'manager.muscat@flowcare.com:Manager@1234' | base64)"
```

#### Update Appointment Status
```bash
curl -X PUT http://localhost:3000/api/appointments/:id/status \
  -H "Authorization: Basic ..." \
  -H "Content-Type: application/json" \
  -d '{"status": "CHECKED_IN"}'
```

#### Create Slots (single)
```bash
curl -X POST http://localhost:3000/api/branches/:branchId/slots \
  -H "Authorization: Basic $(echo -n 'manager.muscat@flowcare.com:Manager@1234' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceTypeId": "svc-general-consult",
    "staffId": "staff-muscat1",
    "startTime": "2024-03-15T09:00:00.000Z",
    "endTime": "2024-03-15T09:30:00.000Z"
  }'
```

#### Create Slots (bulk)
```bash
curl -X POST http://localhost:3000/api/branches/:branchId/slots \
  -H "Authorization: Basic ..." \
  -H "Content-Type: application/json" \
  -d '[
    {"serviceTypeId": "svc-blood-test", "startTime": "2024-03-15T08:00:00.000Z", "endTime": "2024-03-15T08:15:00.000Z"},
    {"serviceTypeId": "svc-blood-test", "startTime": "2024-03-15T08:15:00.000Z", "endTime": "2024-03-15T08:30:00.000Z"}
  ]'
```

#### Update Slot
```bash
curl -X PUT http://localhost:3000/api/branches/slots/:id \
  -H "Authorization: Basic ..." \
  -H "Content-Type: application/json" \
  -d '{"isAvailable": false}'
```

#### Delete Slot (soft delete)
```bash
curl -X DELETE http://localhost:3000/api/branches/slots/:id \
  -H "Authorization: Basic ..."
```

#### List Staff
```bash
curl http://localhost:3000/api/staff \
  -H "Authorization: Basic ..."
```

#### Assign Staff to Service
```bash
curl -X POST http://localhost:3000/api/staff/:staffId/services \
  -H "Authorization: Basic ..." \
  -H "Content-Type: application/json" \
  -d '{"serviceTypeId": "svc-xray"}'
```

#### List Customers
```bash
curl http://localhost:3000/api/customers \
  -H "Authorization: Basic $(echo -n 'admin@flowcare.com:Admin@1234' | base64)"
```

#### Get Customer with ID Image Info
```bash
curl http://localhost:3000/api/customers/:id \
  -H "Authorization: Basic ..."
```

#### Download Customer ID Image (Admin only)
```bash
curl http://localhost:3000/api/customers/:id/id-image \
  -H "Authorization: Basic $(echo -n 'admin@flowcare.com:Admin@1234' | base64)" \
  -o id-image.jpg
```

#### Download Appointment Attachment
```bash
curl http://localhost:3000/api/appointments/:id/attachment \
  -H "Authorization: Basic ..." \
  -o attachment.pdf
```

---

### Audit Logs

#### List Audit Logs (Manager: branch-only, Admin: all)
```bash
curl "http://localhost:3000/api/audit-logs?page=1&size=50&term=APPOINTMENT" \
  -H "Authorization: Basic ..."
```

#### Export Audit Logs as CSV (Admin only)
```bash
curl http://localhost:3000/api/audit-logs/export \
  -H "Authorization: Basic $(echo -n 'admin@flowcare.com:Admin@1234' | base64)" \
  -o audit-logs.csv
```

---

### System Configuration (Admin only)

#### Get Retention Period
```bash
curl http://localhost:3000/api/config/retention \
  -H "Authorization: Basic ..."
```

#### Set Retention Period
```bash
curl -X PUT http://localhost:3000/api/config/retention \
  -H "Authorization: Basic ..." \
  -H "Content-Type: application/json" \
  -d '{"days": 14}'
```

#### Trigger Manual Cleanup (Admin only)
```bash
curl -X POST http://localhost:3000/api/branches/slots/cleanup \
  -H "Authorization: Basic $(echo -n 'admin@flowcare.com:Admin@1234' | base64)"
```

#### Queue Position
```bash
curl http://localhost:3000/api/config/queue/:branchId \
  -H "Authorization: Basic ..."
```

---

## Appointment Status Lifecycle

```
PENDING → CONFIRMED → CHECKED_IN → COMPLETED
                                  → NO_SHOW
        → CANCELLED (by customer or system)
```

---

## Pagination & Search

All listing endpoints support:
- `?page=1&size=20` — Pagination (default: page=1, size=20, max size=100)
- `?term=query` — Case-insensitive search across relevant fields

Response format:
```json
{
  "results": [...],
  "total": 125,
  "page": 1,
  "size": 20
}
```

---

## Soft Delete Behavior

- Slots can be soft-deleted (sets `deletedAt` timestamp)
- Soft-deleted slots are hidden from normal listings
- Admins can view soft-deleted records
- Hard-delete runs automatically via cron (daily at midnight)
- Retention period configurable via `PUT /api/config/retention`
- All delete actions are logged in AuditLog

---

## Rate Limiting

Booking endpoints (`POST /api/appointments`, `PUT /api/appointments/*`) are rate-limited:
- Default: 5 requests per 60 seconds per IP
- Configurable via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_BOOKINGS`

---

## Project Structure

```
src/
├── config/
│   └── database.ts          # Prisma client
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
├── middleware/
│   ├── auth.ts              # Basic Auth + RBAC
│   └── upload.ts            # Multer file upload
├── routes/
│   ├── appointments.ts
│   ├── auditLogs.ts
│   ├── auth.ts
│   ├── branches.ts
│   ├── customers.ts
│   ├── index.ts
│   ├── services.ts
│   ├── slots.ts
│   ├── staff.ts
│   └── systemConfig.ts
├── seed/
│   ├── index.ts             # Manual seed script
│   ├── seed.json            # Seed data
│   └── startup.ts           # Auto-seed on startup
├── services/
│   └── auditLog.ts          # Audit log helper
├── utils/
│   └── dateUtils.ts
└── index.ts                 # App entry point + cron
prisma/
├── schema.prisma
└── migrations/
```
