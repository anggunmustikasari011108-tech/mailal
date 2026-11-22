export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'STAF' | 'PELANGGAN';

export type PaymentMethod = 'TRANSFER_BANK' | 'QRIS' | 'COD';

export type PaymentStatus =
  | 'BELUM_DIBAYAR'
  | 'MENUNGGU_VERIFIKASI'
  | 'BERHASIL'
  | 'DITOLAK'
  | 'LUNAS';

export type OrderStatus =
  | 'MENUNGGU_PEMBAYARAN'
  | 'MENUNGGU_VERIFIKASI'
  | 'PEMBAYARAN_DIKONFIRMASI'
  | 'SEDANG_DIPROSES'
  | 'SEDANG_DIKEMAS'
  | 'DIKIRIM'
  | 'SELESAI'
  | 'DIBATALKAN';

export type ShipmentStatus = 'MENUNGGU' | 'DIKEMAS' | 'DIKIRIM' | 'DITERIMA' | 'DIBATALKAN';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  photoUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavedAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  fullAddress: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  isDefault: boolean;
}

export interface CustomerRecord {
  id: string;
  userId: string;
  fullName: string;
  phone?: string;
  email: string;
  addresses: SavedAddress[];
  totalOrders: number;
  totalSpent: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: unknown;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  description: string;
  material?: string;
  careInfo?: string;
  sizeGuide?: string;
  price: number;
  discountPrice?: number;
  costPrice?: number;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  isExclusive?: boolean;
  isActive: boolean;
  thumbnailUrl: string;
  totalStock: number;
  soldCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  size: string;
  colorName: string;
  colorHex: string;
  stock: number;
  minStock: number;
  priceAdjustment?: number;
  isActive: boolean;
  updatedAt?: unknown;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  alt?: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt?: unknown;
}

export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  variantId: string;
  productName: string;
  size: string;
  colorName: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  updatedAt?: unknown;
}

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  note: string;
  changedBy: string;
  changedAt: string;
}

export interface ShippingAddress {
  fullAddress: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
}

export interface Order {
  id: string;
  invoiceNumber: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: ShippingAddress;
  notes?: string;
  subtotal: number;
  discountAmount: number;
  couponCode?: string;
  shippingCost: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  statusHistory: OrderStatusHistoryItem[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderItem {
  id: string;
  orderId: string;
  userId: string;
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  size: string;
  colorName: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  subtotal: number;
  createdAt?: unknown;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  invoiceNumber: string;
  userId: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  proofImageUrl?: string;
  qrisReferenceId?: string;
  qrisUrl?: string;
  rejectionReason?: string;
  verifiedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isActive: boolean;
}

export interface PaymentSettings {
  bankAccounts: BankAccount[];
  bankTransferInstructions: string;
  codEnabled: boolean;
  codTerms: string;
  codMaxAmount: number;
  qrisProvider: string;
  qrisInstructions: string;
  shippingBaseCost: number;
  freeShippingThreshold: number;
  updatedAt?: unknown;
}

export interface Shipment {
  id: string;
  orderId: string;
  invoiceNumber: string;
  userId: string;
  courier: string;
  shippingService?: string;
  trackingNumber?: string;
  shippingCost: number;
  status: ShipmentStatus;
  estimatedDelivery?: string;
  updatedAt?: unknown;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minPurchase: number;
  maxDiscount?: number;
  startDate?: string;
  endDate?: string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  description?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  createdAt?: unknown;
}

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  createdAt?: unknown;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'SALE';
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason: string;
  referenceId?: string;
  actorId: string;
  actorName?: string;
  createdAt?: unknown;
}

export interface ActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: string;
  createdAt?: unknown;
}

export interface BoutiqueSettings {
  brandName: string;
  projectName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  secondaryTextColor: string;
  brandDescription: string;
  address: string;
  whatsapp: string;
  instagram: string;
  email: string;
  operatingHours: string;
  shippingPolicy: string;
  returnPolicy: string;
  termsAndConditions: string;
  privacyPolicy: string;
  updatedAt?: unknown;
}

export interface WebsiteBanner {
  id: string;
  title: string;
  headline: string;
  subheadline?: string;
  imageUrl: string;
  ctaPrimaryText?: string;
  ctaSecondaryText?: string;
  placement: 'HERO' | 'PROMO';
  isActive: boolean;
  sortOrder: number;
  updatedAt?: unknown;
}
