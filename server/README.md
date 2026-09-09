# Bizimi API (Node/Express)

New backend for the Bizimi React migration. Sits in front of the same Supabase project as the existing Next.js app — same tables, same RLS.

## Run

```
cp .env.example .env   # fill in Supabase keys
npm install
npm run dev            # http://localhost:4000
```

## Test

```
npm test
```

See `docs/superpowers/specs/2026-09-08-nextjs-to-react-node-migration-design.md` in the repo root for the full migration plan.
