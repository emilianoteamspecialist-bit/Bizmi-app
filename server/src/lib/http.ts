import type { Request, Response, NextFunction, RequestHandler } from "express"

export class HttpError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next)
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) })
    return
  }
  console.error("Unhandled error:", err)
  res.status(500).json({ error: "Internal server error" })
}
