import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/index.js";
import { query } from "../db/connection.js";
import { WalletLedgerService } from "../modules/wallet/ledger.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: "customer" | "admin" | "employee" | "superadmin";
  first_name?: string;
  last_name?: string;
  customerId?: string;
  walletId?: string;
  isAdmin: boolean;
  isStaff: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      session?: any;
    }
  }
}

export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const hasAuthHeader = !!req.headers.authorization;
    const hasCookie = !!(req.headers.cookie && (req.headers.cookie.includes("access_token=") || req.headers.cookie.includes("better-auth")));
    const queryToken = (req.query.token || req.query.access_token) as string | undefined;

    if (!hasAuthHeader && !hasCookie && !queryToken) {
      return next();
    }

    // 1. Check for explicit Authorization Bearer token first (priority over ambient browser cookies), or query param token
    const authHeader = req.headers.authorization;
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (queryToken) {
      token = queryToken.trim();
    }

    if (token) {
        const sessionQuery = await query(
          `SELECT s.id, s.token, s.user_id, s.expires_at, u.email, u.name, u.role,
                  cp.id as customer_id, cp.first_name, cp.last_name, wa.id as wallet_id
           FROM "session" s 
           JOIN "user" u ON u.id = s.user_id 
           LEFT JOIN customer_profiles cp ON cp.user_id = u.id
           LEFT JOIN wallet_accounts wa ON wa.customer_id = cp.id
           WHERE s.token = $1 AND s.expires_at > NOW()`,
          [token]
        );

        if (sessionQuery.rows.length > 0) {
          const s = sessionQuery.rows[0];
          const role = (s.role || "customer").toLowerCase();

          const firstName = s.first_name || s.name?.split(" ")[0] || "";
          const lastName = s.last_name || s.name?.split(" ").slice(1).join(" ") || "";

          req.user = {
            id: s.user_id,
            email: s.email,
            name: s.name || `${firstName} ${lastName}`.trim(),
            role: role as any,
            first_name: firstName,
            last_name: lastName,
            customerId: s.customer_id || undefined,
            walletId: s.wallet_id || undefined,
            isAdmin: role === "admin" || role === "superadmin",
            isStaff: role === "admin" || role === "employee" || role === "superadmin",
          };
          req.session = { id: s.id, userId: s.user_id, token: s.token };
          return next();
        }
    }

    // 2. Fallback to Better Auth session / cookies (used by Google OAuth & cookie sessions)
    const sessionResult = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (sessionResult && sessionResult.user) {
      const u = sessionResult.user as any;
      const role = (u.role || "customer").toLowerCase();

      // Fetch customer profile if customer
      let customerId: string | undefined;
      let walletId: string | undefined;
      let firstName = u.name?.split(" ")[0] || "";
      let lastName = u.name?.split(" ").slice(1).join(" ") || "";

      const custRes = await query(
        `SELECT cp.id as customer_id, cp.first_name, cp.last_name, wa.id as wallet_id 
         FROM customer_profiles cp 
         LEFT JOIN wallet_accounts wa ON wa.customer_id = cp.id 
         WHERE cp.user_id = $1`,
        [u.id]
      );

      if (custRes.rows.length > 0) {
        customerId = custRes.rows[0].customer_id;
        walletId = custRes.rows[0].wallet_id;
        if (custRes.rows[0].first_name) firstName = custRes.rows[0].first_name;
        if (custRes.rows[0].last_name) lastName = custRes.rows[0].last_name;
      } else {
        // Auto-provision customer profile and wallet for new social/Google users
        try {
          const newCust = await query(
            `INSERT INTO customer_profiles (user_id, first_name, last_name, gender, is_verified)
             VALUES ($1, $2, $3, 'M', TRUE)
             RETURNING id, first_name, last_name`,
            [u.id, firstName || "Customer", lastName || ""]
          );
          if (newCust.rows.length > 0) {
            customerId = newCust.rows[0].id as string;
            const w = await WalletLedgerService.getOrCreateWallet(customerId);
            walletId = w.id;
          }
        } catch (e) {
          console.warn("Auto-provision profile for social user warning:", e);
        }
      }

      req.user = {
        id: u.id,
        email: u.email,
        name: u.name || `${firstName} ${lastName}`.trim(),
        role: role as any,
        first_name: firstName,
        last_name: lastName,
        customerId,
        walletId,
        isAdmin: role === "admin" || role === "superadmin",
        isStaff: role === "admin" || role === "employee" || role === "superadmin",
      };
      req.session = sessionResult.session;
      return next();
    }

    return next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return next();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", detail: "Please log in to continue." });
    return;
  }
  next();
}

export function requireCustomer(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required", detail: "Please log in to continue." });
    return;
  }
  if (!req.user.customerId && req.user.role === "customer") {
    res.status(404).json({ error: "Customer profile not found" });
    return;
  }
  next();
}

export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!req.user.isStaff) {
    res.status(403).json({ error: "Forbidden", detail: "Staff privileges required." });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!req.user.isAdmin) {
    res.status(403).json({ error: "Forbidden", detail: "Admin privileges required." });
    return;
  }
  next();
}
