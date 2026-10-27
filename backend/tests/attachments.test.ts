import { describe, it, expect } from "vitest";
import { ScreenshotAttachmentService } from "../src/modules/product-engine/attachments.js";

describe("Screenshot Security & Magic Bytes Verification", () => {
  it("should validate real JPEG magic bytes", () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const res = ScreenshotAttachmentService.validateImageBuffer(jpegBuffer);
    expect(res.isValid).toBe(true);
    expect(res.mimeType).toBe("image/jpeg");
  });

  it("should validate real PNG magic bytes", () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const res = ScreenshotAttachmentService.validateImageBuffer(pngBuffer);
    expect(res.isValid).toBe(true);
    expect(res.mimeType).toBe("image/png");
  });

  it("should validate real WebP magic bytes", () => {
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, // "WEBP"
    ]);
    const res = ScreenshotAttachmentService.validateImageBuffer(webpBuffer);
    expect(res.isValid).toBe(true);
    expect(res.mimeType).toBe("image/webp");
  });

  it("should reject fake images (e.g. malicious executable renamed to .jpg)", () => {
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]); // MZ header
    const res = ScreenshotAttachmentService.validateImageBuffer(exeBuffer);
    expect(res.isValid).toBe(false);
  });

  it("should reject shell scripts or HTML disguised as images", () => {
    const scriptBuffer = Buffer.from("<script>alert('xss')</script>PNG");
    const res = ScreenshotAttachmentService.validateImageBuffer(scriptBuffer);
    expect(res.isValid).toBe(false);
  });
});
