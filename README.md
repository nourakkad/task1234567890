# نظام إدارة المهام (Task Management)

Arabic-first RTL web app for task management across three layers:

**CEO → Managers → Employees**

Modules for tasks, daily updates, suppliers, samples/documents, departments, and team management.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- MongoDB + Mongoose
- NextAuth (credentials / JWT)
- Deploy target: **Netlify** (+ MongoDB Atlas)

## Setup (local)

1. Install dependencies:

```bash
npm install
```

2. Start MongoDB (example local data folder):

```bash
mongod --dbpath ./.data/mongo --port 27017 --bind_ip 127.0.0.1
```

3. Copy env file:

```bash
cp .env.example .env.local
```

Generate a secret:

```bash
openssl rand -base64 32
```

Example `.env.local`:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/alhadara_tasks
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
SEED_PASSWORD=password123
```

4. Seed demo data:

```bash
npm run seed
```

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo logins (local / seed only)

Password for seeded users: value of `SEED_PASSWORD` (default `password123`)

| Role | Email |
|------|-------|
| CEO | ceo@alhadara.com |
| Procurement Manager | procurement@alhadara.com |
| Employee (Iris) | iris@alhadara.com |

Demo login buttons are **hidden in production** unless `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`.

## Deploy on Netlify

1. Create a **MongoDB Atlas** cluster and database user. Allow Netlify IPs (or `0.0.0.0/0` if you accept that risk) and copy the `mongodb+srv://...` URI.
2. Push this repo to GitHub/GitLab/Bitbucket.
3. In Netlify: **Add new site → Import from Git**.
4. Build settings (auto-detected for Next.js; also in `netlify.toml`):
   - Build command: `npm run build`
   - Node: `20` (via `.node-version` / `NODE_VERSION`)
5. Set **environment variables** in Netlify (Site settings → Environment variables):

| Variable | Value |
|----------|--------|
| `MONGODB_URI` | Atlas connection string |
| `NEXTAUTH_URL` | `https://YOUR-SITE.netlify.app` (custom domain later) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` output (32+ chars, not a placeholder) |
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | `false` |
| `NETLIFY_NEXT_SKEW_PROTECTION` | `true` (already in `netlify.toml`) |

6. Seed Atlas **from your machine** (never from Netlify build):

```bash
MONGODB_URI="mongodb+srv://..." SEED_PASSWORD="StrongPass123" npm run seed
```

7. Deploy. Change all seeded passwords after first login in production.

Netlify’s Next.js OpenNext adapter is applied automatically — do **not** pin `@netlify/plugin-nextjs` unless you have a reason.

## Security notes

- APIs require a valid session; middleware also guards `/api/*` (except `/api/auth`).
- Production refuses localhost MongoDB and weak/missing `NEXTAUTH_SECRET`.
- Sessions: JWT, 8h max age, secure cookies in production, periodic active-user refresh.
- New user passwords: min 10 chars, letters + numbers; bcrypt cost 12.
- Security headers: HSTS, `X-Frame-Options: DENY`, `nosniff`, referrer + permissions policies.
- Seed script refuses to run when `NETLIFY=true` / production context.

## Modules

- لوحة المتابعة — KPIs + tasks needing attention
- سجل المهام — create/assign/track tasks (`PUR-###`)
- التحديث اليومي — append-only daily logs (`UPD-###`)
- الموردون — supplier comparison per task
- العينات والمستندات — samples & documents (`DOC/SMP-###`)
- الفريق / الأقسام — org hierarchy management
