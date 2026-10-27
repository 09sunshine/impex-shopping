import crypto from "crypto";
import { query, pool } from "./connection.js";
import { WalletLedgerService } from "../modules/wallet/ledger.js";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function seedAdmin(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || "duguepiterson@gmail.com";
  const adminPasswordPlain = process.env.ADMIN_PASSWORD || "Piterson4724#";
  const hashedPassword = hashPassword(adminPasswordPlain);

  console.log(`[Seed] Checking admin account: ${adminEmail}...`);

  try {
    // 1. Check if user already exists
    const userRes = await query(`SELECT * FROM "user" WHERE email = $1`, [adminEmail]);

    let userId: string;

    if (userRes.rows.length > 0) {
      userId = userRes.rows[0].id;
      console.log(`[Seed] User ${adminEmail} exists (ID: ${userId}). Updating role to 'admin' and password...`);

      await query(
        `UPDATE "user" 
         SET role = 'admin', email_verified = TRUE, updated_at = NOW() 
         WHERE id = $1`,
        [userId]
      );

      // Update or insert credential account
      const accRes = await query(
        `SELECT id FROM "account" WHERE user_id = $1 AND provider_id = 'credential'`,
        [userId]
      );

      if (accRes.rows.length > 0) {
        await query(
          `UPDATE "account" 
           SET password = $1, account_id = $2, updated_at = NOW() 
           WHERE id = $3`,
          [hashedPassword, adminEmail, accRes.rows[0].id]
        );
      } else {
        await query(
          `INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
           VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())`,
          [crypto.randomUUID(), adminEmail, userId, hashedPassword]
        );
      }
    } else {
      userId = crypto.randomUUID();
      console.log(`[Seed] Creating new admin user ${adminEmail} (ID: ${userId})...`);

      await query(
        `INSERT INTO "user" (id, name, email, email_verified, role, created_at, updated_at)
         VALUES ($1, $2, $3, TRUE, 'admin', NOW(), NOW())`,
        [userId, "Piterson Dugue", adminEmail]
      );

      await query(
        `INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
         VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())`,
        [crypto.randomUUID(), adminEmail, userId, hashedPassword]
      );
    }

    // 2. Ensure customer profile exists
    let custRes = await query(`SELECT id FROM customer_profiles WHERE user_id = $1`, [userId]);
    let customerId: string;

    if (custRes.rows.length === 0) {
      console.log(`[Seed] Creating customer profile for admin...`);
      const newCust = await query(
        `INSERT INTO customer_profiles (user_id, first_name, last_name, phone, gender, is_verified)
         VALUES ($1, 'Piterson', 'Dugue', '+509 3000-0000', 'M', TRUE)
         RETURNING id`,
        [userId]
      );
      customerId = newCust.rows[0].id;
    } else {
      customerId = custRes.rows[0].id;
      await query(`UPDATE customer_profiles SET is_verified = TRUE, updated_at = NOW() WHERE id = $1`, [customerId]);
    }

    // 3. Ensure primary address exists
    const addrRes = await query(`SELECT id FROM addresses WHERE user_id = $1 AND is_primary = TRUE`, [userId]);
    if (addrRes.rows.length === 0) {
      console.log(`[Seed] Creating primary address for admin...`);
      await query(
        `INSERT INTO addresses (user_id, country, state, city, street, postal_code, managed_state_code, is_primary)
         VALUES ($1, 'Haiti', 'Ouest', 'Port-au-Prince', 'IMPEX Logistics Center, Route de l''Aéroport', 'HT6110', 'OU', TRUE)`,
        [userId]
      );
    }

    // 4. Ensure wallet exists
    console.log(`[Seed] Provisioning wallet for admin...`);
    await WalletLedgerService.getOrCreateWallet(customerId);

    // 5. Enforce that duguepiterson@gmail.com is the ONLY admin account
    console.log(`[Seed] Ensuring ${adminEmail} is the only admin account...`);
    const demoteRes = await query(
      `UPDATE "user" 
       SET role = 'customer', updated_at = NOW() 
       WHERE email != $1 AND role IN ('admin', 'superadmin')`,
      [adminEmail]
    );
    if (demoteRes.rowCount && demoteRes.rowCount > 0) {
      console.log(`[Seed] Demoted ${demoteRes.rowCount} non-designated admin user(s) to 'customer'.`);
    }

    console.log(`[Seed] Admin account ${adminEmail} seeded successfully with password 'Piterson4724#'.`);
  } catch (err) {
    console.error("[Seed] Error seeding admin account:", err);
    throw err;
  }
}

// Execute if run directly via CLI (npm run db:seed or tsx src/db/seed.ts)
if (process.argv[1]?.includes("seed.ts") || process.argv[1]?.includes("seed.js")) {
  seedAdmin()
    .then(async () => {
      console.log("[Seed] Completed.");
      await pool.end();
    })
    .catch(async (err) => {
      console.error("[Seed] Failed:", err);
      await pool.end();
      process.exit(1);
    });
}
