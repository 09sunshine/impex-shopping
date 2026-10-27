import fs from "fs";
import path from "path";
import crypto from "crypto";
import { config } from "../../config/index.js";
import { query } from "../../db/connection.js";

export interface AttachmentRecord {
  id: string;
  original_filename: string;
  stored_filename: string;
  file_path: string;
  mime_type: string;
  file_size_bytes: number;
  image_width?: number;
  image_height?: number;
  sha256_hash: string;
  created_at: string;
  preview_url: string;
}

// Magic bytes signatures for authorized image formats
const SIGNATURES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46], // Starts with "RIFF" and has "WEBP" at byte 8
};

export class ScreenshotAttachmentService {
  /**
   * Validate image magic bytes to prevent renamed executables or malicious files.
   */
  static validateImageBuffer(buffer: Buffer): { isValid: boolean; mimeType: string } {
    if (buffer.length < 12) {
      return { isValid: false, mimeType: "" };
    }

    // Check JPEG
    if (
      buffer[0] === SIGNATURES["image/jpeg"][0] &&
      buffer[1] === SIGNATURES["image/jpeg"][1] &&
      buffer[2] === SIGNATURES["image/jpeg"][2]
    ) {
      return { isValid: true, mimeType: "image/jpeg" };
    }

    // Check PNG
    if (
      buffer[0] === SIGNATURES["image/png"][0] &&
      buffer[1] === SIGNATURES["image/png"][1] &&
      buffer[2] === SIGNATURES["image/png"][2] &&
      buffer[3] === SIGNATURES["image/png"][3]
    ) {
      return { isValid: true, mimeType: "image/png" };
    }

    // Check WebP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { isValid: true, mimeType: "image/webp" };
    }

    return { isValid: false, mimeType: "" };
  }

  /**
   * Process uploaded screenshot, validate bytes, compute hash, and store privately.
   */
  static async saveScreenshot(
    fileBuffer: Buffer,
    originalName: string,
    userId?: string
  ): Promise<AttachmentRecord> {
    const maxSizeBytes = config.SCREENSHOT_MAX_FILE_SIZE_MB * 1024 * 1024;
    if (fileBuffer.length > maxSizeBytes) {
      throw new Error(`File exceeds max size of ${config.SCREENSHOT_MAX_FILE_SIZE_MB}MB`);
    }

    const { isValid, mimeType } = this.validateImageBuffer(fileBuffer);
    if (!isValid) {
      throw new Error("Invalid image file format. Only JPEG, PNG, and WebP images are permitted.");
    }

    const sha256Hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const extension = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
    const storedFilename = `${crypto.randomUUID()}${extension}`;

    // Ensure upload directory exists for local cache/fallback
    const uploadDir = path.resolve(process.cwd(), config.SCREENSHOT_UPLOAD_DIR);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const localFilePath = path.join(uploadDir, storedFilename);
    fs.writeFileSync(localFilePath, fileBuffer);

    let finalFilePath = localFilePath;

    // In production or when Supabase credentials are present, store directly in Supabase Storage bucket
    if (config.SUPABASE_URL && config.SUPABASE_SERVICE_KEY) {
      try {
        const bucket = config.SUPABASE_STORAGE_BUCKET || "impex-attachments";
        const cleanBaseUrl = config.SUPABASE_URL.replace(/\/$/, "");
        const uploadEndpoint = `${cleanBaseUrl}/storage/v1/object/${bucket}/${storedFilename}`;

        const uploadRes = await fetch(uploadEndpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.SUPABASE_SERVICE_KEY}`,
            "apikey": config.SUPABASE_SERVICE_KEY,
            "Content-Type": mimeType,
            "x-upsert": "true",
          },
          body: fileBuffer,
        });

        if (uploadRes.ok) {
          const publicUrl = `${cleanBaseUrl}/storage/v1/object/public/${bucket}/${storedFilename}`;
          finalFilePath = publicUrl;
        } else {
          const errText = await uploadRes.text().catch(() => "");
          console.warn("Supabase Storage bucket upload notice (using local file):", errText || uploadRes.statusText);
        }
      } catch (uploadErr) {
        console.warn("Supabase Storage upload warning (fallback to local):", uploadErr);
      }
    }

    const insertRes = await query(
      `INSERT INTO private_attachments (
         user_id, original_filename, stored_filename, file_path, mime_type,
         file_size_bytes, sha256_hash
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId || null,
        path.basename(originalName).substring(0, 100),
        storedFilename,
        finalFilePath,
        mimeType,
        fileBuffer.length,
        sha256Hash,
      ]
    );

    const row = insertRes.rows[0];
    return {
      id: row.id,
      original_filename: row.original_filename,
      stored_filename: row.stored_filename,
      file_path: row.file_path,
      mime_type: row.mime_type,
      file_size_bytes: Number(row.file_size_bytes),
      image_width: row.image_width,
      image_height: row.image_height,
      sha256_hash: row.sha256_hash,
      created_at: row.created_at,
      preview_url: `/api/shopping/screenshots/${row.id}`,
    };
  }

  /**
   * Fetch private attachment with strict IDOR ownership check.
   */
  static async getAttachmentForUser(
    attachmentId: string,
    userId?: string,
    isStaff: boolean = false
  ): Promise<{ filePath: string; mimeType: string; originalFilename: string; isRemote?: boolean; remoteUrl?: string }> {
    const res = await query(
      `SELECT * FROM private_attachments WHERE id = $1`,
      [attachmentId]
    );

    if (res.rows.length === 0) {
      throw new Error("Attachment not found");
    }

    const attachment = res.rows[0];

    // IDOR Check: Must be file owner or staff member
    if (!isStaff && attachment.user_id && attachment.user_id !== userId) {
      throw new Error("Access denied to private attachment");
    }

    const isHttp = typeof attachment.file_path === "string" && (attachment.file_path.startsWith("http://") || attachment.file_path.startsWith("https://"));

    if (isHttp) {
      return {
        filePath: attachment.file_path,
        mimeType: attachment.mime_type,
        originalFilename: attachment.original_filename,
        isRemote: true,
        remoteUrl: attachment.file_path,
      };
    }

    if (!fs.existsSync(attachment.file_path)) {
      throw new Error("Attachment file missing on server storage");
    }

    return {
      filePath: attachment.file_path,
      mimeType: attachment.mime_type,
      originalFilename: attachment.original_filename,
      isRemote: false,
    };
  }
}
