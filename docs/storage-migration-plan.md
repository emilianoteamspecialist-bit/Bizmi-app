# Logo/Image Storage Migration Plan

## Why

Both `freelancer_logos.logo_data` and `agency_image.image_data` store images as base64 strings in the database. Two consequences:

1. **Every read pulls hundreds of KB to several MB** per row. The `get_jobs_with_details` RPC even embeds the base64 image into every job row's `agency_info` (scripts/get_jobs_with_details.sql:78), multiplying the payload by the number of jobs.
2. **Postgres TOAST handling and RLS evaluation** on huge text columns is slow compared to fetching from a static CDN.

Target: move images to Supabase Storage, store only the file path in the DB, serve via public CDN URL.

## Scope

### Tables touched
- `freelancer_logos` (columns: `freelancer_id`, `logo_data`, `file_name`, `file_size`, `mime_type`)
- `agency_image` (columns: `agency_id`, `image_data`, `file_name`, `file_size`, `mime_type`)

### Read sites (must update after migration)
- `components/freelancer-navbar.tsx:60`
- `components/agency-navbar.tsx:63`
- `components/app-sidebar.tsx:71,74`
- `app/freelancer/profile/page.tsx:17`
- `app/agency/profile/page.tsx:60`
- `app/freelancer/saved-jobs/page.tsx:139`
- `app/agency/posts/page.tsx:152`
- `app/agency/find-freelancers/page.tsx:111`
- `app/actions/user.ts:103-119` (`getFreelancerLogos`)
- `app/actions/user.ts:122-136` (`getAgencyImage`)
- `scripts/get_jobs_with_details.sql:78` (RPC — biggest single win)

### Upload sites
- `app/freelancer/profile/ProfileClient.tsx:84-91`
- `app/agency/profile/page.tsx:103-110`

---

## Phased Approach

### Phase A — Stop bleeding (low-risk, high-impact, ~30 min)

The biggest perf hit is the RPC embedding base64. Address this first without a full migration:

**A1.** Update `scripts/get_jobs_with_details.sql`: remove the `'logo', (SELECT image_data FROM agency_image …)` line from the `agency_info` JSONB.
**A2.** In the client (`DashboardClient.tsx`, `MarketplaceClient.tsx`), the agency modal already falls back to `AvatarFallback` when `selectedAgency.logo` is missing — so this works without further changes. The agency image still loads when the user clicks an agency (separately).
**A3.** Re-deploy the SQL function in Supabase.

**Rollback:** revert the SQL file and re-run.

### Phase B — Storage migration (~2-3 hours)

**B1. Storage bucket**
- Create `avatars` public bucket in Supabase Dashboard (or via SQL):
  ```sql
  insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
  ```
- RLS policy: authenticated users can upload to their own folder; everyone can read.
  ```sql
  create policy "avatar_upload_own" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

  create policy "avatar_update_own" on storage.objects
    for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

  create policy "avatar_read_public" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'avatars');
  ```
- Path convention: `avatars/{user_id}/avatar.{ext}` (one logo per user, overwritten on upload).

**B2. Schema changes**
- Add `logo_path TEXT` to `freelancer_logos`.
- Add `image_path TEXT` to `agency_image`.
- Keep base64 columns during migration for safe rollback.
  ```sql
  alter table freelancer_logos add column logo_path text;
  alter table agency_image add column image_path text;
  ```

**B3. Backfill script** (`scripts/backfill-avatars.ts`, run once with service role key)
- Iterate every row with non-null `logo_data` / `image_data`.
- Decode base64 → bytes.
- Upload to `avatars/{user_id}/avatar.{ext}` (extension from `mime_type`).
- Update row's `logo_path` / `image_path`.
- Log failures, do not fail the whole batch.
- Idempotent: skip rows that already have a path set.

**B4. Switch upload sites**
- `ProfileClient.tsx:80-95` and `agency/profile/page.tsx:99-114`:
  - Replace `FileReader.readAsDataURL` + insert with `supabase.storage.from('avatars').upload(...)`.
  - Insert/update only `logo_path` / `image_path` (and metadata cols).

**B5. Switch read sites**
- Helper in `lib/avatar-url.ts`:
  ```ts
  export function getAvatarUrl(path: string | null): string {
    if (!path) return ""
    const { data } = supabase.storage.from("avatars").getPublicUrl(path)
    return data.publicUrl
  }
  ```
- All 11 read sites: select `logo_path` / `image_path` instead of `logo_data` / `image_data`, then pass through `getAvatarUrl`.
- Update `get_jobs_with_details.sql`: return `logo_path` (or its public URL via a computed expression) — but only if Phase A didn't already remove it.
- Update `lib/avatar-cache.ts`: cache the URL string (much smaller than base64).

**B6. Verify**
- Login as test freelancer and test agency, confirm avatars render.
- Confirm dashboard, marketplace, profile pages all show correct images.
- Confirm new uploads work end-to-end.

**B7. Cleanup (after 1-2 weeks of stability)**
- `alter table freelancer_logos drop column logo_data;`
- `alter table agency_image drop column image_data;`

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Backfill fails partway | Script is idempotent; rows without `_path` will be retried on rerun |
| RLS policy on storage misconfigured | Test in Supabase Dashboard before rolling client code; public bucket means worst case avatars are unreachable, not exposed |
| Old client code still reads `logo_data` | Keep `logo_data` columns until Phase B7 — old reads still work during transition |
| RPC `get_jobs_with_details` deployment fails | SQL file is version-controlled; revert and reapply prior version |
| Quota: avatars exceed Supabase free tier | Estimate: ~200KB × N users. At 10k users ≈ 2GB. Within Pro plan. Compress on upload if needed. |

---

## Recommended Sequence

1. **Phase A now** — single SQL change, immediate dashboard speedup. Ship it, observe.
2. **Phase B after** — multi-file change, do over a focused session with the backfill run during low traffic.

Open question for the user: are you OK with the agency logo disappearing from the job feed in Phase A (showing initial fallback in the agency modal), or should I keep the logo there by having the client fetch it on agency-modal-open?
