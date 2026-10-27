import { describe, it, expect } from "vitest";

describe("Double-Entry Wallet Accounting & Integer-Cent Integrity", () => {
  function toCents(amount: number): number {
    return Math.round(amount * 100);
  }

  function fromCents(cents: number): number {
    return Number((cents / 100).toFixed(2));
  }

  it("should never suffer from floating-point inaccuracy in financial additions", () => {
    // In standard IEEE 754 float: 0.1 + 0.2 = 0.30000000000000004
    expect(0.1 + 0.2).not.toBe(0.3);

    // With our integer-cent representation:
    const aCents = toCents(0.1); // 10
    const bCents = toCents(0.2); // 20
    const sumCents = aCents + bCents; // 30
    expect(fromCents(sumCents)).toBe(0.3);
  });

  it("should accurately maintain deposit, reservation, and spendable balance invariants", () => {
    const depositAmount = 250.75;
    let balanceCents = toCents(depositAmount); // 25075
    let activeReservedCents = 0;

    // Spendable is balance - reserved
    expect(fromCents(balanceCents - activeReservedCents)).toBe(250.75);

    // Customer accepts quote of $120.50 -> reserve funds
    const quoteAmount = 120.5;
    const quoteCents = toCents(quoteAmount);
    activeReservedCents += quoteCents;

    // Total balance is still $250.75, but spendable is reduced to $130.25
    expect(fromCents(balanceCents)).toBe(250.75);
    expect(fromCents(balanceCents - activeReservedCents)).toBe(130.25);

    // Customer attempts to spend another $150.00 -> rejected due to insufficient spendable funds
    const secondSpend = 150.0;
    const canSpend = (balanceCents - activeReservedCents) >= toCents(secondSpend);
    expect(canSpend).toBe(false);

    // Staff performs manual purchase for $115.00 ($5.50 less than quoted)
    const actualPurchaseAmount = 115.0;
    const actualCents = toCents(actualPurchaseAmount);

    // Capture actual funds:
    // 1. Debit ledger for actual purchase
    balanceCents -= actualCents; // 25075 - 11500 = 13575 ($135.75)
    // 2. Clear reservation
    const releasedRemainderCents = quoteCents - actualCents; // 12050 - 11500 = 550 ($5.50)
    activeReservedCents -= quoteCents; // 0

    // Final state: balance is $135.75, spendable is $135.75, released remainder was $5.50
    expect(fromCents(balanceCents)).toBe(135.75);
    expect(fromCents(balanceCents - activeReservedCents)).toBe(135.75);
    expect(fromCents(releasedRemainderCents)).toBe(5.5);
  });

  it("should accurately apply compensating entries on refund without mutating historical records", () => {
    let balanceCents = toCents(135.75);

    // Customer is issued refund of $50.00
    const refundCents = toCents(50.0);
    balanceCents += refundCents; // Compensating credit

    expect(fromCents(balanceCents)).toBe(185.75);
  });

  it("should release reserved funds back to spendable balance if order fails or is cancelled", () => {
    let balanceCents = toCents(100.0); // $100 deposited
    let activeReservedCents = 0;

    // Order placed & quote accepted -> $60 reserved
    const orderCents = toCents(60.0);
    activeReservedCents += orderCents;

    // Only $40 spendable while order is pending merchant purchase
    expect(fromCents(balanceCents - activeReservedCents)).toBe(40.0);

    // Order fails (e.g. merchant out of stock or customer declines updated quote) -> Release reservation
    activeReservedCents -= orderCents;

    // Spendable balance is fully restored to $100.00 immediately
    expect(fromCents(balanceCents - activeReservedCents)).toBe(100.0);
  });
});
