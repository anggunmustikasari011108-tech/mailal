import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, getMidtransConfig } from '@/src/lib/serverAuth';

export async function POST(req: NextRequest) {
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
        error:
          'Gateway QRIS belum dikonfigurasi. Tambahkan MIDTRANS_SERVER_KEY di panel Secrets server untuk mengaktifkan QRIS resmi.',
      },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload JSON tidak valid.' }, { status: 400 });
  }

  const { orderId, invoiceNumber, amount, customerName, customerEmail, customerPhone } = body;

  if (
    typeof orderId !== 'string' ||
    !/^[a-zA-Z0-9_-]{3,128}$/.test(orderId) ||
    typeof invoiceNumber !== 'string' ||
    !/^[a-zA-Z0-9_-]{3,80}$/.test(invoiceNumber) ||
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return NextResponse.json({ error: 'Parameter transaksi QRIS tidak valid.' }, { status: 400 });
  }

  try {
    const authToken = Buffer.from(`${cfg.serverKey}:`).toString('base64');
    const chargePayload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: invoiceNumber,
        gross_amount: Math.round(amount),
      },
      qris: {
        acquirer: 'gopay',
      },
      customer_details: {
        first_name: typeof customerName === 'string' ? customerName.slice(0, 80) : 'Pelanggan',
        email: typeof customerEmail === 'string' ? customerEmail.slice(0, 120) : '',
        phone: typeof customerPhone === 'string' ? customerPhone.slice(0, 24) : '',
      },
    };

    const midtransRes = await fetch(`${cfg.baseUrl}/v2/charge`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${authToken}`,
      },
      body: JSON.stringify(chargePayload),
    });

    const data = (await midtransRes.json()) as {
      status_code?: string;
      status_message?: string;
      transaction_id?: string;
      transaction_status?: string;
      expiry_time?: string;
      qr_string?: string;
      actions?: Array<{ name?: string; url?: string }>;
    };

    if (!midtransRes.ok || (data.status_code && !data.status_code.startsWith('2'))) {
      return NextResponse.json(
        {
          configured: true,
          error: data.status_message || 'Gagal membuat transaksi QRIS di gateway pembayaran.',
        },
        { status: 502 }
      );
    }

    const qrAction = data.actions?.find((a) => a.name === 'generate-qr-code');
    return NextResponse.json({
      configured: true,
      orderId,
      invoiceNumber,
      transactionId: data.transaction_id || '',
      transactionStatus: data.transaction_status || 'pending',
      qrUrl: qrAction?.url || '',
      qrString: data.qr_string || '',
      expiryTime: data.expiry_time || '',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kesalahan jaringan ke gateway QRIS';
    return NextResponse.json({ configured: true, error: message }, { status: 500 });
  }
}
