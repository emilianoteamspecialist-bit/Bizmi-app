// Minimal chainable stand-in for a Supabase client, for route tests that run
// many queries. Every query is recorded as an Op; a single handler decides
// what each one resolves to. Filter methods (eq, in, or, ...) just record
// themselves and keep chaining; the query resolves when awaited or when a
// terminal (single/maybeSingle) is called.

export type Op = {
  table: string
  action: "select" | "insert" | "update" | "upsert" | "delete" | "rpc"
  payload?: any
  columns?: string
  filters: [string, ...any[]][]
  terminal?: "single" | "maybeSingle"
}

export type Result = { data?: any; error?: any; count?: number }
export type Handler = (op: Op) => Result | undefined

const FILTERS = ["eq", "neq", "in", "or", "not", "is", "gt", "gte", "lt", "lte", "like", "ilike", "order", "limit", "range", "match", "filter"]

export function fakeSupabase(handler: Handler) {
  const calls: Op[] = []

  const resolve = (op: Op) => {
    calls.push(op)
    const r = handler(op) ?? {}
    return Promise.resolve({ data: r.data ?? null, error: r.error ?? null, count: r.count })
  }

  const builder = (table: string) => {
    const op: Op = { table, action: "select", filters: [] }
    const b: any = {
      select(columns?: string) {
        // .insert(...).select() keeps the insert action.
        if (op.action === "select") op.columns = columns
        return b
      },
      insert(payload: any) {
        op.action = "insert"
        op.payload = payload
        return b
      },
      update(payload: any) {
        op.action = "update"
        op.payload = payload
        return b
      },
      upsert(payload: any) {
        op.action = "upsert"
        op.payload = payload
        return b
      },
      delete() {
        op.action = "delete"
        return b
      },
      single() {
        op.terminal = "single"
        return resolve(op)
      },
      maybeSingle() {
        op.terminal = "maybeSingle"
        return resolve(op)
      },
      then(onFulfilled: any, onRejected: any) {
        return resolve(op).then(onFulfilled, onRejected)
      },
    }
    for (const f of FILTERS) {
      b[f] = (...args: any[]) => {
        op.filters.push([f, ...args])
        return b
      }
    }
    return b
  }

  const client: any = {
    from: (table: string) => builder(table),
    rpc: (name: string, args: any) => resolve({ table: name, action: "rpc", payload: args, filters: [] }),
  }

  return { client, calls }
}

// Helpers for handlers/assertions.
export const hasFilter = (op: Op, method: string, ...args: any[]) =>
  op.filters.some(([m, ...a]) => m === method && args.every((v, i) => a[i] === v))

export const callsTo = (calls: Op[], table: string, action?: Op["action"]) =>
  calls.filter((c) => c.table === table && (!action || c.action === action))
