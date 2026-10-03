-- ============================================================
-- Enforce one active verification per NIN
--
-- Both identity pages run a "NIN already exists" check before inserting,
-- but they run it with the caller's own RLS-scoped client, and
-- freelancer_verification's SELECT policy only exposes the caller's own
-- row -- so the check never sees another freelancer's NIN, and the same
-- NIN could be submitted by any number of accounts.
--
-- Enforce it in the database instead. Rejected rows are excluded so a NIN
-- that failed verification doesn't block a later (correct) submission, and
-- so a freelancer's own rejected row never collides with their resubmission.
-- Inserts that collide fail with 23505, which both apps map to
-- "NIN already exists in the system".
--
-- If existing data already has duplicate active NINs, this stops with a
-- clear error instead of half-applying; resolve those rows first (e.g. mark
-- the illegitimate ones 'rejected'), then re-run.
-- ============================================================

DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT nin
    FROM public.freelancer_verification
    WHERE status <> 'rejected'
    GROUP BY nin
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'freelancer_verification has % NIN(s) shared by more than one non-rejected row; resolve them before applying this migration. Find them with: SELECT nin, array_agg(freelancer_id) FROM public.freelancer_verification WHERE status <> ''rejected'' GROUP BY nin HAVING count(*) > 1;',
      dup_count;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS freelancer_verification_active_nin_key
  ON public.freelancer_verification (nin)
  WHERE status <> 'rejected';
