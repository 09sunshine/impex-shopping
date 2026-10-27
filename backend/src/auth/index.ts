import { betterAuth } from "better-auth";
import { pool } from "../db/connection.js";
import { config } from "../config/index.js";

const socialProvidersConfig: Record<string, any> = {};

if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
  socialProvidersConfig.google = {
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  database: pool,
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.BETTER_AUTH_URL,
  trustedOrigins: Array.from(
    new Set([
      config.FRONTEND_URL,
      ...config.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "https://shopping.impexht.com",
      "https://www.impexht.com",
    ])
  ),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: socialProvidersConfig,
  user: {
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "customer",
        input: false, // Prevent user tampering with role during sign-up
      },
    },
  },
  session: {
    fields: {
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      userId: "user_id",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: false,
    },
  },
  account: {
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      userId: "user_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  advanced: {
    useSecureCookies: config.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: !!config.COOKIE_DOMAIN,
      domain: config.COOKIE_DOMAIN,
    },
  },
});

export type Auth = typeof auth;
