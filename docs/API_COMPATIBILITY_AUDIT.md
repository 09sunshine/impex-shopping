# IMPEX API Compatibility Audit & Migration Matrix

## 1. Project Overview & Audit Summary
- **Frontend**: React 19.2.8 + Vite 8.3.1 (`shopping-frontend/`), Vanilla CSS Design System, Lucide icons, `ApiClient` at `src/api/client.js`.
- **Legacy Backend**: Python FastAPI with Tortoise ORM, SQLite/MySQL.
- **Target Backend**: Node.js + Express + TypeScript + Supabase PostgreSQL + Better Auth + Google OAuth + Pay'm + Awin Feed Engine + Official Merchant Adapters.
- **Primary Goal**: Zero regression for the frontend, production-grade financial double-entry ledger, secure auth, robust URL & screenshot ordering for all 8 target merchants.

---

## 2. API Compatibility Matrix

| Endpoint | Method | Auth Required | Request Schema | Response Schema | Status / Implementation |
|---|---|---|---|---|---|
| `/api/auth/login` | POST | Public | `{ identifier, email, password }` | `{ access_token, user_id, email, role, is_verified, user, wallet }` + HttpOnly cookie | Implemented with Better Auth + JWT session compatibility |
| `/api/customers/register` | POST | Public | `{ first_name, last_name, email, password, phone, ... }` | `{ message, user_id }` | Implemented; automatically provisions customer profile, address, and wallet |
| `/api/auth/register` | POST | Public | `{ email, password, first_name, last_name, phone }` | Same as above | Supported fallback |
| `/api/auth/me` & `/api/me` | GET | Bearer / Cookie | None | `{ id, email, role, first_name, last_name, customer, wallet, receiving_address }` | Implemented |
| `/api/auth/logout` | POST | Bearer / Cookie | None | `{ message: "Logged out" }` | Implemented; revokes session and clears cookies |
| `/api/auth/*` | ANY | Varied | Better Auth native endpoints | Better Auth native responses | Mounted via `toNodeHandler(auth)` for Google OAuth and Better Auth client |
| `/api/shopping/merchants` | GET | Public | None | `{ merchants: [...] }` | Implemented for all 8 target merchants |
| `/api/shopping/catalog` | GET | Public | Query: `q, merchant, category, min_price, max_price, limit, offset` | `{ total, items: [...] }` | Implemented with Awin feeds and catalog engine |
| `/api/shopping/resolve-url` | POST | Public / Auth | `{ url }` | `{ status, cleaned_url, domain, merchant_name, merchant_slug, is_supported }` | Implemented with strict SSRF protection |
| `/api/shopping/screenshots/upload` | POST | Authenticated | Multipart `file` | `{ attachment_id, original_filename, file_size_bytes, mime_type, preview_url }` | Implemented with magic byte validation & private storage |
| `/api/shopping/screenshots/:id` | GET | Authenticated | None | Binary image stream | Implemented with IDOR protection (owner or staff) |
| `/api/shopping/orders` | POST | Authenticated (Customer) | `OrderSubmissionRequest` | `ShoppingOrderDetailResponse` | Implemented; creates order in `SUBMITTED` state, logs audit event |
| `/api/shopping/orders/screenshot` | POST | Authenticated (Customer) | `ScreenshotOrderSubmissionRequest` | `ShoppingOrderDetailResponse` | Implemented; screenshot-based concierge order |
| `/api/shopping/orders` | GET | Authenticated (Customer) | Query: `status, limit, offset` | `{ total, orders: [...] }` | Implemented with IDOR filter (customer only) |
| `/api/shopping/orders/:id` | GET | Authenticated (Customer) | None | `ShoppingOrderDetailResponse` | Implemented with quotes and event history |
| `/api/shopping/orders/:id/confirm-quote` | POST | Authenticated (Customer) | `{ quote_id, idempotency_key }` | `ShoppingOrderDetailResponse` | Implemented; atomic wallet escrow reservation via double-entry ledger |
| `/api/shopping/orders/:id/confirm-price-change` | POST | Authenticated (Customer) | `{ quote_id, idempotency_key }` | `ShoppingOrderDetailResponse` | Implemented; customer accepts re-quoted price |
| `/api/shopping/orders/:id/decline-quote` | POST | Authenticated (Customer) | `{ quote_id, reason }` | `ShoppingOrderDetailResponse` | Implemented; releases hold, marks order cancelled |
| `/api/shopping/orders/:id/cancel` | POST | Authenticated (Customer) | `{ reason }` | `ShoppingOrderDetailResponse` | Implemented; releases hold if funds were reserved |
| `/api/shopping/orders/:id/events` | GET | Authenticated (Customer) | None | `List<OrderEventResponse>` | Implemented immutable audit trail |
| `/api/shopping/orders/:id/delivery-request` | POST | Authenticated (Customer) | `{ delivery_address_id, delivery_notes }` | `{ success, delivery_number, delivery_fee_usd, status }` | Implemented |
| `/api/wallet/balance` | GET | Authenticated | None | `WalletBalanceResponse` | Implemented from authoritative ledger |
| `/api/wallet/transactions` | GET | Authenticated | Query: `page, limit, type` | `{ total, transactions: [...] }` | Implemented |
| `/api/wallet/topup-request` | POST | Authenticated | `{ payment_method, amount, currency, transaction_reference }` | `{ status, message, payment_attempt_id }` | Implemented |
| `/api/payments/paym/initiate` | POST | Authenticated | `{ amount, currency, return_url }` | `{ checkout_url, payment_reference }` | Implemented Pay'm adapter |
| `/api/payments/paym/webhook` | POST | Pay'm IP / Auth | Pay'm webhook payload | `{ received: true }` | Implemented with signature verification & replay protection |
| `/api/addresses/` | GET | Authenticated | Query: `user_id` (staff only for other users) | `List<Address>` | Implemented |
| `/api/addresses/` | POST | Authenticated | `AddressCreateInput` | `Address` | Implemented |
| `/api/addresses/company` | GET | Authenticated | None | `List<Address>` | Implemented |
| `/api/admin/shopping/stats` | GET | Staff (Admin/Employee) | None | Operational stats object | Implemented |
| `/api/admin/shopping/orders` | GET | Staff (Admin/Employee) | Query: `status_filter, merchant_filter, search, limit, offset` | `{ total, orders: [...] }` | Implemented |
| `/api/admin/shopping/orders/:id` | GET | Staff (Admin/Employee) | None | Detailed order view | Implemented |
| `/api/admin/shopping/orders/:id/verify-price` | POST | Staff (Admin/Employee) | `AdminVerifyPriceRequest` | `OrderQuoteResponse` | Implemented server-side quotation generation |
| `/api/admin/shopping/orders/:id/pre-purchase-validation` | POST | Staff (Admin/Employee) | `AdminPrePurchaseValidationRequest` | `PrePurchaseValidationResponse` | Implemented |
| `/api/admin/shopping/orders/:id/purchase` | POST | Staff (Admin/Employee) | `AdminRecordPurchaseRequest` | Detailed order view | Implemented; captures actual cost, releases unused hold |
| `/api/admin/shopping/orders/:id/mark-shipped` | POST | Staff (Admin/Employee) | `AdminShipmentTrackingRequest` | Detailed order view | Implemented; records carrier & tracking |
| `/api/admin/shopping/orders/:id/mark-arrived` | POST | Staff (Admin/Employee) | Query: `notes` | Detailed order view | Implemented; marks arrived at Haiti depot, issues pickup code |
| `/api/admin/shopping/orders/:id/verify-pickup` | POST | Staff (Admin/Employee) | `{ pickup_code, picked_up_by_name }` | Detailed order view | Implemented; completes delivery |
| `/api/admin/shopping/orders/:id/refund` | POST | Staff (Admin) | Query: `amount_usd, reason` | Detailed order view | Implemented with compensating ledger entry |
| `/api/admin/shopping/orders/:id/reject` | POST | Staff (Admin/Employee) | `{ reason }` | Detailed order view | Implemented |
| `/api/admin/shopping/integrations/status` | GET | Staff (Admin/Employee) | None | Health status of 8 merchants + Awin | Implemented |
| `/api/admin/shopping/integrations/awin/sync` | POST | Staff (Admin) | `{ merchant_slug }` | Sync status | Implemented |
| `/api/admin/shopping/integrations/awin/logs` | GET | Staff (Admin/Employee) | Query: `limit, offset` | `{ total, logs: [...] }` | Implemented |
| `/api/admin/shopping/catalog` | GET | Staff (Admin/Employee) | Query: `q, merchant, category, limit, offset` | Catalog list | Implemented |
| Legacy Commerce `/api/commerce/*` | ANY | Varied | Varied | Compatibility responses | Implemented adapters |
