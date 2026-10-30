# RuralCare Connect

> **Offline-first healthcare support platform for Community Health Workers (CHWs)**  
> *"Healthcare doesn't stop when the internet does."*

---

## 1. Overview

RuralCare Connect is an offline-resilient healthcare field application built to support rural Community Health Workers (CHWs) and ASHAs. It allows healthcare workers to register patients, log follow-up check-ups, and manage prioritized field visit tasks even when cellular or Wi-Fi connectivity is unavailable.

All records are committed instantly to browser-local storage (IndexedDB via Dexie.js) and queued for automated, idempotent background synchronization when network connectivity returns.

---

## 2. Project Architecture

```
RuralCare-Connect/
├── client/                     # Frontend Application (React, Vite, TypeScript, Tailwind)
│   ├── .env.example            # Client environment template
│   ├── public/                 # Static assets, PWA manifest, documentary photography
│   └── src/
│       ├── components/         # Minimal Neo-Brutalist design components
│       ├── context/            # AuthContext (offline-resilient session state)
│       ├── hooks/              # useNetworkStatus, useLiveQuery
│       ├── layouts/            # AppLayout with persistent connectivity indicator
│       ├── pages/              # LandingPage, Login, Dashboard, PatientRegistry, etc.
│       └── types/              # Patient, FollowUp, Task, SyncQueueItem
├── server/                     # Backend API (Node.js, Express, TypeScript, Prisma)
│   ├── .env.example            # Server environment template
│   └── src/
│       └── config/env.ts       # Zod-powered environment validation
├── .gitignore                  # Root Git exclusion rules (.env, node_modules, etc.)
└── package.json                # Monorepo runner scripts
```

---

## 3. Environment Configuration

### Client Environment Variables (`client/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base URL for backend REST API endpoints | `http://localhost:5000/api` |
| `VITE_APP_NAME` | Client application display title | `RuralCare Connect` |
| `VITE_DEMO_MODE` | Enable demonstration login and test data | `true` |

> [!WARNING]
> **Client Security Precaution:** Variables prefixed with `VITE_` are bundled directly into frontend JavaScript assets and are publicly visible in browser DevTools. **NEVER** place database passwords, private encryption keys, or server secrets in client `.env` files.

---

### Server Environment Variables (`server/.env`)

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | Application mode (`development`, `test`, `production`) | `development` |
| `PORT` | Yes | HTTP listening port for Express backend | `5000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://USER:PASSWORD@localhost:5432/ruralcare_db?schema=public` |
| `JWT_SECRET` | Yes | Cryptographic secret for signing tokens (min 16 chars) | `your_long_random_secret_string_here` |
| `JWT_EXPIRES_IN`| No | Token validity duration | `1d` |
| `CLIENT_URL` | Yes | Allowed frontend origin for CORS policies | `http://localhost:5173` |

---

## 4. Local Setup Guide

### Step 1: Create Environment Files

Copy the example templates to create your local `.env` files:

```bash
# In the client directory
cd client
copy .env.example .env

# In the server directory
cd ../server
copy .env.example .env
```

### Step 2: Configure PostgreSQL

1. Ensure PostgreSQL is installed and running on your system.
2. Create the application database:
   ```sql
   CREATE DATABASE ruralcare_db;
   ```
3. Open `server/.env` and update `DATABASE_URL` with your local PostgreSQL username, password, and port:
   ```env
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/ruralcare_db?schema=public
   ```
4. Set a secure random string for `JWT_SECRET`:
   ```env
   JWT_SECRET=super_secret_cryptographic_key_32_characters_long
   ```

### Step 3: Install Dependencies

```bash
# In workspace root
npm install

# In client
cd client
npm install

# In server
cd ../server
npm install
```

### Step 4: Run the Application

From the root directory:

```bash
# Start both client and server concurrently
npm run dev

# Or run client only
npm run dev:client

# Or run server only
npm run dev:server
```

- **Client Application:** `http://localhost:5173`
- **Server Health & API:** `http://localhost:5000/api`

---

## 5. Security & Privacy Safeguards

1. **Git Exclusions:** The root `.gitignore` strictly excludes all `.env` and `.env.*` files while preserving `.env.example` templates.
2. **Environment Validation:** `server/src/config/env.ts` validates all required configuration via Zod upon startup. If a variable is missing or malformed, the server halts with clear diagnostic instructions and **never logs private secrets or database passwords**.
3. **Synthetic Demo Records:** All patient demographic records provided in the demo environment are fictional and intended solely for testing offline synchronization workflows.
