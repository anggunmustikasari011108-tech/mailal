import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getMidtransConfig } from '@/src/lib/serverAuth';

export async function POST(req: NextRequest) {
  const cfg = getMidtransConfig();
  if (!cfg.configured) {
    return NextResponse.json({ error: 'Gateway QRIS belum dikonfigurasi.' }, { status: 503 });
  }

  let body: {
    order_id?: string;
    status_code?: string;
    gross_amount?: string;
    signature_key?: string;
    transaction_status?: string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Payload webhook tidak valid.' }, { status: 400 });
  }

  const { order_id, status_code, gross_amount, signature_key, transaction_status } = body;

  if (!order_id || !status_code || !gross_amount || !signature_key) {
    return NextResponse.json({ error: 'Payload webhook tidak lengkap.' }, { status: 400 });
  }

  const expectedSig = crypto
    .createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${cfg.serverKey}`)
    .digest('hex');

  const sigBuf = Buffer.from(signature_key, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: 'Signature webhook tidak valid.' }, { status: 403 });
  }

  return NextResponse.json({
    verified: true,
    orderId: order_id,
    transactionStatus: transaction_status || 'unknown',
  });
}
