'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Building2,
  CheckCircle2,
  Download,
  QrCode,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useStore } from '../context/StoreContext';
import { exportInvoicePDF } from '../lib/exportUtils';
import { auth, db, uploadImageToServer } from '../lib/firebase';
import { formatIDR } from '../lib/formatters';
import { PaymentMethod } from '../types';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  appliedCouponCode: string;
  onOpenAuth: () => void;
}

interface QrisConfigStatus {
  configured: boolean;
  provider: string;
  environment: string;
  message: string;
}

interface QrisTransactionResult {
  configured: boolean;
  transactionId?: string;
  transactionStatus?: string;
  qrUrl?: string;
  qrString?: string;
  expiryTime?: string;
  error?: string;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  onClose,
  appliedCouponCode,
  onOpenAuth,
}) => {
  const {
    firebaseUser,
    userProfile,
    customerRecord,
    cartItems,
    coupons,
    paymentSettings,
    boutiqueSettings,
    orders,
    orderItems,
    placeOrder,
    submitBankTransferProof,
    showToast,
  } = useStore();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TRANSFER_BANK');
  const [submitting, setSubmitting] = useState(false);

  const [qrisConfig, setQrisConfig] = useState<QrisConfigStatus | null>(null);
  const [createdOrderMeta, setCreatedOrderMeta] = useState<{
    orderId: string;
    invoiceNumber: string;
    paymentId: string;
    method: PaymentMethod;
    amount: number;
  } | null>(null);

  // Bank transfer proof upload
  const [selectedBank, setSelectedBank] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUploadedUrl, setProofUploadedUrl] = useState('');

  // QRIS runtime state
  const [qrisTx, setQrisTx] = useState<QrisTransactionResult | null>(null);
  const [checkingQris, setCheckingQris] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerName(userProfile?.displayName || firebaseUser?.displayName || '');
    setCustomerPhone(userProfile?.phone || customerRecord?.phone || '');
    setCustomerEmail(userProfile?.email || firebaseUser?.email || '');

    const defAddr =
      customerRecord?.addresses?.find((a) => a.isDefault) || customerRecord?.addresses?.[0];
    if (defAddr) {
      setFullAddress(defAddr.fullAddress);
      setProvince(defAddr.province);
      setCity(defAddr.city);
      setDistrict(defAddr.district);
      setPostalCode(defAddr.postalCode);
      if (defAddr.recipientName) setCustomerName(defAddr.recipientName);
      if (defAddr.phone) setCustomerPhone(defAddr.phone);
    }

    const firstBank = paymentSettings.bankAccounts.find((b) => b.isActive);
    if (firstBank) setSelectedBank(firstBank.bankName);

    fetch('/api/payments/qris/config-status')
      .then((r) => r.json())
      .then((d: QrisConfigStatus) => setQrisConfig(d))
      .catch(() =>
        setQrisConfig({
          configured: false,
          provider: 'Midtrans Core API (QRIS)',
          environment: 'sandbox',
          message: 'Tidak dapat memeriksa status gateway QRIS.',
        })
      );
  }, [open, userProfile, firebaseUser, customerRecord, paymentSettings]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cartItems]
  );

  const matchedCoupon = useMemo(() => {
    if (!appliedCouponCode) return null;
    return coupons.find(
      (c) =>
        c.code.toUpperCase() === appliedCouponCode.toUpperCase() &&
        c.isActive &&
        c.usedCount < c.usageLimit
    );
  }, [coupons, appliedCouponCode]);

  const discountAmount = useMemo(() => {
    if (!matchedCoupon || subtotal < matchedCoupon.minPurchase) return 0;
    if (matchedCoupon.type === 'PERCENTAGE') {
      const calc = Math.round((subtotal * matchedCoupon.value) / 100);
      return matchedCoupon.maxDiscount && matchedCoupon.maxDiscount > 0
        ? Math.min(calc, matchedCoupon.maxDiscount)
        : calc;
    }
    return Math.min(subtotal, matchedCoupon.value);
  }, [matchedCoupon, subtotal]);

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const shippingCost =
    cartItems.length === 0
      ? 0
      : afterDiscount >= paymentSettings.freeShippingThreshold
      ? 0
      : paymentSettings.shippingBaseCost;
  const totalAmount = afterDiscount + shippingCost;

  if (!open) return null;

  const validateForm = (): string | null => {
    if (customerName.trim().length < 2) return 'Nama penerima wajib diisi.';
    if (!/^[0-9+\-\s]{8,20}$/.test(customerPhone.trim()))
      return 'Nomor WhatsApp tidak valid (minimal 8 digit angka).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) return 'Alamat email tidak valid.';
    if (fullAddress.trim().length < 8) return 'Alamat lengkap wajib diisi secara rinci.';
    if (!province.trim()) return 'Provinsi wajib diisi.';
    if (!city.trim()) return 'Kabupaten/Kota wajib diisi.';
    if (!district.trim()) return 'Kecamatan wajib diisi.';
    if (!/^[0-9]{5}$/.test(postalCode.trim())) return 'Kode pos harus terdiri dari 5 digit angka.';
    if (paymentMethod === 'COD') {
      if (!paymentSettings.codEnabled) return 'Metode COD sedang dinonaktifkan oleh butik.';
      if (paymentSettings.codMaxAmount > 0 && totalAmount > paymentSettings.codMaxAmount) {
        return `COD hanya berlaku hingga maksimal ${formatIDR(paymentSettings.codMaxAmount)}.`;
      }
    }
    if (paymentMethod === 'QRIS' && qrisConfig && !qrisConfig.configured) {
      return 'Payment gateway QRIS resmi belum dikonfigurasi pada server. Silakan pilih Transfer Bank atau COD.';
    }
    return null;
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      onOpenAuth();
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      showToast('error', validationError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await placeOrder({
        customerName,
        customerPhone,
        customerEmail,
        shippingAddress: {
          fullAddress: fullAddress.trim(),
          province: province.trim(),
          city: city.trim(),
          district: district.trim(),
          postalCode: postalCode.trim(),
        },
        notes,
        paymentMethod,
        couponCode: matchedCoupon?.code,
      });

      setCreatedOrderMeta({
        orderId: res.orderId,
        invoiceNumber: res.invoiceNumber,
        paymentId: res.paymentId,
        method: paymentMethod,
        amount: totalAmount,
      });

      if (paymentMethod === 'QRIS') {
        const token = await auth.currentUser?.getIdToken();
        const qrisRes = await fetch('/api/payments/qris/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`,
          },
          body: JSON.stringify({
            orderId: res.orderId,
            invoiceNumber: res.invoiceNumber,
            amount: totalAmount,
            customerName,
            customerEmail,
            customerPhone,
          }),
        });
        const qrisData = (await qrisRes.json()) as QrisTransactionResult;
        setQrisTx(qrisData);
        if (qrisRes.ok && qrisData.transactionId) {
          await updateDoc(doc(db, 'payments', res.paymentId), {
            qrisReferenceId: qrisData.transactionId,
            qrisUrl: qrisData.qrUrl || '',
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal membuat pesanan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !createdOrderMeta) return;
    setUploadingProof(true);
    try {
      const url = await uploadImageToServer(file, 'proof');
      await submitBankTransferProof(
        createdOrderMeta.orderId,
        createdOrderMeta.paymentId,
        url,
        selectedBank || paymentSettings.bankAccounts[0]?.bankName || 'Transfer Bank'
      );
      setProofUploadedUrl(url);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengunggah bukti transfer.');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleVerifyQrisStatus = async () => {
    if (!createdOrderMeta) return;
    setCheckingQris(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(
        `/api/payments/qris/status/${encodeURIComponent(createdOrderMeta.invoiceNumber)}`,
        { headers: { Authorization: `Bearer ${token || ''}` } }
      );
      const data = (await res.json()) as { transactionStatus?: string; error?: string };
      if (!res.ok) {
        showToast('error', data.error || 'Gagal memeriksa status QRIS.');
        return;
      }
      setQrisTx((prev) => (prev ? { ...prev, transactionStatus: data.transactionStatus } : prev));
      if (data.transactionStatus === 'settlement' || data.transactionStatus === 'capture') {
        showToast('success', 'Pembayaran QRIS telah terverifikasi berhasil!');
      } else {
        showToast('info', `Status pembayaran QRIS saat ini: ${data.transactionStatus || 'pending'}`);
      }
    } finally {
      setCheckingQris(false);
    }
  };

  const createdOrder = createdOrderMeta ? orders.find((o) => o.id === createdOrderMeta.orderId) : null;
  const createdItems = createdOrderMeta
    ? orderItems.filter((oi) => oi.orderId === createdOrderMeta.orderId)
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-[#394536]/55 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
      <div className="bg-[#FCFAF6] border border-[#E5DFD3] rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-4 border-b border-[#E5DFD3] bg-white flex items-center justify-between sticky top-0 z-10">
          <h2 className="font-serif text-2xl font-semibold text-[#394536]">
            {createdOrderMeta ? `Pembayaran · ${createdOrderMeta.invoiceNumber}` : 'Checkout Pesanan'}
          </h2>
          <button
            type="button"
            onClick={() => {
              setCreatedOrderMeta(null);
              setProofUploadedUrl('');
              setQrisTx(null);
              onClose();
            }}
            className="p-2 rounded-lg text-[#817B72] hover:bg-[#F7F2E8]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!firebaseUser ? (
          <div className="p-10 text-center space-y-4">
            <p className="font-serif text-2xl font-semibold text-[#394536]">
              Masuk ke Akun Anda untuk Melanjutkan Checkout
            </p>
            <p className="text-sm text-[#817B72] max-w-md mx-auto">
              Agar riwayat pesanan, pelacakan pengiriman, dan keamanan transaksi Anda terjaga, silakan masuk atau daftar terlebih dahulu.
            </p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-6 py-3 rounded-lg bg-[#87977B] text-white text-sm font-medium"
            >
              Masuk / Daftar Sekarang
            </button>
          </div>
        ) : createdOrderMeta ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="p-5 rounded-xl bg-[#F7F2E8] border border-[#E5DFD3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-[#817B72] uppercase">Nomor Invoice Resmi</p>
                <p className="font-mono text-xl font-semibold text-[#394536]">{createdOrderMeta.invoiceNumber}</p>
                <p className="text-sm text-[#394536] mt-1 tabular-nums">
                  Total Tagihan: <strong>{formatIDR(createdOrderMeta.amount)}</strong>
                </p>
              </div>
              {createdOrder && (
                <button
                  type="button"
                  onClick={() =>
                    exportInvoicePDF(
                      createdOrder,
                      createdItems,
                      boutiqueSettings.brandName,
                      boutiqueSettings.projectName,
                      boutiqueSettings.address
                    )
                  }
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-[#E5DFD3] text-xs font-medium text-[#394536] hover:border-[#87977B]"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Invoice PDF</span>
                </button>
              )}
            </div>

            {createdOrderMeta.method === 'TRANSFER_BANK' && (
              <div className="space-y-5 bg-white border border-[#E5DFD3] rounded-xl p-6">
                <h3 className="font-serif text-xl font-semibold text-[#394536]">
                  Instruksi Pembayaran Transfer Bank
                </h3>
                <p className="text-sm text-[#817B72]">{paymentSettings.bankTransferInstructions}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {paymentSettings.bankAccounts
                    .filter((b) => b.isActive)
                    .map((bank) => (
                      <label
                        key={bank.id}
                        className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                          selectedBank === bank.bankName
                            ? 'border-[#87977B] bg-[#F7F2E8]'
                            : 'border-[#E5DFD3] bg-[#FCFAF6]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="bankChoice"
                          checked={selectedBank === bank.bankName}
                          onChange={() => setSelectedBank(bank.bankName)}
                          className="sr-only"
                        />
                        <p className="text-sm font-semibold text-[#394536]">{bank.bankName}</p>
                        <p className="font-mono text-base font-semibold text-[#394536] mt-1 tabular-nums">
                          {bank.accountNumber}
                        </p>
                        <p className="text-xs text-[#817B72] mt-0.5">a.n. {bank.accountHolder}</p>
                      </label>
                    ))}
                </div>

                {proofUploadedUrl ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>
                      Bukti transfer telah diterima dan berstatus <strong>Menunggu Verifikasi Admin</strong>.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[#394536]">
                      Unggah Bukti Transfer (PNG/JPG/WEBP, maks. 2 MB)
                    </label>
                    <label className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl border border-dashed border-[#87977B] bg-[#FCFAF6] hover:bg-[#F7F2E8] cursor-pointer text-sm text-[#394536]">
                      <Upload className="w-4 h-4 text-[#87977B]" />
                      <span>{uploadingProof ? 'Mengunggah bukti transfer...' : 'Pilih File Bukti Transfer'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleUploadProof}
                        disabled={uploadingProof}
                        className="sr-only"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {createdOrderMeta.method === 'QRIS' && (
              <div className="space-y-4 bg-white border border-[#E5DFD3] rounded-xl p-6">
                <h3 className="font-serif text-xl font-semibold text-[#394536]">
                  Pembayaran QRIS Resmi ({paymentSettings.qrisProvider})
                </h3>
                {qrisTx && !qrisTx.configured ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Gateway QRIS Belum Dikonfigurasi</p>
                      <p className="mt-1">{qrisTx.error}</p>
                    </div>
                  </div>
                ) : qrisTx?.qrUrl ? (
                  <div className="text-center space-y-4">
                    <img
                      src={qrisTx.qrUrl}
                      alt="Kode QRIS Resmi"
                      className="w-56 h-56 mx-auto border border-[#E5DFD3] rounded-xl p-2 bg-white"
                    />
                    <p className="text-xs font-mono text-[#817B72]">
                      Ref Transaksi: {qrisTx.transactionId} · Status: {qrisTx.transactionStatus}
                    </p>
                    <p className="text-sm text-[#817B72] max-w-md mx-auto">{paymentSettings.qrisInstructions}</p>
                    <button
                      type="button"
                      onClick={handleVerifyQrisStatus}
                      disabled={checkingQris}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium"
                    >
                      <RefreshCw className={`w-4 h-4 ${checkingQris ? 'animate-spin' : ''}`} />
                      <span>Cek Status Pembayaran QRIS</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-[#817B72]">Memuat transaksi QRIS dari server gateway...</p>
                )}
              </div>
            )}

            {createdOrderMeta.method === 'COD' && (
              <div className="space-y-3 bg-white border border-[#E5DFD3] rounded-xl p-6">
                <div className="flex items-center gap-2.5 text-[#394536]">
                  <CheckCircle2 className="w-5 h-5 text-[#87977B]" />
                  <h3 className="font-serif text-xl font-semibold">Pesanan Cash On Delivery (COD) Diterima</h3>
                </div>
                <p className="text-sm text-[#817B72] leading-relaxed">{paymentSettings.codTerms}</p>
                <p className="text-sm text-[#394536]">
                  Status pembayaran akan otomatis diperbarui menjadi <strong>Lunas</strong> setelah Anda menyelesaikan pembayaran kepada kurir.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setCreatedOrderMeta(null);
                  setProofUploadedUrl('');
                  setQrisTx(null);
                  onClose();
                }}
                className="px-6 py-2.5 rounded-lg bg-[#394536] text-white text-sm font-medium"
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-8">
            {/* Form Fields */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-4">
                <h3 className="font-serif text-xl font-semibold text-[#394536]">Informasi Penerima</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#394536] mb-1">Nama Penerima *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#394536] mb-1">Nomor WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      placeholder="0812..."
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#394536] mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-[#E5DFD3]">
                <h3 className="font-serif text-xl font-semibold text-[#394536]">Alamat Pengiriman</h3>
                <div>
                  <label className="block text-xs font-medium text-[#394536] mb-1">Alamat Lengkap *</label>
                  <textarea
                    rows={2}
                    required
                    value={fullAddress}
                    onChange={(e) => setFullAddress(e.target.value)}
                    placeholder="Nama jalan, nomor rumah, RT/RW, patokan..."
                    className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#394536] mb-1">Provinsi *</label>
                    <input
                      type="text"
                      required
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#394536] mb-1">Kabupaten / Kota *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#394536] mb-1">Kecamatan *</label>
                    <input
                      type="text"
                      required
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#394536] mb-1">Kode Pos *</label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#394536] mb-1">Catatan Pesanan (Opsional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Tolong bungkus kado rapi"
                    className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-[#E5DFD3]">
                <h3 className="font-serif text-xl font-semibold text-[#394536]">Metode Pembayaran</h3>
                <div className="space-y-2.5">
                  <label
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${
                      paymentMethod === 'TRANSFER_BANK'
                        ? 'border-[#87977B] bg-[#F7F2E8]'
                        : 'border-[#E5DFD3] bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'TRANSFER_BANK'}
                      onChange={() => setPaymentMethod('TRANSFER_BANK')}
                      className="mt-1"
                    />
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-sm text-[#394536]">
                        <Building2 className="w-4 h-4 text-[#87977B]" />
                        <span>Transfer Bank</span>
                      </div>
                      <p className="text-xs text-[#817B72] mt-1">
                        Transfer ke rekening resmi butik dan unggah bukti transfer untuk verifikasi admin.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${
                      paymentMethod === 'QRIS'
                        ? 'border-[#87977B] bg-[#F7F2E8]'
                        : 'border-[#E5DFD3] bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'QRIS'}
                      onChange={() => setPaymentMethod('QRIS')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-semibold text-sm text-[#394536]">
                          <QrCode className="w-4 h-4 text-[#87977B]" />
                          <span>QRIS Resmi ({paymentSettings.qrisProvider})</span>
                        </div>
                        <span className="text-[11px] font-mono text-[#817B72]">
                          {qrisConfig?.configured ? 'Terhubung' : 'Belum Dikonfigurasi'}
                        </span>
                      </div>
                      <p className="text-xs text-[#817B72] mt-1">
                        {qrisConfig?.configured
                          ? paymentSettings.qrisInstructions
                          : 'Integrasi gateway resmi siap dipakai setelah MIDTRANS_SERVER_KEY dikonfigurasi di Secrets server. Tidak tersedia QRIS simulasi/palsu.'}
                      </p>
                    </div>
                  </label>

                  {paymentSettings.codEnabled && (
                    <label
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${
                        paymentMethod === 'COD'
                          ? 'border-[#87977B] bg-[#F7F2E8]'
                          : 'border-[#E5DFD3] bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'COD'}
                        onChange={() => setPaymentMethod('COD')}
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-2 font-semibold text-sm text-[#394536]">
                          <Banknote className="w-4 h-4 text-[#87977B]" />
                          <span>Cash On Delivery (COD)</span>
                        </div>
                        <p className="text-xs text-[#817B72] mt-1">{paymentSettings.codTerms}</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Order Summary */}
            <div className="lg:col-span-5">
              <div className="bg-white border border-[#E5DFD3] rounded-xl p-5 space-y-4 sticky top-20">
                <h3 className="font-serif text-xl font-semibold text-[#394536]">Ringkasan Pesanan</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-[#394536] truncate">{item.productName}</p>
                        <p className="text-xs text-[#817B72]">
                          {item.colorName} · {item.size} × {item.quantity}
                        </p>
                      </div>
                      <span className="font-medium tabular-nums shrink-0">
                        {formatIDR(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#E5DFD3] pt-3 space-y-1.5 text-sm tabular-nums">
                  <div className="flex justify-between text-[#817B72]">
                    <span>Subtotal</span>
                    <span>{formatIDR(subtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Diskon ({matchedCoupon?.code})</span>
                      <span>-{formatIDR(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#817B72]">
                    <span>Ongkos Kirim</span>
                    <span>{shippingCost === 0 ? 'Gratis' : formatIDR(shippingCost)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold text-[#394536] pt-2 border-t border-[#E5DFD3]">
                    <span>Total Pembayaran</span>
                    <span>{formatIDR(totalAmount)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || cartItems.length === 0}
                  className="w-full py-3 px-5 rounded-lg bg-[#87977B] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Memproses Pesanan...' : 'Buat Pesanan Sekarang'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
