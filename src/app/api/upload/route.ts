import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, detectImageMagicBytes, getUploadsDir } from '@/src/lib/serverAuth';

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if ('response' in authResult) {
    return authResult.response;
  }

  let body: { base64Data?: unknown; category?: unknown };
  try {
    body = (await req.json()) as { base64Data?: unknown; category?: unknown };
  } catch {
    return NextResponse.json({ error: 'Payload JSON tidak valid.' }, { status: 400 });
  }

  const { base64Data, category } = body;
  if (typeof base64Data !== 'string' || base64Data.length === 0) {
    return NextResponse.json({ error: 'Data gambar tidak ditemukan.' }, { status: 400 });
  }

  const safeCategory =
    typeof category === 'string' && ['proof', 'product', 'banner', 'logo'].includes(category)
      ? category
      : 'general';

  const match = base64Data.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  const rawBase64 = match ? match[2] : base64Data;
  const buffer = Buffer.from(rawBase64, 'base64');

  const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Ukuran berkas harus antara 1 byte dan maksimal 2 MB.' },
      { status: 400 }
    );
  }

  const detectedMime = detectImageMagicBytes(buffer);
  if (!detectedMime) {
    return NextResponse.json(
      { error: 'Format gambar tidak valid. Hanya PNG, JPEG, atau WEBP yang diizinkan.' },
      { status: 400 }
    );
  }

  const uploadsDir = getUploadsDir();
  const ext = detectedMime === 'image/png' ? 'png' : detectedMime === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${safeCategory}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const resolvedPath = path.resolve(uploadsDir, fileName);

  if (!resolvedPath.startsWith(uploadsDir + path.sep)) {
    return NextResponse.json({ error: 'Jalur berkas tidak valid.' }, { status: 400 });
  }

  fs.writeFileSync(resolvedPath, buffer);
  return NextResponse.json({
    url: `/uploads/${fileName}`,
    mimeType: detectedMime,
    size: buffer.length,
  });
}
