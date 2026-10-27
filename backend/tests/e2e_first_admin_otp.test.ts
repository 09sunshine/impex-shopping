import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { query } from "../src/db/connection.js";
import { seedAdmin } from "../src/db/seed.js";

describe("E2E User Registration (with OTP) & Direct Login Flow", () => {
  const customerEmail = `shopper_test_${Date.now()}@test.impexht.com`;
  const password = "SecurePassword123!";
  const designatedAdminEmail = "duguepiterson@gmail.com";
  const designatedAdminPassword = "Piterson4724#";

  beforeAll(async () => {
    // Ensure admin is seeded
    await seedAdmin();
    // Clean state for test email
    await query(`DELETE FROM auth_otps WHERE email = $1`, [customerEmail]);
  }, 30000);

  afterAll(async () => {
    // Clean up created test user and OTPs
    await query(`DELETE FROM auth_otps WHERE email = $1`, [customerEmail]);
    await query(`DELETE FROM "user" WHERE email = $1`, [customerEmail]);
  }, 30000);

  it("Step 1: User registration initiates one-time email OTP challenge", async () => {
    const regRes = await request(app).post("/api/auth/register").send({
      email: customerEmail,
      password: password,
      first_name: "Jean",
      last_name: "Shopper",
    });

    expect(regRes.status).toBe(200);
    expect(regRes.body.status).toBe("OTP_REQUIRED");
    expect(regRes.body.purpose).toBe("REGISTER");
    expect(regRes.body.email).toBe(customerEmail);

    // Verify OTP record exists in DB
    const otpRes = await query(`SELECT * FROM auth_otps WHERE email = $1 AND purpose = 'REGISTER'`, [customerEmail]);
    expect(otpRes.rows.length).toBe(1);
    expect(otpRes.rows[0].otp_code).toHaveLength(6);
  }, 30000);

  it("Step 2: Submitting wrong OTP fails with 400", async () => {
    const failRes = await request(app).post("/api/auth/verify-otp").send({
      email: customerEmail,
      otp: "000000",
      purpose: "REGISTER",
    });

    expect(failRes.status).toBe(400);
    expect(failRes.body.detail).toContain("Incorrect verification code");
  }, 15000);

  it("Step 3: Submitting valid OTP creates registered user with 'customer' role", async () => {
    const otpRes = await query(`SELECT otp_code FROM auth_otps WHERE email = $1 AND purpose = 'REGISTER'`, [customerEmail]);
    const validOtp = otpRes.rows[0].otp_code;

    const verifyRes = await request(app).post("/api/auth/verify-otp").send({
      email: customerEmail,
      otp: validOtp,
      purpose: "REGISTER",
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body).toHaveProperty("access_token");
    expect(verifyRes.body.email).toBe(customerEmail);
    // User registration creates customer
    expect(verifyRes.body.role).toBe("customer");
    expect(verifyRes.body.user.role).toBe("customer");
    // Verify wallet balance is 100% real (starts at $0.00 from DB)
    expect(verifyRes.body.wallet.balance).toBe(0);
  }, 15000);

  it("Step 4: Once registered, subsequent Customer login is DIRECT (no OTP needed)", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: customerEmail,
      password: password,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty("access_token");
    expect(loginRes.body.role).toBe("customer");
    expect(loginRes.body.user.email).toBe(customerEmail);
  }, 15000);

  it("Step 5: Designated Admin account logs in directly with 'admin' role", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: designatedAdminEmail,
      password: designatedAdminPassword,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty("access_token");
    expect(loginRes.body.email).toBe(designatedAdminEmail);
    expect(loginRes.body.role).toBe("admin");
    expect(loginRes.body.user.role).toBe("admin");
    expect(loginRes.body.admin).not.toBeNull();
  }, 15000);
});
