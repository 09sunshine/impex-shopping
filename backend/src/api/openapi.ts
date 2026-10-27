export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "IMPEX Rebuilt Production Backend API",
    version: "2.0.0",
    description:
      "Enterprise Node.js + Express + TypeScript + Supabase + Better Auth API for IMPEX International Shopping platform serving Haiti.",
    contact: {
      name: "IMPEX Engineering",
      email: "admin@impexht.com",
      url: "https://shopping.impexht.com",
    },
  },
  servers: [
    {
      url: "http://localhost:8000",
      description: "Local development server",
    },
    {
      url: "https://impex-fastapi-production.up.railway.app",
      description: "Production server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT / Session Token",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "access_token",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
          detail: { type: "string" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["password"],
        properties: {
          identifier: { type: "string" },
          email: { type: "string" },
          password: { type: "string" },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["email", "password", "first_name", "last_name"],
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          email: { type: "string" },
          password: { type: "string" },
          phone: { type: "string" },
        },
      },
      WalletBalanceResponse: {
        type: "object",
        properties: {
          id: { type: "string" },
          wallet_number: { type: "string" },
          balance: { type: "number" },
          balance_usd: { type: "number" },
          balance_htg: { type: "number" },
          spendable_balance: { type: "number" },
          spendable_balance_usd: { type: "number" },
          spendable_balance_htg: { type: "number" },
          reserved_balance: { type: "number" },
          reserved_balance_usd: { type: "number" },
          is_active: { type: "boolean" },
          is_frozen: { type: "boolean" },
        },
      },
      OrderSubmissionRequest: {
        type: "object",
        required: ["product_url"],
        properties: {
          product_url: { type: "string" },
          product_name: { type: "string" },
          specifications: { type: "object" },
          variant: { type: "string" },
          size: { type: "string" },
          color: { type: "string" },
          quantity: { type: "integer", default: 1 },
          customer_estimated_price: { type: "number" },
          customer_estimated_currency: { type: "string", default: "USD" },
          notes: { type: "string" },
          selected_address_id: { type: "string" },
          idempotency_key: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "System Health & Liveness Check",
        responses: {
          "200": { description: "Service is healthy" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Customer & Staff Login",
        requestBody: {
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } },
          },
        },
        responses: {
          "200": { description: "Authenticated successfully" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/api/customers/register": {
      post: {
        summary: "Customer Registration",
        requestBody: {
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } },
          },
        },
        responses: {
          "201": { description: "Customer created successfully" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        summary: "Current User Profile & Wallet Details",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "Current user profile" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/wallet/balance": {
      get: {
        summary: "Authoritative Wallet Balance",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": {
            description: "Wallet balance from ledger",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/WalletBalanceResponse" } },
            },
          },
        },
      },
    },
    "/api/shopping/merchants": {
      get: {
        summary: "List Supported International Merchants",
        responses: {
          "200": { description: "Supported merchants list" },
        },
      },
    },
    "/api/shopping/resolve-url": {
      post: {
        summary: "SSRF-Safe URL Inspection & Normalization",
        responses: {
          "200": { description: "Normalized URL info" },
        },
      },
    },
    "/api/shopping/orders": {
      post: {
        summary: "Submit International Concierge Order by URL",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/OrderSubmissionRequest" } },
          },
        },
        responses: {
          "201": { description: "Order request created" },
        },
      },
    },
  },
};
