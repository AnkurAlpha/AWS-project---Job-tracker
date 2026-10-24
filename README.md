# Job Application Tracker

Full-stack hiring workflow app with public job applications and admin hiring controls.

## What This Project Includes
- Public candidate flow: browse jobs, view details, and submit applications.
- Admin flow: signup/login with JWT, fallback env-based login, create/delete jobs, manage applicant statuses, and remove applicants.
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
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

## Environment Setup
1. Create backend env:
```bash
cp backend/.env.example backend/.env
```
2. Create frontend env:
```bash
cp frontend/.env.example frontend/.env
```

Required/important variables:
- Backend:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (optional, default `12h`)
- `JWT_ISSUER` (optional, default `job-tracker-api`)
- `JWT_AUDIENCE` (optional, default `job-tracker-admin`)
- `ADMIN_USERNAME` (fallback login)
- `ADMIN_PASSWORD` (fallback login)
- Frontend:
- `VITE_API_URL` (example: `http://localhost:5000`)

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
- Backend: `http://localhost:5000`
- Postgres: `localhost:5432`

## Authentication and Authorization
- Admin signup: `POST /auth/signup`
- Admin login: `POST /auth/login`
- Session verify: `GET /auth/me`
- JWT-based route protection for admin APIs
- Fallback admin auth from env credentials when DB user is unavailable

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
| POST | `/auth/signup` | Public | Create admin user, returns `{ token, user }` |
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

# docker rebuild
docker compose up -d --build
```
