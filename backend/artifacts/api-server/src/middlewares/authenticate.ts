import { Request, Response, NextFunction } from "express";
import { verifyJwt, type JwtPayload } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware that verifies the Bearer JWT and attaches req.user.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyJwt(token);
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid token";
    res.status(401).json({ error: msg });
  }
}
