import { Router, Request, Response } from "express";
import { authenticateRequest, requireAuth } from "../middleware/auth.js";
import { query } from "../db/connection.js";

export const addressRouter = Router();

addressRouter.use(authenticateRequest, requireAuth);

/**
 * GET /api/addresses/
 * List addresses for customer or requested user if staff.
 */
addressRouter.get("/", async (req: Request, res: Response) => {
  try {
    const requestedUserId = req.query.user_id as string | undefined;
    const targetUserId = req.user!.isStaff && requestedUserId ? requestedUserId : req.user!.id;

    const addrsRes = await query(
      `SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_primary DESC, created_at DESC`,
      [targetUserId]
    );

    const addresses = addrsRes.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      label: row.label || "Home",
      recipient_name: row.recipient_name || req.user?.name || "",
      phone: row.phone || "",
      country: row.country || "Haiti",
      state: row.state || "Ouest",
      city: row.city || "Port-au-Prince",
      street: row.street,
      house: row.street,
      address_line: row.street,
      postal_code: row.postal_code || "HT6110",
      managed_state_code: row.managed_state_code || "OU",
      is_primary: !!row.is_primary,
      notes: row.notes || "",
      created_at: row.created_at,
    }));

    res.json({ addresses });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch addresses", detail: err.message });
  }
});

/**
 * POST /api/addresses/
 * Create new saved address for customer.
 */
addressRouter.post("/", async (req: Request, res: Response) => {
  try {
    const {
      label = "Home",
      recipient_name,
      phone,
      country = "Haiti",
      state = "Ouest",
      city = "Port-au-Prince",
      street,
      house,
      postal_code = "HT6110",
      managed_state_code = "OU",
      is_primary = false,
      notes,
    } = req.body;

    const streetAddress = (street || house || "").trim();
    if (!streetAddress) {
      res.status(400).json({ detail: "Street address is required" });
      return;
    }

    const cleanLabel = (label || "Home").trim();
    const cleanRecipient = (recipient_name || req.user?.name || "").trim();
    const cleanPhone = (phone || "").trim();

    if (is_primary) {
      // Unmark any previous primary address
      await query(`UPDATE addresses SET is_primary = FALSE WHERE user_id = $1`, [req.user!.id]);
    } else {
      // If user has no existing addresses, make this first one primary automatically
      const existing = await query(`SELECT id FROM addresses WHERE user_id = $1 LIMIT 1`, [req.user!.id]);
      if (existing.rows.length === 0) {
        // First address defaults to primary
        req.body.is_primary = true;
      }
    }

    const makePrimary = !!req.body.is_primary;

    const insertRes = await query(
      `INSERT INTO addresses (user_id, label, recipient_name, phone, country, state, city, street, postal_code, managed_state_code, is_primary, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        req.user!.id,
        cleanLabel,
        cleanRecipient,
        cleanPhone,
        country,
        state,
        city,
        streetAddress,
        postal_code,
        managed_state_code,
        makePrimary,
        notes || null,
      ]
    );

    const row = insertRes.rows[0];
    res.status(201).json({
      id: row.id,
      user_id: row.user_id,
      label: row.label || "Home",
      recipient_name: row.recipient_name,
      phone: row.phone,
      country: row.country,
      state: row.state,
      city: row.city,
      street: row.street,
      house: row.street,
      address_line: row.street,
      postal_code: row.postal_code,
      managed_state_code: row.managed_state_code,
      is_primary: row.is_primary,
      notes: row.notes,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create address", detail: err.message });
  }
});

/**
 * PUT /api/addresses/:id
 * Update an existing saved address.
 */
addressRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const addressId = req.params.id;
    const {
      label,
      recipient_name,
      phone,
      country,
      state,
      city,
      street,
      house,
      postal_code,
      managed_state_code,
      is_primary,
      notes,
    } = req.body;

    // Check ownership unless staff
    const checkRes = await query(`SELECT * FROM addresses WHERE id = $1`, [addressId]);
    if (checkRes.rows.length === 0) {
      res.status(404).json({ detail: "Address not found" });
      return;
    }

    const existing = checkRes.rows[0];
    if (!req.user!.isStaff && existing.user_id !== req.user!.id) {
      res.status(403).json({ detail: "Permission denied" });
      return;
    }

    if (is_primary) {
      await query(`UPDATE addresses SET is_primary = FALSE WHERE user_id = $1`, [existing.user_id]);
    }

    const updated = await query(
      `UPDATE addresses
       SET label = COALESCE($1, label),
           recipient_name = COALESCE($2, recipient_name),
           phone = COALESCE($3, phone),
           country = COALESCE($4, country),
           state = COALESCE($5, state),
           city = COALESCE($6, city),
           street = COALESCE($7, street),
           postal_code = COALESCE($8, postal_code),
           managed_state_code = COALESCE($9, managed_state_code),
           is_primary = COALESCE($10, is_primary),
           notes = COALESCE($11, notes),
           updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        label !== undefined ? label : null,
        recipient_name !== undefined ? recipient_name : null,
        phone !== undefined ? phone : null,
        country !== undefined ? country : null,
        state !== undefined ? state : null,
        city !== undefined ? city : null,
        (street || house) !== undefined ? (street || house) : null,
        postal_code !== undefined ? postal_code : null,
        managed_state_code !== undefined ? managed_state_code : null,
        is_primary !== undefined ? is_primary : null,
        notes !== undefined ? notes : null,
        addressId,
      ]
    );

    const row = updated.rows[0];
    res.json({
      id: row.id,
      user_id: row.user_id,
      label: row.label || "Home",
      recipient_name: row.recipient_name,
      phone: row.phone,
      country: row.country,
      state: row.state,
      city: row.city,
      street: row.street,
      house: row.street,
      address_line: row.street,
      postal_code: row.postal_code,
      managed_state_code: row.managed_state_code,
      is_primary: row.is_primary,
      notes: row.notes,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update address", detail: err.message });
  }
});

/**
 * DELETE /api/addresses/:id
 * Delete a saved address.
 */
addressRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const addressId = req.params.id;

    // Check ownership unless staff
    const checkRes = await query(`SELECT * FROM addresses WHERE id = $1`, [addressId]);
    if (checkRes.rows.length === 0) {
      res.status(404).json({ detail: "Address not found" });
      return;
    }

    const existing = checkRes.rows[0];
    if (!req.user!.isStaff && existing.user_id !== req.user!.id) {
      res.status(403).json({ detail: "Permission denied" });
      return;
    }

    await query(`DELETE FROM addresses WHERE id = $1`, [addressId]);

    // If deleted address was primary, make next address primary if any exist
    if (existing.is_primary) {
      await query(
        `UPDATE addresses
         SET is_primary = TRUE
         WHERE id = (
           SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
         )`,
        [existing.user_id]
      );
    }

    res.json({ success: true, message: "Address deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete address", detail: err.message });
  }
});

