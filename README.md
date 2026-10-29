# Job Application Tracker

Full-stack hiring workflow app with public job applications and admin hiring controls.

Built by [ANKURALPHA](https://github.com/AnkurAlpha) and [sohomsarkar2006-rgb](https://github.com/sohomsarkar2006-rgb).

This repository is the source of truth for application changes and the reviewable
AWS coursework extensions. Private credentials and runtime state remain outside
source control. AWS hosting and new cloud features are **off by default**.

## AWS coursework extensions - prepared, not deployed

See [AWS guide](docs/aws/README.md), [complete syllabus coverage](docs/aws/SYLLABUS-COVERAGE.md),
[cost and credit controls](docs/aws/COST-CONTROLS.md), and [migration/review notes](docs/aws/MIGRATION-AND-REVIEW.md).

- Transactional PostgreSQL outbox for job/application events; optional SQS delivery,
  Step Functions processing, short-lived DynamoDB audit and SNS notifications.
- Credit reserve and low-balance/plan-expiry alerts, with opt-in daily monitoring.
- Seventeen disabled-by-default CloudFormation templates. Expensive teaching labs
  require a separate cost acknowledgement and are not the recommended deployment.
- IMDSv2, role credentials, scoped policies, private storage, TLS-only APIs, bounded
  retries/retention, loopback database/API ports, login throttling and secret-free images.
- Offline HTTP/PostgreSQL smoke tests, fake AWS-client tests, template schema checks,
  and CI with read-only GitHub permissions and no AWS deployment credentials.

Run `python3 tools/smoke.py` in the documented development environment after
installing the two pnpm lockfiles. This starts temporary loopback tests only and
does not start, provision, modify or upgrade any AWS resource. No automatic
deployment workflow is included. New credit alerts are not active until their
monitor is deliberately deployed/enabled and its email subscription is confirmed.

## What This Project Includes
- Public candidate flow: browse jobs, view details, and submit applications.
- Admin flow: assigned login with JWT, create/delete jobs, manage applicant statuses, and remove applicants. Public admin registration is disabled by default.
- Modern frontend UX: toasts, skeleton loading, icons, subtle animations, theme-aware particles background, and dark/light mode.

## Tech Stack
- Frontend: React, React Router, Tailwind CSS, Vite
- Frontend UX libs: Sonner, GSAP, Lucide React, React Loading Skeleton, tsParticles
- Backend: Node.js, Express, pg, JWT
- Database: PostgreSQL
- Package manager: pnpm
- Containers: Docker Compose

## Project Structure
```text
backend/
  controllers/
  routes/
  middleware/
  db/
frontend/
  src/
    pages/
    components/
    auth/
    api/
```

## Prerequisites
- Node.js 22 or newer
- pnpm 10
- Docker + Docker Compose

## Environment Setup
1. Create a private local admin account and backend configuration:
```bash
node scripts/setup-admin.cjs
```
This configures username `sohom-admin` and a unique password. Read the password
from the generated `PRIVATE-ADMIN-LOGIN.txt`; it is not published in this
repository. Running setup again rotates the local application password. It does
not modify a hosted application or an AWS IAM password.

2. Create frontend env:
```bash
cp frontend/.env.example frontend/.env
```

Required/important variables:
- Backend:
- `DATABASE_URL`
- `DATABASE_SSL`, `DATABASE_SSL_CA_FILE` (future managed PostgreSQL; verified CA required when enabled)
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (optional, default `12h`)
- `JWT_ISSUER` (optional, default `job-tracker-api`)
- `JWT_AUDIENCE` (optional, default `job-tracker-admin`)
- `ADMIN_USERNAME` (assigned account, default name `sohom-admin`)
- `ADMIN_PASSWORD` (unique private password generated during setup)
- `ALLOW_ADMIN_SIGNUP` (default `false`)
- `AWS_EVENTS_ENABLED` (default `false`; requires the prepared AWS integration and worker before enabling)
- `AWS_REGION`, `AWS_EVENT_QUEUE_URL` (worker configuration; use a role, not static AWS keys)
- `BIND_HOST` (default `127.0.0.1`; Compose sets the internal container listener to `0.0.0.0`)
- `TRUST_PROXY_HOPS` (default `0`; set `1` only behind a controlled proxy with no public direct backend port)
- Frontend:
- `VITE_API_URL` (default `/api`, forwarded to localhost:5000 by Vite during development)
- `VITE_ALLOW_ADMIN_SIGNUP` (default `false`; enabling the signup UI also requires explicit backend permission)

Edit `DATABASE_URL` for your PostgreSQL installation before starting the backend.
The example database password is for local development. Keep real environment
files and the generated login file private. Use only `.env.example` in commits.

## Local Development
Install dependencies:
```bash
pnpm --dir backend install
pnpm --dir frontend install
```

Run in separate terminals:
```bash
pnpm --dir backend dev
pnpm --dir frontend dev
```

Optional helper script:
```bash
./scripts/dev.sh
```

Default local URLs:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Docker
Build and start:
```bash
docker compose up -d --build
```

Stop:
```bash
docker compose down
```

Default ports:
- Frontend: `http://localhost:8080`
- Backend: `http://localhost:5000` (host loopback only)
- Postgres: `localhost:5432` (host loopback only)

The frontend proxies `/api/` to the backend. No browser-facing localhost API URL is
baked into the image. Both images exclude private environment and login files.
The optional `cloud` Compose profile is disabled by default and must not be started
for an offline smoke test. Keep local demo database defaults out of cloud use.

## Authentication and Authorization
- Admin signup: `POST /auth/signup`, returns 403 unless explicitly enabled
- Admin login: `POST /auth/login`
- Session verify: `GET /auth/me`
- JWT-based route protection for admin APIs
- The assigned environment account is authoritative for its username, including when an older database row has the same name.
- Other database accounts verify their PBKDF2 password hash.
- `/health` reports database readiness and returns 503 during a database outage.

Frontend auth behavior:
- Stores token/user in localStorage
- Derives admin state from valid token/user
- Hides admin nav actions unless authenticated as admin

## Hiring Workflow Features
- Job management: create and delete jobs (admin only).
- Applicant management: list all applicants, move status (`applied` -> `interview` -> `passed`, or back to `applied`), and remove applicants.
- Real-time UI updates: applicant badge/status updates instantly after actions.

## API Endpoints
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| GET | `/live` | Public | Process liveness, independently of database readiness |
| GET | `/operations/events` | Admin (JWT) | Local event backlog/delivery/dead-letter counts |
| POST | `/auth/signup` | Disabled by default | Explicit opt-in required before admin registration |
| POST | `/auth/login` | Public | Admin login, returns `{ token, user }` |
| GET | `/auth/me` | Admin (JWT) | Validate token and fetch current user |
| GET | `/jobs` | Public | List jobs |
| GET | `/jobs/:id` | Public | Get job details |
| POST | `/jobs` | Admin (JWT) | Create job |
| DELETE | `/jobs/:id` | Admin (JWT) | Delete job |
| POST | `/applications` | Public | Submit application |
| GET | `/applications` | Admin (JWT) | List all applications |
| PATCH | `/applications/:id/status` | Admin (JWT) | Update applicant status |
| DELETE | `/applications/:id` | Admin (JWT) | Remove applicant |

## Database Notes
- `jobs`, `applications`, and `admin_users` tables are created in `backend/db/init.sql`.
- `applications.status` tracks pipeline stage and defaults to `applied`.
- Seed data inserts two starter jobs if the jobs table is empty.
- Startup runs checksum-tracked additive migrations under a transaction/advisory lock.
- With cloud events enabled, business writes and minimal outbox records commit
  together. A queue failure does not lose a committed business update. Published
  outbox records expire after seven days; local dead letters after fourteen days.

## UI/UX Enhancements Implemented
- Global toasts with success/error/promise patterns
- Skeleton loading states for job list and job detail pages
- Icons in navbar/actions for better affordance
- GSAP-based subtle route/page motion
- Theme-aware particles background with click disturbance
- Dark/light mode support with tailored contrast
- NotFound route (`*`) for unknown paths

## Common Commands
```bash
# frontend build
pnpm --dir frontend build

# backend start
pnpm --dir backend start

# backend authentication and readiness regression tests
pnpm --dir backend test

# docker rebuild
docker compose up -d --build
```
