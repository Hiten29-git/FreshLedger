# Security Specification & Threat Model — FreshLedger

## 1. Data Invariants

1. **Identity Isolation**: Every user document (`/users/{userId}`) and subcollection (`/users/{userId}/items`, `/users/{userId}/rules`, `/users/{userId}/notifications`, `/users/{userId}/wasteLogs`) is strictly readable and writable only by the verified authenticated owner (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. **Master Gate Parent Existence**: Subcollection records (`items`, `rules`, `notifications`, `wasteLogs`) cannot be created unless the parent `/users/{userId}` document exists.
3. **Referential Integrity**: Every `ExpiryNotification` and `WasteLog` must reference an existing `FoodItem` (`exists(/databases/$(database)/documents/users/$(userId)/items/$(incoming().itemId))`).
4. **Terminal State Locking**: Once a `FoodItem` reaches `status == 'consumed'` or `status == 'wasted'`, no further updates are permitted on that item. `WasteLog` records are immutable after creation (only delete is permitted by the owner).
5. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time`; `createdAt` and `ownerId` are immutable on update.
6. **Strict Schema & Bounds**: Every string field has explicit `.size()` bounds; `notifiedTiers` list is bounded to `<= 10` items with first-element type validation; `quantity` and `estimatedCost` are bounded numbers; no shadow fields are allowed.

## 2. The "Dirty Dozen" Attack Payloads

1. **Cross-User Read (`GET /users/victimUid/items/item1`)**: Authenticated attacker tries reading another user's food item. Expected: `PERMISSION_DENIED`.
2. **Blanket List Scraping (`LIST /users/victimUid/items`)**: Authenticated attacker lists another user's items. Expected: `PERMISSION_DENIED`.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create a `FoodItem`. Expected: `PERMISSION_DENIED`.
4. **Owner Spoofing (`ownerId != request.auth.uid`)**: Authenticated user creates an item under their own path with `ownerId: "otherUid"`. Expected: `PERMISSION_DENIED`.
5. **Shadow Field Injection**: User includes `isAdmin: true` or `extraField: "hack"` in `FoodItem` create payload. Expected: `PERMISSION_DENIED`.
6. **Path ID Poisoning**: User attempts to write to `/users/{uid}/items/invalid$id!with*badchars`. Expected: `PERMISSION_DENIED`.
7. **String Size Exhaustion**: User submits a `FoodItem` with a 5000-character `name` or `notes`. Expected: `PERMISSION_DENIED`.
8. **Client Timestamp Spoofing**: User sets `createdAt` to a client-chosen timestamp instead of `request.time`. Expected: `PERMISSION_DENIED`.
9. **Terminal State Bypass**: User attempts to update a `FoodItem` whose existing `status` is `'wasted'` back to `'active'`. Expected: `PERMISSION_DENIED`.
10. **Orphaned WasteLog**: User creates a `WasteLog` referencing a non-existent `itemId`. Expected: `PERMISSION_DENIED`.
11. **Immutable Owner Mutation**: User updates a `FoodItem` changing `ownerId` or `createdAt`. Expected: `PERMISSION_DENIED`.
12. **Unbounded Array Poisoning**: User supplies `notifiedTiers` with 15 elements or a non-string element `[123]`. Expected: `PERMISSION_DENIED`.
