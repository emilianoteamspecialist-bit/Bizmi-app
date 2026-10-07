# Dev query scripts

Ad hoc, one-off scripts for poking at Supabase during development (moved here
from the repo root). They read `.env.local` from the current directory, so run
them from the repo root:

```
node scripts/dev-queries/test-query.js
```

Not a test suite and not CI-relevant — don't extend this pattern for real
tests (use the Vitest suites in `client/` and `server/`).
