import { Request, Response, NextFunction } from "express";

/**
 * Strips dangerous characters and characters used in SQL/NoSQL injection and XSS.
 */
function sanitizeString(str: string): string {
  if (typeof str !== "string") return str;
  return (
    str
      // Strip null bytes
      .replace(/\0/g, "")
      // Strip control characters except newline and tab
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Strip <script> and </script> tags case-insensitively
      .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
      .replace(/<\s*script[^>]*>/gi, "")
      .replace(/javascript\s*:/gi, "")
  );
}

/**
 * Recursively walks an object or array, stripping:
 * 1. Prototype pollution keys (__proto__, constructor, prototype)
 * 2. NoSQL injection operators (keys starting with $)
 * 3. Dangerous strings
 */
function sanitizeData(data: any, depth = 0): any {
  if (depth > 20) return null; // Guard against deeply nested or circular structures
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    return sanitizeString(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, depth + 1));
  }

  if (typeof data === "object") {
    const cleanObj: Record<string, any> = {};

    for (const key of Object.keys(data)) {
      // Prototype pollution defense
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }

      // NoSQL injection defense: block operators like $gt, $ne, $where
      if (key.startsWith("$") || key.includes(".")) {
        continue;
      }

      const cleanKey = sanitizeString(key);
      cleanObj[cleanKey] = sanitizeData(data[key], depth + 1);
    }

    return cleanObj;
  }

  return data;
}

/**
 * Global input sanitization middleware across body, query, and params.
 */
export function sanitizeInputs(req: Request, _res: Response, next: NextFunction): void {
  try {
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeData(req.body);
    }
    if (req.query && typeof req.query === "object") {
      req.query = sanitizeData(req.query);
    }
    if (req.params && typeof req.params === "object") {
      req.params = sanitizeData(req.params);
    }
  } catch (err) {
    console.warn("[Sanitizer Warning] Error during input sanitization:", err);
  }
  next();
}