/**
 * PATCH /api/addresses/:id/primary
 * Mark an address as primary default.
 */
addressRouter.patch("/:id/primary", async (req: Request, res: Response) => {
  try {
    const addressId = req.params.id;

    const checkRes = await query(`SELECT * FROM addresses WHERE id = $1`, [addressId]);
    if (checkRes.rows.length === 0) {
      res.status(404).json({ detail: "Address not found" });
      return;
    }

    const existing = checkRes.rows[0];
    if (!req.user!.isStaff && existing.user_id !== req.user!.id) {
      res.status(403).json({ detail: "Permission denied" });
      return;
    }

    await query(`UPDATE addresses SET is_primary = FALSE WHERE user_id = $1`, [existing.user_id]);
    const updated = await query(
      `UPDATE addresses SET is_primary = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [addressId]
    );

    res.json({ success: true, address: updated.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to set default address", detail: err.message });
  }
});

/**
 * GET /api/addresses/company
 * Returns company logistics receiving depot addresses (e.g. Miami Depot).
 */
addressRouter.get("/company", async (_req: Request, res: Response) => {
  res.json({
    company_addresses: [
      {
        id: "depot-miami",
        name: "IMPEX Logistics Florida Hub",
        country: "United States",
        state: "FL",
        city: "Doral",
        street: "8400 NW 25th St",
        postal_code: "33198",
        phone: "+1 (305) 500-4673",
      },
      {
        id: "depot-pap",
        name: "IMPEX Central Agency Haiti",
        country: "Haiti",
        state: "Ouest",
        city: "Port-au-Prince",
        street: "87, Ave Martin Luther King",
        postal_code: "HT6110",
        phone: "+509 3700-4673",
      },
    ],
  });
});
