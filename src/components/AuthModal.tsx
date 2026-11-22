'use client';

import React, { useState } from 'react';
import { AlertCircle, Mail, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose }) => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, requestPasswordReset, boutiqueSettings } = useStore();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleGoogle = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal masuk dengan Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        onClose();
      } else if (mode === 'register') {
        if (password.length < 6) {
          throw new Error('Kata sandi minimal 6 karakter.');
        }
        await registerWithEmail(name, email, password, phone);
        onClose();
      } else {
        await requestPasswordReset(email);
        setInfoMsg('Tautan reset kata sandi telah dikirim ke email Anda. Silakan periksa kotak masuk.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan autentikasi.';
      if (msg.includes('operation-not-allowed') || msg.includes('admin-restricted-operation')) {
        setErrorMsg(
          'Provider Email/Password belum diaktifkan di Firebase Console > Authentication > Sign-in method. Silakan aktifkan Email/Password di Firebase Console atau gunakan tombol Masuk dengan Google di atas.'
        );
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#394536]/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FCFAF6] border border-[#E5DFD3] rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-4 right-4 p-2 rounded-lg text-[#817B72] hover:bg-[#F7F2E8]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-[#817B72] mb-1">{boutiqueSettings.brandName}</p>
          <h2 className="font-serif text-3xl font-semibold text-[#394536]">
            {mode === 'login' ? 'Masuk ke Akun' : mode === 'register' ? 'Daftar Pelanggan Baru' : 'Lupa Kata Sandi'}
          </h2>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
            {infoMsg}
          </div>
        )}

        {mode !== 'forgot' && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-white border border-[#E5DFD3] hover:border-[#87977B] text-[#394536] text-sm font-medium flex items-center justify-center gap-2.5 transition-colors"
            >
              <Mail className="w-4 h-4 text-[#87977B]" />
              <span>Masuk dengan Google</span>
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-[#817B72]">
              <div className="h-px flex-1 bg-[#E5DFD3]" />
              <span>atau gunakan email</span>
              <div className="h-px flex-1 bg-[#E5DFD3]" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#394536] mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#394536] mb-1">Nomor WhatsApp</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812..."
                  className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-[#394536] mb-1">Alamat Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="block text-xs font-medium text-[#394536] mb-1">Kata Sandi *</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-[#87977B] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? 'Memproses...'
              : mode === 'login'
              ? 'Masuk'
              : mode === 'register'
              ? 'Daftar Akun'
              : 'Kirim Tautan Reset Password'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-[#E5DFD3] flex flex-wrap items-center justify-between gap-2 text-xs text-[#817B72]">
          {mode === 'login' ? (
            <>
              <button type="button" onClick={() => setMode('register')} className="hover:text-[#394536] underline">
                Belum punya akun? Daftar
              </button>
              <button type="button" onClick={() => setMode('forgot')} className="hover:text-[#394536] underline">
                Lupa kata sandi?
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setMode('login')} className="hover:text-[#394536] underline">
              Kembali ke halaman Masuk
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
