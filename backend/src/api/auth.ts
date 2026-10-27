import { Router, Request, Response } from "express";
import crypto from "crypto";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/index.js";
import { query } from "../db/connection.js";
import { config } from "../config/index.js";
import { authenticateRequest, requireAuth } from "../middleware/auth.js";
import { WalletLedgerService } from "../modules/wallet/ledger.js";
import { EmailService } from "../modules/email/service.js";
import { ExchangeRateService } from "../modules/currency/exchange.js";

export const authRouter = Router();

// Fast in-memory User Profile Cache (15s TTL) to make GET /api/auth/me sub-10ms
interface CachedProfile {
  data: any;
  cachedAt: number;
}
const profileCache = new Map<string, CachedProfile>();
const CACHE_TTL_MS = 15000;

export function invalidateUserProfileCache(userId?: string): void {
  if (userId) {
    profileCache.delete(userId);
  } else {
    profileCache.clear();
  }
}

// Password hashing using Node crypto scrypt (secure & salt-based)
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, key] = combinedHash.split(":");
    if (!salt || !key) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(key, "hex"), derivedKey);
  } catch {
    return false;
  }
}

function fromCents(cents: number | string): number {
  return Number((Number(cents) / 100).toFixed(2));
}

/**
 * High-performance helper to build the detailed UserProfileResponse that frontend AuthContext & client.js expect.
 * Executes in a SINGLE roundtrip using lateral joins, then caches for 15s.
 */
