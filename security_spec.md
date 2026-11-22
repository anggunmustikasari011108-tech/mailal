# Security Specification — MAILAL BOUTIQ HIJAB DAN BUSANA

## 1. Data Invariants
1. A customer cannot self-assign `SUPER_ADMIN`, `ADMIN`, or `STAF` roles on `/users/{userId}` creation or update; only `PELANGGAN` is permitted on self-registration unless the user is the verified bootstrapped `SUPER_ADMIN`.
2. PII collections (`/users/{userId}`, `/customers/{customerId}`, `/orders/{orderId}`, `/payments/{paymentId}`, `/shipments/{shipmentId}`) are never readable or listable by other customers; `allow get` and `allow list` strictly require `resource.data.userId == request.auth.uid` or verified Admin/Staff access.
3. Stock mutations on `/product_variants/{variantId}` by non-staff users may ONLY decrement `stock` monotonically (`incoming().stock < existing().stock && incoming().stock >= 0`) during atomic checkout transactions, and never modify `sku`, `size`, `colorName`, or `productId`.
4. All document IDs in single-document rules (`get`, `create`, `update`, `delete`) are validated by `isValidId(id)` (`^[a-zA-Z0-9_-]+$`, `<= 128` chars) to block ID poisoning.
5. All `createdAt` and `updatedAt` timestamps on protected writes use `request.time` (`== request.time`) where server timestamps are applied, preventing backdated or spoofed timestamps.
6. Admin activity logs (`/activity_logs`) are append-only by verified Admin/Staff (`actorId == request.auth.uid`) and cannot be deleted or modified after creation.

## 2. The "Dirty Dozen" Payloads (Adversarial Test Matrix)
1. **Privilege Escalation Create**: Unauthenticated or customer user attempts `POST /users/{uid}` with `{ role: "SUPER_ADMIN" }` -> `PERMISSION_DENIED`.
2. **Privilege Escalation Update**: Customer attempts `PATCH /users/{uid}` changing `role` from `"PELANGGAN"` to `"ADMIN"` -> `PERMISSION_DENIED`.
3. **Email Spoofing Admin Bypass**: User with unverified email token (`email_verified: false`) matching bootstrapped admin email attempts admin write -> `PERMISSION_DENIED`.
4. **Cross-Tenant PII Read**: Customer A attempts `get` on `/customers/{customerB}` or `list` on `/orders` without `userId == uid` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection**: Customer creates `/orders/{id}` with extra ghost field `isVerified: true` -> `PERMISSION_DENIED` (`hasOnly` blocks unknown fields).
6. **ID Poisoning**: Attacker writes document with 256-char or slash-containing document ID -> `PERMISSION_DENIED`.
7. **Oversized Payload (Denial of Wallet)**: Attacker submits 50KB `notes` or `description` string -> `PERMISSION_DENIED` (`.size()` cap enforced).
8. **Order Price/Status Tampering**: Customer updates `/orders/{id}` to set `orderStatus: "SELESAI"` or `paymentStatus: "LUNAS"` -> `PERMISSION_DENIED`.
9. **Terminal State Violation**: Customer attempts to cancel an order already in `DIKIRIM` or `SELESAI` -> `PERMISSION_DENIED`.
10. **Negative Stock Manipulation**: Customer updates `/product_variants/{id}` setting `stock: -5` or increasing stock -> `PERMISSION_DENIED`.
11. **Audit Log Tampering**: Staff attempts to delete or edit `/activity_logs/{id}` -> `PERMISSION_DENIED`.
12. **Unauthenticated Checkout / Cart Write**: Guest without `request.auth` attempts to create `/orders/{id}` or `/cart_items/{id}` -> `PERMISSION_DENIED`.
