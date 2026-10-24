# Changes

## Overview
This update brings the repository to review-ready quality while preserving the existing public applicant flow:
- Browse jobs -> view job details -> apply remains intact.
- Admin authentication with JWT was added.
- Admin-only job creation was added.
- Docker now runs DB + backend + frontend together.
- Developer experience/docs/env setup were improved.
- UI and routing quality improvements were made (including 404 route and warning fixes).

## Files Added

### Backend
- `backend/.env.example`
  - Added example env variables for backend runtime.
  - Includes `PORT`, `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.

- `backend/controllers/auth.controller.js`
  - Added login controller for admin auth.
  - Validates username/password from request body.
  - Verifies credentials against env-based admin values.
  - Returns JWT token with `role: "admin"`.

- `backend/routes/auth.routes.js`
  - Added auth route: `POST /auth/login`.

- `backend/middleware/auth.middleware.js`
  - Added `verifyToken` middleware for Bearer token verification.
  - Adds decoded JWT payload to `req.user`.
  - Added `requireAdmin` middleware for role-based access control.

### Frontend
- `frontend/.env.example`
  - Added frontend env template with `VITE_API_URL`.

- `frontend/src/auth/AuthContext.jsx`
  - Added auth context with token persisted in `localStorage`.
  - Added JWT payload decoding to derive role.
  - Exposes `login`, `logout`, `isAuthenticated`, `isAdmin`, `token`, `user`.

- `frontend/src/auth/ProtectedRoute.jsx`
  - Added `RequireAuth` and `RequireAdmin` wrappers.
  - Redirects unauthenticated users to `/login`.
  - Redirects non-admin users away from admin pages.

- `frontend/src/pages/Login.jsx`
  - Added admin login page.
  - Calls backend `POST /auth/login`.
  - Stores token via auth context.

- `frontend/src/pages/AdminCreateJob.jsx`
  - Added admin-only create job page.
  - Calls backend `POST /jobs` with Bearer token.
  - Shows success and error banners.

- `frontend/src/pages/NotFound.jsx`
  - Added 404 page for unmatched routes.

- `frontend/Dockerfile`
  - Added multi-stage Docker build for frontend (Vite build + nginx serve).

- `frontend/nginx.conf`
  - Added SPA fallback routing for React Router.

### Root
- `docker-compose.yml`
  - Added full stack compose for:
    - `db` (Postgres)
    - `backend` (Express)
    - `frontend` (nginx serving built app)
  - Added health checks and dependency ordering.

- `scripts/dev.sh`
  - Added helper script to run backend and frontend together locally.

- `changes.md`
  - This changelog file.

## Files Modified

- `README.md`
  - Replaced placeholder docs with full project documentation.
  - Added prerequisites, env setup, local/dev commands, Docker commands, endpoint list, admin login notes.

- `backend/package.json`
  - Added `jsonwebtoken` dependency.

- `backend/pnpm-lock.yaml`
  - Updated lockfile for backend dependency changes.

- `backend/server.js`
  - Wired `auth` routes.
  - Kept `/health` endpoint.
  - Added API 404 handler.
  - Added centralized error middleware.

- `backend/controllers/jobs.controller.js`
  - Retained `getAllJobs` and `getJobById` behavior.
  - Added `createJob` controller with validation.
  - Added `try/catch` error handling for DB operations.

- `backend/routes/jobs.routes.js`
  - Added `POST /jobs` protected by `verifyToken` + `requireAdmin`.

- `backend/controllers/applications.controller.js`
  - Improved input validation (`jobId`, required fields, email format).
  - Added explicit job existence check before insert.
  - Added consistent DB error handling.

- `backend/routes/applications.routes.js`
  - Kept `POST /applications` public.
  - Protected `GET /applications` with admin JWT middleware.

- `frontend/src/main.jsx`
  - Wrapped app with `AuthProvider`.

- `frontend/src/App.jsx`
  - Added routes:
    - `/login`
    - `/admin/create-job` (RequireAdmin)
    - `*` -> NotFound

- `frontend/src/components/Navbar.jsx`
  - Added role-aware controls:
    - Login when logged out
    - Logout when logged in
    - `+ Create Job` only for admin
  - Removed broken `/apply` link that did not match route structure.

- `frontend/src/components/Layout.jsx`
  - Fixed malformed Tailwind class that was breaking layout.

- `frontend/src/api/api.js`
  - Kept public job/apply APIs.
  - Added `loginAdmin` and `createJob` API helpers.
  - Added consistent error parsing for API errors.
  - Removed environment debug logging.

- `frontend/src/pages/Jobs.jsx`
  - Fixed fragment/key misuse to avoid React warnings.
  - Minor cleanup for strict equality and rendering stability.

## Files Removed
- `docker-compose.yaml`
  - Removed to avoid conflict/ambiguity with `docker-compose.yml`.

## Endpoint Summary

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| POST | `/auth/login` | Public | Admin login, returns `{ token }` |
| GET | `/jobs` | Public | List jobs |
| GET | `/jobs/:id` | Public | Job details |
| POST | `/jobs` | Admin (JWT) | Create job |
| POST | `/applications` | Public | Submit application |
| GET | `/applications` | Admin (JWT) | List submitted applications |

## How To Run

### Local Development
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

pnpm --dir backend install
pnpm --dir frontend install

# Run separately:
pnpm --dir backend dev
pnpm --dir frontend dev

# Or run both:
./scripts/dev.sh
```

### Docker
```bash
cp backend/.env.example backend/.env
docker compose up --build
```

## Validation Performed
- Frontend lint passed: `pnpm --dir frontend lint`
- Frontend build passed: `pnpm --dir frontend build`
- Backend syntax checks passed (`node --check` on backend JS files)
- Docker compose config validated: `docker compose config`

## Demo Checklist
1. Open `/jobs` and verify job list loads.
2. Open `/jobs/:id` and verify details render.
3. Submit `/apply/:id` with valid data and verify success message.
4. Submit apply with invalid email and verify validation error.
5. Access `/admin/create-job` while logged out and verify redirect to `/login`.
6. Login via `/login` using backend env admin credentials.
7. Verify navbar shows `+ Create Job` after admin login.
8. Create a job and verify it appears in jobs list.
9. Open unknown route and verify 404 page.
10. Verify protected endpoints reject missing/invalid token.
