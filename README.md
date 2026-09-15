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

From `Backend/`, run `npm test`. It executes all five isolated Node test suites without a live database or email service:

```sh
node --test tests/userPolicy.test.js tests/authRoutes.test.js tests/realtime.test.js tests/messageAuthorization.test.js tests/experienceCommentIntegrity.test.js
```

From `Frontend/interviewhub/`, run `npm run build` for the production build and `npm run lint` for ESLint diagnostics. Existing lint findings are not yet fully resolved.

GitHub Actions checks backend installation, tests, and JavaScript syntax, plus frontend installation and build, on pushes and pull requests targeting `main`. It does not deploy the application.

## Security

Local environment files and secrets must not be committed; only safe example environment files belong in Git. Backend authorization is authoritative. Content and messaging routes require verified accounts from allowed college domains; frontend route guards only control navigation.