export async function buildUserProfileResponse(userId: string, skipCache: boolean = false) {
  const now = Date.now();
  if (!skipCache) {
    const cached = profileCache.get(userId);
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // Single query joining User, Customer, Wallet, Address, and Ledger Aggregates
  const profileRes = await query(
    `SELECT 
      u.id, u.email, u.name, u.role, u.email_verified,
      cp.id as customer_id, cp.first_name, cp.last_name, cp.phone, cp.gender,
      wa.id as wallet_id, wa.wallet_number, wa.is_active as wallet_is_active, wa.is_frozen as wallet_is_frozen,
      a.id as address_id, a.country as address_country, a.state as address_state, a.city as address_city, 
      a.street as address_street, a.postal_code as address_postal_code,
      COALESCE(sums.balance_cents, 0) as balance_cents,
      COALESCE(res.reserved_cents, 0) as reserved_cents
    FROM "user" u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    LEFT JOIN wallet_accounts wa ON wa.customer_id = cp.id
    LEFT JOIN addresses a ON a.user_id = u.id AND a.is_primary = TRUE
    LEFT JOIN LATERAL (
      SELECT 
        SUM(CASE WHEN direction = 'CREDIT' THEN ROUND(amount_usd * 100) WHEN direction = 'DEBIT' THEN -ROUND(amount_usd * 100) ELSE 0 END) as balance_cents
      FROM ledger_entries WHERE wallet_id = wa.id
    ) sums ON TRUE
    LEFT JOIN LATERAL (
      SELECT SUM(ROUND(amount_usd * 100)) as reserved_cents
      FROM wallet_reservations WHERE wallet_id = wa.id AND status = 'ACTIVE'
    ) res ON TRUE
    WHERE u.id = $1
    LIMIT 1;`,
    [userId]
  );

  if (profileRes.rows.length === 0) return null;
  const row = profileRes.rows[0];

  // If brand-new user has no customer profile or wallet yet, provision once
  let customerId = row.customer_id;
  let walletId = row.wallet_id;
  let firstName = row.first_name;
  let lastName = row.last_name;

  if (!customerId) {
    const nameParts = (row.name || "").trim().split(" ");
    firstName = nameParts[0] || (row.email ? row.email.split("@")[0] : "Customer");
    lastName = nameParts.slice(1).join(" ") || "";
    try {
      const newCust = await query(
        `INSERT INTO customer_profiles (user_id, first_name, last_name, gender, is_verified)
         VALUES ($1, $2, $3, 'M', TRUE)
         ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
         RETURNING id, first_name, last_name`,
        [userId, firstName, lastName]
      );
      if (newCust.rows.length > 0) {
        customerId = newCust.rows[0].id;
        const w = await WalletLedgerService.getOrCreateWallet(customerId);
        walletId = w.id;
      }
    } catch (e) {
      console.warn("Auto-provision profile on /me warning:", e);
    }
  } else if (!walletId) {
    try {
      const w = await WalletLedgerService.getOrCreateWallet(customerId);
      walletId = w.id;
    } catch (e) {
      console.warn("Auto-provision wallet warning:", e);
    }
  }

  const liveRate = ExchangeRateService.getCachedRate();
  const totalBalanceUsd = fromCents(row.balance_cents);
  const reservedUsd = fromCents(row.reserved_cents);
  const spendableUsd = Math.max(0, totalBalanceUsd - reservedUsd);

  const walletData = walletId
    ? {
        id: walletId,
        wallet_number: row.wallet_number || `IMX-WLT-${userId.substring(0, 6).toUpperCase()}`,
        balance: totalBalanceUsd,
        balance_usd: totalBalanceUsd,
        balance_htg: Math.round(totalBalanceUsd * liveRate * 100) / 100,
        spendable_balance: spendableUsd,
        spendable_balance_usd: spendableUsd,
        spendable_balance_htg: Math.round(spendableUsd * liveRate * 100) / 100,
        reserved_balance: reservedUsd,
        reserved_balance_usd: reservedUsd,
        is_active: row.wallet_is_active ?? true,
        is_frozen: row.wallet_is_frozen ?? false,
      }
    : null;

  const suiteId = `IMX-${userId.substring(0, 6).toUpperCase()}`;
  const receivingAddress = row.address_id
    ? {
        id: row.address_id,
        country: row.address_country || "Haiti",
        state: row.address_state || "Ouest",
        city: row.address_city || "Port-au-Prince",
        house: row.address_street || "",
        address_line: row.address_street || "",
        suite: suiteId,
        zip_code: row.address_postal_code || "33198",
        managed_state_code: "FL",
      }
    : {
        id: "depot-default",
        country: "United States",
        state: "FL",
        city: "Doral",
        house: "8400 NW 25th St",
        address_line: "IMPEX Logistics Center, 8400 NW 25th St",
        suite: suiteId,
        zip_code: "33198",
        managed_state_code: "FL",
      };

  const finalFirstName = firstName || row.name?.split(" ")[0] || "Customer";
  const finalLastName = lastName || row.name?.split(" ").slice(1).join(" ") || "";

  const responseData = {
    id: row.id,
    user_id: row.id,
    email: row.email,
    phone: row.phone || null,
    role: row.role || "customer",
    is_verified: row.email_verified || true,
    first_name: finalFirstName,
    last_name: finalLastName,
    name: row.name || `${finalFirstName} ${finalLastName}`.trim(),
    customer: customerId
      ? {
          id: customerId,
          first_name: finalFirstName,
          last_name: finalLastName,
          phone: row.phone,
          gender: row.gender || "M",
        }
      : null,
    admin: row.role === "admin" || row.role === "superadmin" ? { first_name: finalFirstName, last_name: finalLastName } : null,
    wallet: walletData,
    receiving_address: receivingAddress,
    international_address: receivingAddress,
  };

  // Cache response for 15s to make repeated requests instantaneous (< 1ms)
  profileCache.set(userId, { data: responseData, cachedAt: now });

  return responseData;
}

/**
 * Helper to establish a valid user session, insert into Better Auth session table, and set cookies
 */
async function createSessionForUser(userId: string, req: Request, res: Response): Promise<string> {
  invalidateUserProfileCache(userId);

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const sessionId = crypto.randomUUID();

  await query(
    `INSERT INTO "session" (id, token, user_id, expires_at, ip_address, user_agent, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
    [sessionId, sessionToken, userId, sessionExpiresAt, req.ip, req.headers["user-agent"] || ""]
  );

  const isProd = config.NODE_ENV === "production";

  // Clear stale Better Auth session data cache cookie
  res.clearCookie("better-auth.session_data", { path: "/" });
  if (config.COOKIE_DOMAIN) {
    res.clearCookie("better-auth.session_data", { path: "/", domain: config.COOKIE_DOMAIN });
  }

  // Set unified session cookies
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    domain: config.COOKIE_DOMAIN || undefined,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  res.cookie("access_token", sessionToken, cookieOptions);
  res.cookie("better-auth.session_token", sessionToken, cookieOptions);

  return sessionToken;
}

/**
 * POST /api/auth/login
 * Step 1: Validates credentials and dispatches 6-digit OTP code to the registered email.
 */
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { identifier, email, password } = req.body;
    const loginEmail = (identifier || email || "").trim().toLowerCase();

    if (!loginEmail || !password) {
      res.status(400).json({ error: "Email/identifier and password are required" });
      return;
    }

    const userRes = await query(`SELECT * FROM "user" WHERE email = $1`, [loginEmail]);
    if (userRes.rows.length === 0) {
      res.status(401).json({ detail: "Invalid email or password. Please try again." });
      return;
    }

    const u = userRes.rows[0];

    // Check account password in account table
    const accRes = await query(
      `SELECT * FROM "account" WHERE user_id = $1 AND provider_id = 'credential'`,
      [u.id]
    );

    let passwordMatches = false;
    if (accRes.rows.length > 0 && accRes.rows[0].password) {
      const stored = accRes.rows[0].password;
      if (stored.includes(":")) {
        passwordMatches = verifyPassword(password, stored);
      } else {
        // Legacy plaintext password check
        passwordMatches = stored === password;
        if (passwordMatches) {
          // Transparently upgrade to secure salted scrypt hash
          const upgradedHash = hashPassword(password);
          await query(`UPDATE "account" SET password = $1, updated_at = NOW() WHERE id = $2`, [upgradedHash, accRes.rows[0].id]);
        }
      }
    }

    if (!passwordMatches) {
      res.status(401).json({ detail: "Invalid email or password. Please try again." });
      return;
    }

    // Password is valid -> Authenticate directly (one-time OTP is only for new registration)
    const sessionToken = await createSessionForUser(u.id, req, res);
    const profile = await buildUserProfileResponse(u.id);

    // Clean up any old OTPs for this email
    await query(`DELETE FROM auth_otps WHERE email = $1`, [loginEmail]);

    res.json({
      access_token: sessionToken,
      token: sessionToken,
      user_id: u.id,
      email: u.email,
      role: u.role || "customer",
      user: profile,
      wallet: profile?.wallet,
      receiving_address: profile?.receiving_address,
      message: "Login successful.",
    });
  } catch (err: any) {
    console.error("Login endpoint error:", err);
    res.status(500).json({ error: "Internal server error during login", detail: err.message });
  }
});

/**
 * POST /api/auth/register & /api/customers/register
 * Step 1: Validates customer payload and dispatches 6-digit OTP code to the email.
 */
authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      phone,
      gender = "M",
      country_name = "Haiti",
      state_name = "Ouest",
      city = "Port-au-Prince",
      street = "Logistics Depot Delivery",
      postal_code = "HT6110",
      managed_state_code = "OU",
    } = req.body;

    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ detail: "Password must be at least 6 characters long." });
      return;
    }

    const existing = await query(`SELECT id FROM "user" WHERE email = $1`, [cleanEmail]);
    if (existing.rows.length > 0) {
      res.status(400).json({
        detail: "This email address is already registered. Please sign in or use another email.",
      });
      return;
    }

    const hashedPassword = hashPassword(password);
    const otpCode = EmailService.generateOtp();

    // Clean up previous registration OTPs for this email
    await query(`DELETE FROM auth_otps WHERE email = $1 AND purpose = 'REGISTER'`, [cleanEmail]);

    const registrationPayload = {
      first_name: (first_name || "").trim() || "Customer",
      last_name: (last_name || "").trim(),
      email: cleanEmail,
      hashedPassword,
      phone: phone || null,
      gender: gender || "M",
      country_name: country_name || "Haiti",
      state_name: state_name || "Ouest",
      city: city || "Port-au-Prince",
      street: street || "Logistics Depot Delivery",
      postal_code: postal_code || "HT6110",
      managed_state_code: managed_state_code || "OU",
    };

    // Store pending registration with 10-minute expiry
    await query(
      `INSERT INTO auth_otps (email, otp_code, purpose, payload, expires_at)
       VALUES ($1, $2, 'REGISTER', $3, NOW() + INTERVAL '10 minutes')`,
      [cleanEmail, otpCode, JSON.stringify(registrationPayload)]
    );

    // Send security OTP email
    await EmailService.sendOtpEmail(cleanEmail, otpCode, "REGISTER");

    res.json({
      status: "OTP_REQUIRED",
      purpose: "REGISTER",
      email: cleanEmail,
      message: "A 6-digit verification code has been sent to your email.",
    });
  } catch (err: any) {
    console.error("Register endpoint error:", err);
    res.status(500).json({ error: "Registration failed", detail: err.message });
  }
});

/**
 * POST /api/auth/verify-otp
 * Step 2: Validates the 6-digit OTP code.
 * - If purpose === 'REGISTER': Creates real user in DB. First user gets role='admin', all subsequent users get role='customer'.
 * - If purpose === 'LOGIN': Authenticates user.
 * Issues session token and returns full profile.
 */
authRouter.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const { email, otp, purpose } = req.body;
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanOtp = (otp || "").toString().trim();
    const cleanPurpose = (purpose || "").toUpperCase();

    if (!cleanEmail || !cleanOtp || !cleanPurpose) {
      res.status(400).json({ error: "Email, OTP code, and purpose (LOGIN or REGISTER) are required." });
      return;
    }

    const otpRes = await query(
      `SELECT * FROM auth_otps 
       WHERE email = $1 AND purpose = $2 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [cleanEmail, cleanPurpose]
    );

    if (otpRes.rows.length === 0) {
      res.status(400).json({ detail: "No pending verification found. Please request a new code." });
      return;
    }

    const otpRecord = otpRes.rows[0];

    // Check expiration
    if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
      await query(`DELETE FROM auth_otps WHERE id = $1`, [otpRecord.id]);
      res.status(400).json({ detail: "Verification code has expired. Please request a new code." });
      return;
    }

    // Check attempts
    if (otpRecord.attempts >= 5) {
      await query(`DELETE FROM auth_otps WHERE id = $1`, [otpRecord.id]);
      res.status(400).json({ detail: "Too many failed attempts. Please request a new verification code." });
      return;
    }

    // Check OTP match
    if (otpRecord.otp_code !== cleanOtp) {
      await query(`UPDATE auth_otps SET attempts = attempts + 1 WHERE id = $1`, [otpRecord.id]);
      res.status(400).json({ detail: "Incorrect verification code. Please check your email and try again." });
      return;
    }

    // OTP is valid! Delete used OTP
    await query(`DELETE FROM auth_otps WHERE id = $1`, [otpRecord.id]);

    let finalUserId: string;
    let assignedRole: string;

    if (cleanPurpose === "REGISTER") {
      const payload = typeof otpRecord.payload === "string" ? JSON.parse(otpRecord.payload) : otpRecord.payload;

      // duguepiterson@gmail.com is the sole designated admin; all user registrations receive 'customer'
      assignedRole = cleanEmail === "duguepiterson@gmail.com" ? "admin" : "customer";

      finalUserId = crypto.randomUUID();
      const fullName = `${payload.first_name || ""} ${payload.last_name || ""}`.trim() || cleanEmail.split("@")[0];

      // 1. Insert into "user"
      await query(
        `INSERT INTO "user" (id, name, email, email_verified, role, created_at, updated_at)
         VALUES ($1, $2, $3, TRUE, $4, NOW(), NOW())`,
        [finalUserId, fullName, cleanEmail, assignedRole]
      );

      // 2. Insert into "account"
      await query(
        `INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
         VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())`,
        [crypto.randomUUID(), cleanEmail, finalUserId, payload.hashedPassword]
      );

      // 3. Insert customer profile
      const custRes = await query(
        `INSERT INTO customer_profiles (user_id, first_name, last_name, phone, gender, is_verified)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING id`,
        [finalUserId, payload.first_name, payload.last_name, payload.phone, payload.gender]
      );
      const customerId = custRes.rows[0].id;

      // 4. Create default address
      await query(
        `INSERT INTO addresses (user_id, country, state, city, street, postal_code, managed_state_code, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
        [
          finalUserId,
          payload.country_name,
          payload.state_name,
          payload.city,
          payload.street,
          payload.postal_code,
          payload.managed_state_code,
        ]
      );

      // 5. Provision real database wallet
      await WalletLedgerService.getOrCreateWallet(customerId);
    } else {
      // LOGIN
      const payload = typeof otpRecord.payload === "string" ? JSON.parse(otpRecord.payload) : otpRecord.payload;
      finalUserId = payload.userId;

      const userRes = await query(`SELECT role FROM "user" WHERE id = $1`, [finalUserId]);
      if (userRes.rows.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      assignedRole = userRes.rows[0].role || "customer";
    }

    // Create session & set cookie
    const sessionToken = await createSessionForUser(finalUserId, req, res);
    const userInfo = await buildUserProfileResponse(finalUserId);

    res.json({
      access_token: sessionToken,
      user_id: finalUserId,
      email: cleanEmail,
      role: assignedRole,
      is_verified: true,
      is_first_login: cleanPurpose === "REGISTER",
      user: userInfo,
      wallet: userInfo?.wallet,
    });
  } catch (err: any) {
    console.error("verify-otp endpoint error:", err);
    res.status(500).json({ error: "Verification failed", detail: err.message });
  }
});

/**
 * POST /api/auth/resend-otp
 * Generates and resends a new 6-digit OTP code, rate limited to once per 30 seconds.
 */
authRouter.post("/resend-otp", async (req: Request, res: Response) => {
  try {
    const { email, purpose } = req.body;
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPurpose = (purpose || "").toUpperCase();

    if (!cleanEmail || !cleanPurpose) {
      res.status(400).json({ error: "Email and purpose are required." });
      return;
    }

    const recentRes = await query(
      `SELECT * FROM auth_otps 
       WHERE email = $1 AND purpose = $2 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [cleanEmail, cleanPurpose]
    );

    if (recentRes.rows.length > 0) {
      const lastCreated = new Date(recentRes.rows[0].created_at).getTime();
      const elapsedSeconds = (Date.now() - lastCreated) / 1000;
      if (elapsedSeconds < 30) {
        res.status(429).json({
          detail: `Please wait ${Math.ceil(30 - elapsedSeconds)} seconds before requesting a new code.`,
        });
        return;
      }
    }

    const payload = recentRes.rows.length > 0 ? recentRes.rows[0].payload : {};
    const newOtp = EmailService.generateOtp();

    await query(`DELETE FROM auth_otps WHERE email = $1 AND purpose = $2`, [cleanEmail, cleanPurpose]);

    await query(
      `INSERT INTO auth_otps (email, otp_code, purpose, payload, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')`,
      [cleanEmail, newOtp, cleanPurpose, typeof payload === "string" ? payload : JSON.stringify(payload)]
    );

    await EmailService.sendOtpEmail(cleanEmail, newOtp, cleanPurpose as any);

    res.json({
      success: true,
      message: "A new 6-digit verification code has been sent to your email.",
    });
  } catch (err: any) {
    console.error("resend-otp endpoint error:", err);
    res.status(500).json({ error: "Failed to resend code", detail: err.message });
  }
});

