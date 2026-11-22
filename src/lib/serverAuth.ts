import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

interface FirebaseAppletConfig {
  projectId: string;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

let cachedCerts: Record<string, string> = {};
let certsExpireAt = 0;

function getFirebaseProjectId(): string {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const cfgRaw = fs.readFileSync(cfgPath, 'utf8');
    const cfg = JSON.parse(cfgRaw) as FirebaseAppletConfig;
    return cfg.projectId || process.env.FIREBASE_PROJECT_ID || '';
  } catch {
    return process.env.FIREBASE_PROJECT_ID || '';
  }
}

export function getUploadsDir(): string {
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  if (Date.now() < certsExpireAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }
  const resp = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!resp.ok) {
    throw new Error('Gagal mengambil sertifikat verifikasi token Firebase');
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = (await resp.json()) as Record<string, string>;
  certsExpireAt = Date.now() + maxAgeSec * 1000;
  return cachedCerts;
}

export async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseUser> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Format token tidak valid');
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Algoritma atau key ID token tidak valid');
  }

  const certs = await getGooglePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error('Sertifikat publik token tidak ditemukan');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signature = Buffer.from(sigB64, 'base64url');
  const isValidSig = verifier.verify(certPem, signature);
  if (!isValidSig) {
    throw new Error('Tanda tangan token tidak valid');
  }

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    email?: string;
    email_verified?: boolean;
  };

  const firebaseProjectId = getFirebaseProjectId();
  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error('Token sesi sudah kedaluwarsa');
  }
  if (firebaseProjectId && payload.aud !== firebaseProjectId) {
    throw new Error('Audience token tidak sesuai dengan proyek aplikasi');
  }
  if (firebaseProjectId && payload.iss !== `https://securetoken.google.com/${firebaseProjectId}`) {
    throw new Error('Issuer token tidak sesuai');
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Subject token tidak valid');
  }

  return {
    uid: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
  };
}

export async function authenticateRequest(
  req: NextRequest
): Promise<{ user: VerifiedFirebaseUser } | { response: NextResponse }> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      response: NextResponse.json(
        { error: 'Autentikasi diperlukan (Bearer token tidak ditemukan).' },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.slice(7).trim();
  try {
    const user = await verifyFirebaseIdToken(token);
    return { user };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token tidak valid';
    return {
      response: NextResponse.json({ error: `Akses ditolak: ${msg}` }, { status: 401 }),
    };
  }
}

export function getMidtransConfig() {
  const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
  const clientKey = (process.env.MIDTRANS_CLIENT_KEY || '').trim();
  const isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  const baseUrl = isProd ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
  return {
    configured: Boolean(serverKey && serverKey !== 'MY_MIDTRANS_SERVER_KEY'),
    serverKey,
    clientKey,
    isProd,
    baseUrl,
  };
}

export function detectImageMagicBytes(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
