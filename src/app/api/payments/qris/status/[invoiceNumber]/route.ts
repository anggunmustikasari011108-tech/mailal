import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, getMidtransConfig } from '@/src/lib/serverAuth';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ invoiceNumber: string }> }
) {
  const authResult = await authenticateRequest(req);
  if ('response' in authResult) {
    return authResult.response;
  }

  const cfg = getMidtransConfig();
  if (!cfg.configured) {
    return NextResponse.json(
      {
        configured: false,
        status: 'NOT_CONFIGURED',
        error: 'Gateway QRIS belum dikonfigurasi.',
      },
      { status: 503 }
    );
  }

  const { invoiceNumber } = await context.params;
  if (!invoiceNumber || !/^[a-zA-Z0-9_-]{3,80}$/.test(invoiceNumber)) {
    return NextResponse.json({ error: 'Nomor invoice tidak valid.' }, { status: 400 });
  }

  try {
    const authToken = Buffer.from(`${cfg.serverKey}:`).toString('base64');
    const midtransRes = await fetch(
      `${cfg.baseUrl}/v2/${encodeURIComponent(invoiceNumber)}/status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${authToken}`,
        },
      }
    );
    const data = (await midtransRes.json()) as {
      status_code?: string;
      transaction_id?: string;
      transaction_status?: string;
      fraud_status?: string;
      gross_amount?: string;
      settlement_time?: string;
    };

    return NextResponse.json({
      configured: true,
      invoiceNumber,
      transactionId: data.transaction_id || '',
      transactionStatus: data.transaction_status || 'pending',
      fraudStatus: data.fraud_status || '',
      grossAmount: data.gross_amount || '',
      settlementTime: data.settlement_time || '',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memeriksa status QRIS';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