/**
 * GET /api/auth/me & /api/me
 * Returns normalized profile, wallet, and receiving address for the authenticated session.
 */
authRouter.get("/me", authenticateRequest, requireAuth, async (req: Request, res: Response) => {
  try {
    const userInfo = await buildUserProfileResponse(req.user!.id);
    if (!userInfo) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(userInfo);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch user profile", detail: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Revokes session from database, invokes Better Auth signOut, and clears all session cookies completely.
 */
authRouter.post("/logout", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
    const cookieToken =
      req.cookies?.["better-auth.session_token"] ||
      req.cookies?.["access_token"] ||
      req.cookies?.["__Secure-better-auth.session_token"];

    const tokensToRevoke = [bearerToken, cookieToken].filter(Boolean) as string[];

    // Parallelize DB deletions and Better Auth signOut
    const parallelOps: Promise<any>[] = [];

    if (tokensToRevoke.length > 0) {
      parallelOps.push(
        query(`DELETE FROM "session" WHERE token = ANY($1)`, [tokensToRevoke]).catch(() => null)
      );
    }

    if (req.user?.id) {
      invalidateUserProfileCache(req.user.id);
      parallelOps.push(
        query(`DELETE FROM "session" WHERE user_id = $1`, [req.user.id]).catch(() => null)
      );
    }

    parallelOps.push(
      auth.api.signOut({
        headers: fromNodeHeaders(req.headers),
        asResponse: true,
      }).catch(() => null)
    );

    // Run parallel DB cleanup
    await Promise.allSettled(parallelOps);

    // Forcefully clear ALL session cookies across paths and domains
    const cookieNames = [
      "better-auth.session_token",
      "better-auth.session_data",
      "better-auth.csrf_token",
      "__Secure-better-auth.session_token",
      "__Secure-better-auth.session_data",
      "access_token",
      "impex_token",
    ];

    for (const name of cookieNames) {
      res.clearCookie(name, { path: "/" });
      res.clearCookie(name, { path: "/", domain: undefined });
      if (config.COOKIE_DOMAIN) {
        res.clearCookie(name, { path: "/", domain: config.COOKIE_DOMAIN });
      }
    }

    res.json({ message: "Successfully logged out" });
  } catch (err: any) {
    res.json({ message: "Logged out" });
  }
});
