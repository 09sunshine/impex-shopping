import { pool, withTransaction, query } from "../../db/connection.js";
import { ExchangeRateService } from "../currency/exchange.js";
import pg from "pg";

export interface WalletBalance {
  id: string;
  wallet_number: string;
  balance: number;
  balance_usd: number;
  balance_htg: number;
  spendable_balance: number;
  spendable_balance_usd: number;
  spendable_balance_htg: number;
  reserved_balance: number;
  reserved_balance_usd: number;
  is_active: boolean;
  is_frozen: boolean;
}

export interface LedgerEntryRecord {
  id: string;
  wallet_id: string;
  entry_type: string;
  direction: "CREDIT" | "DEBIT";
  amount_usd: number;
  balance_after_usd: number;
  currency: string;
  reference_id: string | null;
  idempotency_key: string | null;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}

// Live dynamic USD -> HTG conversion rate for Haiti operations from ExchangeRateService
function getLiveHtgRate(): number {
  return ExchangeRateService.getCachedRate();
}

function toCents(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}

function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export class WalletLedgerService {
  /**
   * Get or create a wallet for a customer.
   */
  static async getOrCreateWallet(customerId: string): Promise<WalletBalance> {
    const existing = await query(
      `SELECT * FROM wallet_accounts WHERE customer_id = $1`,
      [customerId]
    );

    if (existing.rows.length > 0) {
      return this.getWalletBalance(existing.rows[0].id);
    }

    const walletNumber = `IMX-WLT-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const created = await query(
      `INSERT INTO wallet_accounts (customer_id, wallet_number, currency, is_active, is_frozen)
       VALUES ($1, $2, 'USD', TRUE, FALSE)
       RETURNING id`,
      [customerId, walletNumber]
    );

    return this.getWalletBalance(created.rows[0].id);
  }

  /**
   * Authoritative balance calculation derived directly from the immutable ledger
   * and active escrow reservations.
   */
  static async getWalletBalance(walletId: string): Promise<WalletBalance> {
    const walletRes = await query(
      `SELECT * FROM wallet_accounts WHERE id = $1`,
      [walletId]
    );

    if (walletRes.rows.length === 0) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const wallet = walletRes.rows[0];

    // Compute total balance directly from posted ledger entries and active reserved funds in parallel
    const [ledgerSum, resSum] = await Promise.all([
      query(
        `SELECT 
           COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN ROUND(amount_usd * 100) ELSE 0 END), 0) as total_credits_cents,
           COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN ROUND(amount_usd * 100) ELSE 0 END), 0) as total_debits_cents
         FROM ledger_entries 
         WHERE wallet_id = $1`,
        [walletId]
      ),
      query(
        `SELECT COALESCE(SUM(ROUND(amount_usd * 100)), 0) as total_reserved_cents
         FROM wallet_reservations 
         WHERE wallet_id = $1 AND status = 'ACTIVE'`,
        [walletId]
      ),
    ]);

    const totalCreditsCents = Number(ledgerSum.rows[0].total_credits_cents);
    const totalDebitsCents = Number(ledgerSum.rows[0].total_debits_cents);
    const totalBalanceCents = totalCreditsCents - totalDebitsCents;
    const reservedCents = Number(resSum.rows[0].total_reserved_cents);
    const spendableCents = Math.max(0, totalBalanceCents - reservedCents);

    const balanceUsd = fromCents(totalBalanceCents);
    const spendableUsd = fromCents(spendableCents);
    const reservedUsd = fromCents(reservedCents);

    return {
      id: wallet.id,
      wallet_number: wallet.wallet_number,
      balance: balanceUsd,
      balance_usd: balanceUsd,
      balance_htg: Math.round(balanceUsd * getLiveHtgRate() * 100) / 100,
      spendable_balance: spendableUsd,
      spendable_balance_usd: spendableUsd,
      spendable_balance_htg: Math.round(spendableUsd * getLiveHtgRate() * 100) / 100,
      reserved_balance: reservedUsd,
      reserved_balance_usd: reservedUsd,
      is_active: wallet.is_active,
      is_frozen: wallet.is_frozen,
    };
  }

  /**
   * Post a verified deposit to the wallet.
   * Atomically writes to ledger_entries and verifies idempotency.
   */
  static async recordVerifiedDeposit(
    walletId: string,
    amountUsd: number,
    paymentReference: string,
    idempotencyKey?: string,
    description: string = "Verified funds deposit",
    metadata: Record<string, any> = {}
  ): Promise<LedgerEntryRecord> {
    if (amountUsd <= 0) {
      throw new Error("Deposit amount must be strictly positive");
    }

    return withTransaction(async (client) => {
      // 1. Lock wallet row
      const wRes = await client.query(
        `SELECT * FROM wallet_accounts WHERE id = $1 FOR UPDATE`,
        [walletId]
      );
      if (wRes.rows.length === 0) throw new Error("Wallet not found");
      const wallet = wRes.rows[0];
      if (wallet.is_frozen) throw new Error("Wallet is frozen");
      if (!wallet.is_active) throw new Error("Wallet is inactive");

      // 2. Check idempotency
      if (idempotencyKey) {
        const existing = await client.query(
          `SELECT * FROM ledger_entries WHERE idempotency_key = $1`,
          [idempotencyKey]
        );
        if (existing.rows.length > 0) {
          const row = existing.rows[0];
          return {
            ...row,
            amount_usd: Number(row.amount_usd),
            balance_after_usd: Number(row.balance_after_usd),
          };
        }
      }

      // 3. Compute current balance
      const balRes = await client.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN ROUND(amount_usd * 100) ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN ROUND(amount_usd * 100) ELSE 0 END), 0) as balance_cents
         FROM ledger_entries WHERE wallet_id = $1`,
        [walletId]
      );
      const currentCents = Number(balRes.rows[0].balance_cents);
      const depositCents = toCents(amountUsd);
      const newBalanceCents = currentCents + depositCents;

      // 4. Insert ledger entry
      const insertRes = await client.query(
        `INSERT INTO ledger_entries (
           wallet_id, entry_type, direction, amount_usd, balance_after_usd,
           currency, reference_id, idempotency_key, description, metadata
         ) VALUES ($1, 'DEPOSIT', 'CREDIT', $2, $3, 'USD', $4, $5, $6, $7)
         RETURNING *`,
        [
          walletId,
          amountUsd,
          fromCents(newBalanceCents),
          paymentReference,
          idempotencyKey || null,
          description,
          JSON.stringify(metadata),
        ]
      );

      const entry = insertRes.rows[0];
      return {
        ...entry,
        amount_usd: Number(entry.amount_usd),
        balance_after_usd: Number(entry.balance_after_usd),
      };
    });
  }

  /**
   * Atomically reserve funds for an accepted quote.
   * Prevents concurrent double spending using row locks.
   */
  static async reserveFunds(
    walletId: string,
    orderId: string,
    amountUsd: number,
    idempotencyKey?: string,
    expiresInMinutes: number = 2880 // 48 hours
  ): Promise<{ reservationId: string; amountUsd: number; spendableRemaining: number }> {
    if (amountUsd <= 0) {
      throw new Error("Reservation amount must be positive");
    }

    return withTransaction(async (client) => {
      // 1. Lock wallet row
      const wRes = await client.query(
        `SELECT * FROM wallet_accounts WHERE id = $1 FOR UPDATE`,
        [walletId]
      );
      if (wRes.rows.length === 0) throw new Error("Wallet not found");
      const wallet = wRes.rows[0];
      if (wallet.is_frozen) throw new Error("Wallet is frozen");
      if (!wallet.is_active) throw new Error("Wallet is inactive");

      // Check idempotency
      if (idempotencyKey) {
        const existing = await client.query(
          `SELECT * FROM wallet_reservations WHERE idempotency_key = $1 AND status = 'ACTIVE'`,
          [idempotencyKey]
        );
        if (existing.rows.length > 0) {
          const row = existing.rows[0];
          return {
            reservationId: row.id,
            amountUsd: Number(row.amount_usd),
            spendableRemaining: 0,
          };
        }
      }

      // Check spendable balance
      const ledgerSum = await client.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN ROUND(amount_usd * 100) ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN ROUND(amount_usd * 100) ELSE 0 END), 0) as balance_cents
         FROM ledger_entries WHERE wallet_id = $1`,
        [walletId]
      );
      const totalBalanceCents = Number(ledgerSum.rows[0].balance_cents);

      const resSum = await client.query(
        `SELECT COALESCE(SUM(ROUND(amount_usd * 100)), 0) as total_reserved_cents
         FROM wallet_reservations 
         WHERE wallet_id = $1 AND status = 'ACTIVE'`,
        [walletId]
      );
      const activeReservedCents = Number(resSum.rows[0].total_reserved_cents);
      const spendableCents = totalBalanceCents - activeReservedCents;
      const neededCents = toCents(amountUsd);

      if (spendableCents < neededCents) {
        throw new Error(
          `Insufficient funds: spendable balance is $${fromCents(spendableCents).toFixed(2)}, needed $${amountUsd.toFixed(2)}.`
        );
      }

      // Create reservation
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
      const insertRes = await client.query(
        `INSERT INTO wallet_reservations (
           wallet_id, order_id, amount_usd, currency, status, idempotency_key, expires_at
         ) VALUES ($1, $2, $3, 'USD', 'ACTIVE', $4, $5)
         RETURNING id`,
        [walletId, orderId, amountUsd, idempotencyKey || null, expiresAt]
      );

      return {
        reservationId: insertRes.rows[0].id,
        amountUsd,
        spendableRemaining: fromCents(spendableCents - neededCents),
      };
    });
  }

  /**
   * Release reserved funds back to spendable balance (e.g. quote declined or order rejected).
   */
  static async releaseReservation(
    walletId: string,
    orderId: string,
    reason: string = "Reservation released"
  ): Promise<number> {
    return withTransaction(async (client) => {
      await client.query(
        `SELECT * FROM wallet_accounts WHERE id = $1 FOR UPDATE`,
        [walletId]
      );

      const activeRes = await client.query(
        `SELECT * FROM wallet_reservations 
         WHERE wallet_id = $1 AND order_id = $2 AND status = 'ACTIVE'
         FOR UPDATE`,
        [walletId, orderId]
      );

      if (activeRes.rows.length === 0) {
        return 0;
      }

      let releasedTotalCents = 0;
      for (const res of activeRes.rows) {
        releasedTotalCents += toCents(res.amount_usd);
        await client.query(
          `UPDATE wallet_reservations 
           SET status = 'RELEASED', released_at = NOW() 
           WHERE id = $1`,
          [res.id]
        );
      }

      return fromCents(releasedTotalCents);
    });
  }

  /**
   * Capture actual purchase funds.
   * Debits the authoritative ledger for the actual total, marks the reservation CAPTURED,
   * and automatically releases any unused remainder hold back to the customer's spendable balance!
   */
  static async captureActualPurchase(
    walletId: string,
    orderId: string,
    actualAmountUsd: number,
    orderNumber: string,
    notes: string = ""
  ): Promise<{ capturedAmountUsd: number; releasedRemainderUsd: number }> {
    return withTransaction(async (client) => {
      // 1. Lock wallet row
      await client.query(
        `SELECT * FROM wallet_accounts WHERE id = $1 FOR UPDATE`,
        [walletId]
      );

      // 2. Fetch active reservation for this order
      const resQuery = await client.query(
        `SELECT * FROM wallet_reservations 
         WHERE wallet_id = $1 AND order_id = $2 AND status = 'ACTIVE'
         FOR UPDATE`,
        [walletId, orderId]
      );

      if (resQuery.rows.length === 0) {
        throw new Error(`No active fund reservation found for order ${orderId}`);
      }

      const reservation = resQuery.rows[0];
      const reservedCents = toCents(reservation.amount_usd);
      const actualCents = toCents(actualAmountUsd);

      if (actualCents > reservedCents) {
        throw new Error(
          `Actual purchase total ($${actualAmountUsd.toFixed(2)}) exceeds reserved escrow hold ($${Number(reservation.amount_usd).toFixed(2)})`
        );
      }

      // 3. Mark reservation captured
      await client.query(
        `UPDATE wallet_reservations SET status = 'CAPTURED', released_at = NOW() WHERE id = $1`,
        [reservation.id]
      );

      // 4. Post DEBIT entry to the ledger
      const balRes = await client.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN ROUND(amount_usd * 100) ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN ROUND(amount_usd * 100) ELSE 0 END), 0) as balance_cents
         FROM ledger_entries WHERE wallet_id = $1`,
        [walletId]
      );
      const currentCents = Number(balRes.rows[0].balance_cents);
      const newBalanceCents = currentCents - actualCents;

      await client.query(
        `INSERT INTO ledger_entries (
           wallet_id, entry_type, direction, amount_usd, balance_after_usd,
           currency, reference_id, description, metadata
         ) VALUES ($1, 'PURCHASE', 'DEBIT', $2, $3, 'USD', $4, $5, $6)`,
        [
          walletId,
          actualAmountUsd,
          fromCents(newBalanceCents),
          orderNumber,
          `Procurement completed for Order #${orderNumber}`,
          JSON.stringify({ orderId, notes }),
        ]
      );

      const releasedRemainderCents = reservedCents - actualCents;
      return {
        capturedAmountUsd: actualAmountUsd,
        releasedRemainderUsd: fromCents(releasedRemainderCents),
      };
    });
  }

  /**
   * Process a refund to customer wallet.
   * Appends an immutable compensating CREDIT entry to the ledger.
   */
  static async refundToWallet(
    walletId: string,
    amountUsd: number,
    orderId: string,
    orderNumber: string,
    reason: string = "Order refund"
  ): Promise<LedgerEntryRecord> {
    if (amountUsd <= 0) throw new Error("Refund amount must be positive");

    return withTransaction(async (client) => {
      await client.query(
        `SELECT * FROM wallet_accounts WHERE id = $1 FOR UPDATE`,
        [walletId]
      );

      const balRes = await client.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN ROUND(amount_usd * 100) ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN ROUND(amount_usd * 100) ELSE 0 END), 0) as balance_cents
         FROM ledger_entries WHERE wallet_id = $1`,
        [walletId]
      );
      const currentCents = Number(balRes.rows[0].balance_cents);
      const refundCents = toCents(amountUsd);
      const newBalanceCents = currentCents + refundCents;

      const insertRes = await client.query(
        `INSERT INTO ledger_entries (
           wallet_id, entry_type, direction, amount_usd, balance_after_usd,
           currency, reference_id, description, metadata
         ) VALUES ($1, 'REFUND', 'CREDIT', $2, $3, 'USD', $4, $5, $6)
         RETURNING *`,
        [
          walletId,
          amountUsd,
          fromCents(newBalanceCents),
          orderNumber,
          `Refund for Order #${orderNumber}: ${reason}`,
          JSON.stringify({ orderId, reason }),
        ]
      );

      const entry = insertRes.rows[0];
      return {
        ...entry,
        amount_usd: Number(entry.amount_usd),
        balance_after_usd: Number(entry.balance_after_usd),
      };
    });
  }

  /**
   * Get paginated transaction history for customer or admin view.
   */
  static async getTransactionHistory(
    walletId: string,
    options: { page?: number; limit?: number; type?: string } = {}
  ): Promise<{ total: number; transactions: LedgerEntryRecord[] }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = "WHERE wallet_id = $1";
    const params: any[] = [walletId];

    if (options.type) {
      params.push(options.type);
      whereClause += ` AND entry_type = $${params.length}`;
    }

    const countRes = await query(
      `SELECT COUNT(*) FROM ledger_entries ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const rowsRes = await query(
      `SELECT * FROM ledger_entries 
       ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const transactions = rowsRes.rows.map((r) => ({
      ...r,
      type: r.entry_type || r.direction,
      amount: Number(r.amount_usd),
      amount_usd: Number(r.amount_usd),
      balance_after_usd: Number(r.balance_after_usd),
    }));

    return { total, transactions };
  }
}
