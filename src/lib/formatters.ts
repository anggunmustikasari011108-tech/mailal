import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '../types';

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatJakartaDate(value: unknown, withTime = true): string {
  if (!value) return '-';
  let date: Date | null = null;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    date = (value as { toDate: () => Date }).toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function toJakartaDateKey(value: unknown): string {
  let date: Date | null = null;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    date = (value as { toDate: () => Date }).toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-MB-${datePart}-${rand}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  MENUNGGU_PEMBAYARAN: 'Menunggu Pembayaran',
  MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi',
  PEMBAYARAN_DIKONFIRMASI: 'Pembayaran Dikonfirmasi',
  SEDANG_DIPROSES: 'Sedang Diproses',
  SEDANG_DIKEMAS: 'Sedang Dikemas',
  DIKIRIM: 'Dikirim',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  BELUM_DIBAYAR: 'Belum Dibayar',
  MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi',
  BERHASIL: 'Berhasil',
  DITOLAK: 'Ditolak',
  LUNAS: 'Lunas',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  TRANSFER_BANK: 'Transfer Bank',
  QRIS: 'QRIS Resmi',
  COD: 'Cash On Delivery (COD)',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  STAF: 'Staf Operasional',
  PELANGGAN: 'Pelanggan',
};

export function sanitizeImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('https://') || url.startsWith('http://')) {
    return url;
  }
  return '';
}
