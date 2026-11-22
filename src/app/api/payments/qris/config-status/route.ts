import { NextResponse } from 'next/server';
import { getMidtransConfig } from '@/src/lib/serverAuth';

export async function GET() {
  const cfg = getMidtransConfig();
  return NextResponse.json({
    configured: cfg.configured,
    provider: 'Midtrans Core API (QRIS)',
    environment: cfg.isProd ? 'production' : 'sandbox',
    message: cfg.configured
      ? 'Gateway pembayaran QRIS resmi siap digunakan.'
      : 'Kredensial payment gateway QRIS (MIDTRANS_SERVER_KEY) belum dikonfigurasi pada Secrets server. Pembayaran QRIS tidak dapat dibuat secara palsu.',
  });
}
