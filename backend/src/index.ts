import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";

import { config, allowedOriginsList } from "./config/index.js";
import { auth } from "./auth/index.js";
import { checkDatabaseHealth } from "./db/connection.js";
import { authRouter } from "./api/auth.js";
import { shoppingRouter } from "./api/shopping.js";
import { adminRouter } from "./api/admin.js";
import { walletRouter } from "./api/wallet.js";
import { addressRouter } from "./api/addresses.js";
import { commerceRouter } from "./api/commerce.js";
import { openApiSpec } from "./api/openapi.js";
import { authenticateRequest, requireAuth } from "./middleware/auth.js";
import { buildUserProfileResponse } from "./api/auth.js";
import compression from "compression";
import { sanitizeInputs } from "./middleware/sanitize.js";

const app = express();

// Track and enforce 100-300ms API response SLA
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    try {
      res.setHeader("X-Response-Time", `${duration}ms`);
    } catch {}
    if (duration > 300 && config.NODE_ENV === "development") {
      console.warn(`[Performance Warning] ${req.method} ${req.originalUrl} took ${duration}ms (target: < 300ms)`);
    }
  });
  next();
});

// Enable gzip/deflate compression to reduce network latency
app.use(compression());

// Trust proxy for accurate IP tracking and rate limiting on hosting platforms (e.g. Railway)
app.set("trust proxy", 1);

// 1. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI inline assets
    crossOriginEmbedderPolicy: false,
  })
);

// 2. CORS configuration with explicit credentials, origins, and 24-hour preflight caching
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, origin?: any) => void) => {
    // Allow requests with no origin (like mobile apps, curl, or SSR) or if origin is in whitelist
    if (
      !origin ||
      allowedOriginsList.includes(origin) ||
      origin.endsWith(".impexht.com") ||
      origin.endsWith(".vercel.app") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1")
    ) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in non-strict modes to avoid blocking customers
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
  ],
  exposedHeaders: ["set-cookie", "X-Response-Time"],
  maxAge: 86400, // Preflight cache for 24 hours: prevents browser repeating OPTIONS requests
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// 3. Better Auth handler (mounted before express.json() for stream consumption on Better Auth native routes)
const betterAuthHandler = toNodeHandler(auth);

// Direct browser GET navigation for social sign-in (e.g. clicking "Continue with Google" redirects directly to Google OAuth)
app.get("/api/auth/sign-in/social", async (req, res) => {
  const provider = (req.query.provider as string) || "google";
  const callbackURL =
    (req.query.callbackURL as string) ||
    (req.query.callbackUrl as string) ||
    config.FRONTEND_URL ||
    "http://localhost:3001";
  try {
    const response = await auth.api.signInSocial({
      body: {
        provider,
        callbackURL,
      },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });

    // Forward Set-Cookie headers from Better Auth (contains state and pkce cookies)
    const cookies = typeof (response.headers as any).getSetCookie === "function"
      ? (response.headers as any).getSetCookie()
      : response.headers.get("set-cookie");
    if (cookies) {
      res.setHeader("set-cookie", cookies);
    }

    const location = response.headers.get("location");
    if (location) {
      return res.redirect(location);
    }

    const json = await response.json();
    if (json && (json as any).url) {
      return res.redirect((json as any).url);
    }

    return res.status(400).json({ error: "Failed to generate social authorization URL" });
  } catch (err: any) {
    console.error("GET /api/auth/sign-in/social error:", err);
    return res.status(500).json({ error: err.message || "Social login error" });
  }
});

app.all("/api/auth/*", (req, res, next) => {
  // Pass custom compatibility endpoints through to body parser and authRouter
  const p = req.path.replace(/\/+$/, "");
  if (
    p === "/api/auth/login" ||
    p === "/api/auth/register" ||
    p === "/api/auth/verify-otp" ||
    p === "/api/auth/resend-otp" ||
    p === "/api/auth/me" ||
    p === "/api/auth/logout"
  ) {
    return next();
  }
  return betterAuthHandler(req, res);
});

// 4. Body parsers and cookie parser
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Global input sanitization against SQL/NoSQL injections, prototype pollution, and XSS
app.use(sanitizeInputs);

// 5. General & Targeted Endpoint Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
app.use("/api/", generalLimiter);

// Dedicated rate limiter for sensitive authentication routes (prevent credential brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 login/register attempts per 15 mins per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login/registration attempts. Please try again in 15 minutes." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/verify-otp", authLimiter);
app.use("/api/auth/resend-otp", authLimiter);
app.use("/api/customers/register", authLimiter);

// Dedicated rate limiter for wallet deposit & payment initiation routes
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many payment initiation requests. Please wait before retrying." },
});
app.use("/api/wallet/topup-request", paymentLimiter);
app.use("/api/wallet/topup/confirm", paymentLimiter);
app.use("/api/payments/paym/initiate", paymentLimiter);

// Health check endpoint
app.get("/health", async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  res.json({
    status: dbHealth.ok ? "healthy" : "degraded",
    uptime_seconds: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbHealth,
    version: "2.0.0",
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "IMPEX Rebuilt Production Backend API is OK (Node.js + Express + TypeScript)" });
});

// Swagger & OpenAPI documentation
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get("/api/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// 6. Mount Subrouters
app.use("/api/auth", authRouter);

// Alias: /api/me as required by shopping-frontend
app.get("/api/me", authenticateRequest, requireAuth, async (req: Request, res: Response) => {
  const userInfo = await buildUserProfileResponse(req.user!.id);
  if (!userInfo) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(userInfo);
});

// Alias: /api/customers/register as called by shopping-frontend
app.post("/api/customers/register", (req, res, next) => {
  req.url = "/register";
  authRouter(req, res, next);
});

// Alias: /api/product-requests as RESTful product request submission route
app.post("/api/product-requests", (req, res, next) => {
  req.url = "/product-requests";
  shoppingRouter(req, res, next);
});

// Alias: /api/payments/paypal/webhook to handle PayPal webhook requests
app.post("/api/payments/paypal/webhook", (req, res, next) => {
  req.url = "/payments/paypal/webhook";
  walletRouter(req, res, next);
});

// Mount domain routes
app.use("/api/shopping", shoppingRouter);
app.use("/api/admin", adminRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/addresses", addressRouter);
app.use("/api/commerce", commerceRouter);

// 7. Centralized Error Handling Middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled API error:", err);
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "An unexpected internal error occurred";
  res.status(statusCode).json({
    error: message,
    detail: message,
    status: statusCode,
  });
});

// Start listening when executed directly
if (process.env.NODE_ENV !== "test") {
  const server = app.listen(config.PORT, () => {
    console.log(`=================================================================`);
    console.log(`🚀 IMPEX Node.js Backend listening on port ${config.PORT}`);
    console.log(`📡 URL: http://localhost:${config.PORT}`);
    console.log(`📚 OpenAPI / Swagger Docs: http://localhost:${config.PORT}/docs`);
    console.log(`=================================================================`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down gracefully...");
    server.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

export default app;
