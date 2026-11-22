/**
 * Security Rules Verification Matrix for MAILAL BOUTIQ HIJAB DAN BUSANA
 * Validates the "Dirty Dozen" adversarial payloads against firestore.rules.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  description: string;
}

export const DIRTY_DOZEN_CASES: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Privilege Escalation Create',
    collection: 'users',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Customer attempting to register with role SUPER_ADMIN must be rejected.',
  },
  {
    id: 2,
    name: 'Privilege Escalation Update',
    collection: 'users',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Customer attempting to update their own role field must be rejected.',
  },
  {
    id: 3,
    name: 'Email Spoofing Admin Bypass',
    collection: 'boutique_settings',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Token with email_verified=false matching admin email must be rejected.',
  },
  {
    id: 4,
    name: 'Cross-Tenant PII Read',
    collection: 'orders',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'Customer A reading Customer B order must be rejected.',
  },
  {
    id: 5,
    name: 'Shadow Field Injection',
    collection: 'orders',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Order payload containing undeclared ghost field must be rejected.',
  },
  {
    id: 6,
    name: 'ID Poisoning',
    collection: 'wishlists',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Document ID exceeding 128 chars or invalid characters must be rejected.',
  },
  {
    id: 7,
    name: 'Oversized Payload (Denial of Wallet)',
    collection: 'reviews',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Comment exceeding 1000 characters must be rejected.',
  },
  {
    id: 8,
    name: 'Order Payment Status Tampering',
    collection: 'orders',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Customer setting paymentStatus to LUNAS must be rejected.',
  },
  {
    id: 9,
    name: 'Terminal State Violation',
    collection: 'orders',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Customer cancelling an order already in DIKIRIM or SELESAI must be rejected.',
  },
  {
    id: 10,
    name: 'Negative Stock Manipulation',
    collection: 'product_variants',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Customer setting variant stock < 0 or > existing stock must be rejected.',
  },
  {
    id: 11,
    name: 'Audit Log Tampering',
    collection: 'activity_logs',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
    description: 'Attempt to delete an immutable activity log must be rejected.',
  },
  {
    id: 12,
    name: 'Unauthenticated Write',
    collection: 'cart_items',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Unauthenticated cart write must be rejected.',
  },
];
