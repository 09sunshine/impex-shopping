import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { EmailService } from "../src/modules/email/service.js";

describe("IMPEX Authentication & OTP Flow", () => {
  it("EmailService.generateOtp returns a valid 6-digit string", () => {
    const otp = EmailService.generateOtp();
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });

  it("POST /api/auth/login requires email/identifier and password", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/register requires valid email and password >= 6 chars", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "test@example.com",
      password: "123", // too short
    });
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("6 characters");
  });

  it("POST /api/auth/verify-otp requires email, otp, and purpose", async () => {
    const res = await request(app).post("/api/auth/verify-otp").send({
      email: "test@example.com",
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/verify-otp rejects non-existent or incorrect OTP", async () => {
    const res = await request(app).post("/api/auth/verify-otp").send({
      email: "nonexistent@impexht.com",
      otp: "999999",
      purpose: "LOGIN",
    });
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("No pending verification found");
  });

  it("POST /api/auth/resend-otp requires email and purpose", async () => {
    const res = await request(app).post("/api/auth/resend-otp").send({});
    expect(res.status).toBe(400);
  });
});
