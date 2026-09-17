# RoundRelay

> Real interview experiences, passed forward.

RoundRelay is a peer-driven platform for college students to share real interview experiences, discuss rounds and questions, interact through comments and votes, explore student profiles, and connect through direct and department-group messaging.

## Stack and structure

- `Backend/`: Node.js, Express, Mongoose, MongoDB, and Socket.IO realtime services.
- `Frontend/interviewhub/`: React, Vite, and Tailwind CSS browser application.

## Local setup

Prerequisites: Node.js 20+, npm, and a MongoDB connection. The root `.nvmrc` and CI use Node 20.

From the repository root, install the backend:

```sh
cd Backend
npm ci
```

Create your own untracked `Backend/.env` from `Backend/.env.example` and supply your local configuration. The backend environment variable names are:

```text
MONGO_URI
JWT_SECRET
EMAIL_USER
EMAIL_PASS
FRONTEND_URL
PORT
ALLOWED_EMAIL_DOMAINS
```

Run `npm start` or `npm run dev` from `Backend/`.

In a separate terminal, starting from the repository root:

```sh
cd Frontend/interviewhub
npm ci
```

Create your own untracked `Frontend/interviewhub/.env` from its `.env.example`. The frontend environment variable name is:

```text
VITE_API_URL
```

Run `npm run dev` from `Frontend/interviewhub/`. All frontend npm commands run in this directory.

## Verification

From `Backend/`, run `npm test`. The isolated suite includes `tests/deploymentReadiness.test.js` and runs without a live database or email service. Current baseline: **413 tests, 413 passed, 0 failed, 0 skipped**. Repository-owned JavaScript syntax validation covers 25 backend files.

From `Frontend/interviewhub/`, run:

```sh
npm run lint -- --max-warnings=0
npm run build
npm run test:e2e
```

Strict lint passes with **0 errors and 0 warnings**. The production build passes; the Playwright Chromium baseline is **8 tests, 8 passed, 0 failed, 0 skipped**. Install the existing browser with `npx playwright install chromium` if needed.

GitHub Actions runs on pushes to `main` and pull requests targeting `main`. Backend checks run `npm ci`, `npm test`, and repository-owned JavaScript syntax validation. Frontend checks run `npm ci`, strict lint, the production build, Playwright Chromium installation, and browser tests. CI does not deploy the application.

## Production deployment

Production architecture: **Vercel frontend**, **Railway backend + Socket.IO**, and **MongoDB Atlas database**.

Live production endpoints:

- Frontend: [RoundRelay production](https://RoundRelay.vercel.app)
- Backend: [RoundRelay backend](https://RoundRelay-backend-production.up.railway.app)
- Backend readiness: [RoundRelay health](https://RoundRelay-backend-production.up.railway.app/health)

DNS hostnames are case-insensitive for navigation. For environment variables such as `FRONTEND_URL` and `VITE_API_URL`, copy the provider-issued origin directly from the Vercel or Railway dashboard rather than retyping it.

Provider deployment acceptance has been verified on the current production configuration: the Vercel deployment reports success for the reviewed `main` commit, and Railway reports a successful deployment with MongoDB connected and `/health` passing. End-user authenticated flows such as real registration/OTP/login should still be smoke-tested after production-affecting changes.

### Vercel project settings

| Setting | Value |
| --- | --- |
| Repository | `navadeep-17/InterviewExperience` |
| Root Directory | `Frontend/interviewhub` |
| Framework Preset | `Vite` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Production Branch | `main` |
| Production environment variable | `VITE_API_URL=<Railway production origin>` |

Configure build settings in the Vercel dashboard. [Frontend/interviewhub/vercel.json](Frontend/interviewhub/vercel.json) contains only the SPA fallback: `/(.*)` to `/index.html`. This lets React Router handle direct navigation to `/login`, `/home`, `/profile`, `/message`, and `/user/:id`. See [Vercel's Vite SPA guidance](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas).

`VITE_API_URL` must be the Railway HTTPS backend **origin only**, with no `/api` suffix or other path. The frontend appends `/api/...` for HTTP requests and uses the same origin for Socket.IO. There is no Vercel API proxy or separate socket URL variable.

### Railway service settings

| Setting | Value |
| --- | --- |
| Repository | `navadeep-17/InterviewExperience` |
| Root Directory | `/Backend` |
| Builder | Railpack |
| Node runtime | `20.20.2` via `RAILPACK_NODE_VERSION` |
| Build Command | Leave automatic/default |
| Start Command | `npm start` |
| Healthcheck Path | `/health` |
| Public Networking | `RoundRelay-backend-production.up.railway.app` |

Railpack resolves Node versions in priority order and gives `RAILPACK_NODE_VERSION` highest priority. The production service is pinned to `20.20.2` so Railway matches the Node 20 runtime used by CI. See [Railpack's Node.js version resolution](https://railpack.com/languages/node#versions).

Do **not** manually set `PORT` for normal Railway deployment: Railway injects it, and the backend already reads `process.env.PORT || 5000`. The 5000 fallback applies when PORT is absent; local `.env.example` guidance remains unchanged. Configure `/health` so Railway waits for a 2xx response before activating a deployment. It returns 200 when MongoDB is ready and 503 otherwise. This deployment check is not continuous monitoring. See [Railway healthchecks and PORT](https://docs.railway.com/deployments/healthchecks).

Set these Railway production variables through the provider's variable settings, supplying private values only there:

| Variable | Production value/purpose |
| --- | --- |
| `MONGO_URI` | Private MongoDB Atlas connection URI |
| `JWT_SECRET` | Private authentication signing secret |
| `EMAIL_USER` | Private email account configuration |
| `EMAIL_PASS` | Private email app password |
| `FRONTEND_URL` | Exact Vercel production origin copied from the provider dashboard |
| `ALLOWED_EMAIL_DOMAINS` | `mgit.ac.in` |
| `RAILPACK_NODE_VERSION` | `20.20.2` |

`RAILPACK_NODE_VERSION` and `ALLOWED_EMAIL_DOMAINS` are non-secret configuration values. Keep the other credential-bearing values private in the provider dashboard.

### URL handoff and preview limitation

1. Copy Railway's production backend origin from its Networking settings into Vercel production as `VITE_API_URL`.
2. Copy Vercel's production frontend origin from its Domains/production deployment into Railway as `FRONTEND_URL`.
3. Rebuild/redeploy the Vercel frontend after changing `VITE_API_URL`: [Vite variables are build-time values](https://vite.dev/guide/env-and-mode). Restart/redeploy the Railway backend after changing its runtime variables as appropriate.

Production is the initial supported target. The backend currently allows one configured `FRONTEND_URL` origin, so arbitrary Vercel Preview origins are not automatically authorized for backend HTTP/Socket.IO access. Controlled preview-origin support would require a future explicit CORS policy; the current policy is unchanged.

## Security

Local environment files and secrets must not be committed; only safe example environment files belong in Git. Backend authorization is authoritative. Content and messaging routes require verified accounts from allowed college domains; frontend route guards only control navigation.
