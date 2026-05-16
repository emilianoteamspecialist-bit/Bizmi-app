// Phase B Storage Migration: backfill
//
// Decodes existing base64 logos/images from `freelancer_logos.logo_data` and
// `agency_image.image_data`, uploads to Supabase Storage 'avatars' bucket, and
// writes the path back into `*_path` columns. Idempotent — rows that already
// have a path are skipped.
//
// REQUIRES:
//   - scripts/storage-migration-setup.sql has been run in Supabase first
//   - env vars NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
//     (Service role key, NOT the anon key. Find it in Supabase Dashboard → Settings → API.)
//
// RUN:
//   node scripts/backfill-avatars.mjs
//
// Safe to re-run. Logs each row's outcome; failures do not abort the batch.

import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "node:fs"

// Load .env.local if present (so you don't have to export env vars manually).
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
  console.error("Set in .env.local or as env vars before running.")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const BUCKET = "avatars"
const PAGE_SIZE = 50

function extFromMime(mime) {
  if (!mime) return "png"
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg"
  if (mime.includes("webp")) return "webp"
  if (mime.includes("gif")) return "gif"
  return "png"
}

function decodeDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") }
}

async function migrateRow({ table, idColumn, dataColumn, pathColumn, row }) {
  const userId = row[idColumn]
  const decoded = decodeDataUrl(row[dataColumn])

  if (!decoded) {
    console.warn(`  [skip] ${table} ${userId}: ${dataColumn} not a valid data URL`)
    return { ok: false, reason: "invalid_data" }
  }

  const mime = row.mime_type || decoded.mime || "image/png"
  const ext = extFromMime(mime)
  const path = `${userId}/avatar.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, decoded.buffer, { contentType: mime, upsert: true })

  if (upErr) {
    console.error(`  [fail] ${table} ${userId}: upload — ${upErr.message}`)
    return { ok: false, reason: "upload_failed" }
  }

  const { error: updErr } = await supabase
    .from(table)
    .update({ [pathColumn]: path })
    .eq(idColumn, userId)

  if (updErr) {
    console.error(`  [fail] ${table} ${userId}: row update — ${updErr.message}`)
    return { ok: false, reason: "row_update_failed" }
  }

  console.log(`  [ok]   ${table} ${userId} → ${path}`)
  return { ok: true }
}

async function migrateTable({ table, idColumn, dataColumn, pathColumn }) {
  console.log(`\n=== Backfilling ${table} ===`)
  let totalDone = 0, totalFail = 0, offset = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(`${idColumn}, ${dataColumn}, ${pathColumn}, mime_type`)
      .is(pathColumn, null)
      .not(dataColumn, "is", null)
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error(`  Fatal: ${error.message}`)
      return { totalDone, totalFail: totalFail + 1 }
    }
    if (!data || data.length === 0) break

    for (const row of data) {
      const result = await migrateRow({ table, idColumn, dataColumn, pathColumn, row })
      if (result.ok) totalDone++
      else totalFail++
    }

    if (data.length < PAGE_SIZE) break
    // Don't increment offset: each migrated row drops out of the WHERE clause,
    // so the next query naturally returns the next page.
  }

  console.log(`  ${table}: ${totalDone} migrated, ${totalFail} failed`)
  return { totalDone, totalFail }
}

const f = await migrateTable({
  table: "freelancer_logos",
  idColumn: "freelancer_id",
  dataColumn: "logo_data",
  pathColumn: "logo_path",
})

const a = await migrateTable({
  table: "agency_image",
  idColumn: "agency_id",
  dataColumn: "image_data",
  pathColumn: "image_path",
})

console.log(`\n=== Summary ===`)
console.log(`Total migrated: ${f.totalDone + a.totalDone}`)
console.log(`Total failed:   ${f.totalFail + a.totalFail}`)
process.exit(f.totalFail + a.totalFail > 0 ? 1 : 0)
