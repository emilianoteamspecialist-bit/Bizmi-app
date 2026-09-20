import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import express from "express"
import freelancersRouter from "./freelancers"

function appWith(supabase: any) {
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.supabase = supabase
    req.user = { id: "agency-1" }
    next()
  })
  app.use("/", freelancersRouter)
  return app
}

function makeSupabase(profilesData: any[], relatedData: Record<string, any[]> = {}, orSpy?: (filter: string) => void) {
  return {
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        const result = { data: profilesData, error: null }
        const thenable = {
          then: (resolve: any) => resolve(result),
          or: (filter: string) => {
            orSpy?.(filter)
            return { then: (resolve: any) => resolve(result) }
          },
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                range: vi.fn(() => thenable),
              })),
            })),
          })),
        }
      }
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: relatedData[table] ?? [], error: null })),
            then: (resolve: any) => resolve({ data: relatedData[table] ?? [], error: null }),
          })),
        })),
      }
    }),
  }
}

describe("GET /freelancers", () => {
  it("returns freelancers with logos, verification, completed-job counts, and skills joined in", async () => {
    const supabase = makeSupabase(
      [{ id: "f-1", full_name: "Jane Doe", bio: "A bio", location: "Lagos", created_at: "2026-01-01T00:00:00Z" }],
      {
        freelancer_logos: [{ freelancer_id: "f-1", logo_path: "f-1/avatar.png", logo_data: null }],
        Freelancer_identitie: [{ user_id: "f-1", verification_status: "verified" }],
        freelancer_proposal_status: [{ freelancer_id: "f-1", status: "completed" }],
        freelancer_skills: [{ user_id: "f-1", skill_name: "Web Development" }],
      }
    )
    process.env.SUPABASE_URL = "https://example.supabase.co"

    const res = await request(appWith(supabase)).get("/").query({ limit: "20", offset: "0" })

    expect(res.body.freelancers).toEqual([
      {
        id: "f-1",
        full_name: "Jane Doe",
        bio: "A bio",
        location: "Lagos",
        skills: ["Web Development"],
        created_at: "2026-01-01T00:00:00Z",
        logo: "https://example.supabase.co/storage/v1/object/public/avatars/f-1/avatar.png",
        verification_status: "verified",
        jobs_completed: 1,
      },
    ])
    expect(res.body.hasMore).toBe(false)
  })

  it("returns an empty page with hasMore false when there are no matching profiles", async () => {
    const supabase = makeSupabase([])
    const res = await request(appWith(supabase)).get("/").query({ limit: "20", offset: "0" })
    expect(res.body).toEqual({ freelancers: [], hasMore: false })
  })

  it("sets hasMore true when a full page of results comes back", async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => ({
      id: `f-${i}`,
      full_name: `Freelancer ${i}`,
      bio: null,
      location: null,
      created_at: "2026-01-01T00:00:00Z",
    }))
    const supabase = makeSupabase(twenty)
    const res = await request(appWith(supabase)).get("/").query({ limit: "20", offset: "0" })
    expect(res.body.hasMore).toBe(true)
    expect(res.body.freelancers).toHaveLength(20)
  })

  it("strips PostgREST filter-DSL metacharacters from the search term before querying", async () => {
    const orSpy = vi.fn()
    const supabase = makeSupabase([], {}, orSpy)

    await request(appWith(supabase)).get("/").query({ search: "a,b(c)d.e:f\\g*h" })

    expect(orSpy).toHaveBeenCalledWith("full_name.ilike.%a b c d e f g h%,bio.ilike.%a b c d e f g h%")
  })
})
