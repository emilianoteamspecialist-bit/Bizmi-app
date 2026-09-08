# Bizimi Client (Vite + React)

New frontend for the Bizimi React migration. Talks to `server/` for data and directly to Supabase for auth.

## Run

```
cp .env.example .env   # fill in Supabase keys + API URL
npm install
npm run dev             # http://localhost:5173
```

## Test

```
npm test
```

See `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` in the repo root for the full migration plan.
