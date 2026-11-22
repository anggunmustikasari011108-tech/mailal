'use client';

import React, { useMemo, useState } from 'react';
import {
  CreditCard,
  Download,
  Heart,
  KeyRound,
  LogOut,
  MapPin,
  Package,
  Plus,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { exportInvoicePDF } from '../lib/exportUtils';
import { uploadImageToServer } from '../lib/firebase';
import {
  formatIDR,
  formatJakartaDate,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  ROLE_LABELS,
} from '../lib/formatters';
import { Product, SavedAddress } from '../types';
import { ProductCard } from './ProductCard';

interface AccountPortalProps {
  onSelectProduct: (p: Product) => void;
  onOpenAdmin: () => void;
}

export const AccountPortal: React.FC<AccountPortalProps> = ({ onSelectProduct, onOpenAdmin }) => {
  const {
    firebaseUser,
    userProfile,
    customerRecord,
    isStaff,
    products,
    wishlistIds,
    orders,
    orderItems,
    payments,
    shipments,
    boutiqueSettings,
    paymentSettings,
    logout,
    updateAccountProfile,
    changePassword,
    saveCustomerAddresses,
    submitBankTransferProof,
    cancelCustomerOrder,
    showToast,
  } = useStore();

  const [tab, setTab] = useState<'orders' | 'payments' | 'addresses' | 'wishlist' | 'profile'>('orders');
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newAddr, setNewAddr] = useState<Omit<SavedAddress, 'id' | 'isDefault'>>({
    label: 'Rumah',
    recipientName: userProfile?.displayName || '',
    phone: userProfile?.phone || '',
    fullAddress: '',
    province: '',
    city: '',
    district: '',
    postalCode: '',
  });
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);

  const myOrders = useMemo(
    () => orders.filter((o) => o.userId === firebaseUser?.uid),
    [orders, firebaseUser]
  );
  const myPayments = useMemo(
    () => payments.filter((p) => p.userId === firebaseUser?.uid),
    [payments, firebaseUser]
  );
  const wishlistProducts = useMemo(
    () => products.filter((p) => wishlistIds.includes(p.id)),
    [products, wishlistIds]
  );

  if (!firebaseUser) {
    return (
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="font-serif text-3xl font-semibold text-[#394536] mb-2">Akun Pelanggan</h2>
        <p className="text-sm text-[#817B72]">Silakan masuk untuk mengelola profil, alamat, wishlist, dan pesanan Anda.</p>
      </section>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateAccountProfile(displayName, phone);
      if (newPassword.trim().length >= 6) {
        await changePassword(newPassword.trim());
        setNewPassword('');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal memperbarui akun.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = customerRecord?.addresses || [];
    const created: SavedAddress = {
      ...newAddr,
      id: `addr_${Date.now()}`,
      isDefault: list.length === 0,
    };
    await saveCustomerAddresses([...list, created]);
    setNewAddr({
      label: 'Rumah',
      recipientName: userProfile?.displayName || '',
      phone: userProfile?.phone || '',
      fullAddress: '',
      province: '',
      city: '',
      district: '',
      postalCode: '',
    });
  };

  const handleUploadProofForOrder = async (orderId: string, paymentId: string, file?: File) => {
    if (!file) return;
    setUploadingOrderId(orderId);
    try {
      const url = await uploadImageToServer(file, 'proof');
      const bankName = paymentSettings.bankAccounts[0]?.bankName || 'Transfer Bank';
      await submitBankTransferProof(orderId, paymentId, url, bankName);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengunggah bukti transfer.');
    } finally {
      setUploadingOrderId(null);
    }
  };

  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-8">
      {/* Header Summary */}
      <div className="bg-white border border-[#E5DFD3] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-[#817B72] uppercase">
            {ROLE_LABELS[userProfile?.role || 'PELANGGAN']}
          </p>
          <h1 className="font-serif text-3xl font-semibold text-[#394536]">
            {userProfile?.displayName || firebaseUser.email}
          </h1>
          <p className="text-sm text-[#817B72]">{firebaseUser.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isStaff && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="px-4 py-2 rounded-lg bg-[#394536] text-white text-xs font-medium"
            >
              Buka Dashboard Admin
            </button>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E5DFD3] text-xs font-medium text-[#394536] hover:bg-[#F7F2E8]"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-[#F7F2E8] rounded-xl w-fit">
        {[
          { id: 'orders', label: 'Riwayat & Lacak Pesanan', icon: Package },
          { id: 'payments', label: 'Riwayat Pembayaran', icon: CreditCard },
          { id: 'addresses', label: 'Alamat Pengiriman', icon: MapPin },
          { id: 'wishlist', label: `Wishlist (${wishlistProducts.length})`, icon: Heart },
          { id: 'profile', label: 'Profil & Keamanan', icon: User },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as typeof tab)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                active ? 'bg-white text-[#394536] shadow-xs' : 'text-[#817B72] hover:text-[#394536]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {myOrders.length === 0 ? (
            <div className="bg-white border border-[#E5DFD3] rounded-xl p-10 text-center text-sm text-[#817B72]">
              Anda belum memiliki riwayat pesanan.
            </div>
          ) : (
            myOrders.map((order) => {
              const items = orderItems.filter((oi) => oi.orderId === order.id);
              const payment = payments.find((p) => p.orderId === order.id);
              const shipment = shipments.find((s) => s.orderId === order.id);

              return (
                <div key={order.id} className="bg-white border border-[#E5DFD3] rounded-xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5DFD3] pb-4">
                    <div>
                      <p className="font-mono text-sm font-semibold text-[#394536]">{order.invoiceNumber}</p>
                      <p className="text-xs text-[#817B72]">
                        {formatJakartaDate(order.createdAt)} · {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-medium text-[#394536]">
                        Status: <strong>{ORDER_STATUS_LABELS[order.orderStatus]}</strong>
                      </span>
                      <span className="text-[#817B72]">|</span>
                      <span className="text-[#817B72]">
                        Bayar: <strong className="text-[#394536]">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          exportInvoicePDF(
                            order,
                            items,
                            boutiqueSettings.brandName,
                            boutiqueSettings.projectName,
                            boutiqueSettings.address
                          )
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E5DFD3] hover:border-[#87977B]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Invoice PDF</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-[#394536]">
                          {item.productName} ({item.colorName} · {item.size}) × {item.quantity}
                        </span>
                        <span className="font-medium tabular-nums">{formatIDR(item.subtotal)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold text-[#394536] pt-2 border-t border-[#E5DFD3] tabular-nums">
                      <span>Total Pembayaran</span>
                      <span>{formatIDR(order.totalAmount)}</span>
                    </div>
                  </div>

                  {/* Shipping Tracking */}
                  {shipment && (
                    <div className="p-3.5 rounded-lg bg-[#FCFAF6] border border-[#E5DFD3] text-xs space-y-1">
                      <p className="font-semibold text-[#394536]">
                        Pengiriman: {shipment.courier} ({shipment.shippingService || 'Reguler'})
                      </p>
                      <p className="text-[#817B72]">
                        Nomor Resi:{' '}
                        <span className="font-mono text-[#394536]">
                          {shipment.trackingNumber || 'Menunggu nomor resi dari butik'}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Order Status History */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-[#394536]">Riwayat Status Pesanan:</p>
                    <div className="space-y-1">
                      {(order.statusHistory || []).map((h, idx) => (
                        <div key={idx} className="text-xs text-[#817B72] flex flex-wrap gap-2">
                          <span className="font-mono">{formatJakartaDate(h.changedAt)}</span>
                          <span>·</span>
                          <span className="font-medium text-[#394536]">{ORDER_STATUS_LABELS[h.status]}</span>
                          <span>— {h.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Customer actions for pending bank transfer / cancellation */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {order.paymentMethod === 'TRANSFER_BANK' &&
                      payment &&
                      (order.paymentStatus === 'BELUM_DIBAYAR' || order.paymentStatus === 'DITOLAK') &&
                      order.orderStatus !== 'DIBATALKAN' && (
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#87977B] text-white text-xs font-medium cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {uploadingOrderId === order.id ? 'Mengunggah...' : 'Unggah Bukti Transfer'}
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(e) =>
                              void handleUploadProofForOrder(order.id, payment.id, e.target.files?.[0])
                            }
                          />
                        </label>
                      )}

                    {(order.orderStatus === 'MENUNGGU_PEMBAYARAN' ||
                      order.orderStatus === 'MENUNGGU_VERIFIKASI') && (
                      <button
                        type="button"
                        onClick={() => void cancelCustomerOrder(order.id, 'Dibatalkan oleh pelanggan')}
                        className="px-4 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-medium hover:bg-red-50"
                      >
                        Batalkan Pesanan
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F2E8] text-xs text-[#394536]">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Metode</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {myPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#817B72]">
                    Belum ada transaksi pembayaran.
                  </td>
                </tr>
              ) : (
                myPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono text-xs">{p.invoiceNumber}</td>
                    <td className="px-4 py-3">{PAYMENT_METHOD_LABELS[p.method]}</td>
                    <td className="px-4 py-3 text-xs text-[#817B72]">{formatJakartaDate(p.createdAt)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatIDR(p.amount)}</td>
                    <td className="px-4 py-3 text-xs font-medium">{PAYMENT_STATUS_LABELS[p.status]}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'addresses' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-3">
            {(customerRecord?.addresses || []).length === 0 ? (
              <div className="bg-white border border-[#E5DFD3] rounded-xl p-8 text-center text-sm text-[#817B72]">
                Belum ada alamat pengiriman tersimpan.
              </div>
            ) : (
              customerRecord?.addresses.map((addr) => (
                <div key={addr.id} className="bg-white border border-[#E5DFD3] rounded-xl p-4 flex justify-between gap-4">
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-[#394536]">
                      {addr.label} {addr.isDefault ? '· Utama' : ''}
                    </p>
                    <p className="text-[#394536]">
                      {addr.recipientName} ({addr.phone})
                    </p>
                    <p className="text-xs text-[#817B72]">
                      {addr.fullAddress}, {addr.district}, {addr.city}, {addr.province} {addr.postalCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void saveCustomerAddresses(
                        (customerRecord?.addresses || []).filter((a) => a.id !== addr.id)
                      )
                    }
                    className="p-2 text-[#817B72] hover:text-red-600 h-fit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddAddress} className="lg:col-span-5 bg-white border border-[#E5DFD3] rounded-xl p-5 space-y-3">
            <h3 className="font-serif text-xl font-semibold text-[#394536]">Tambah Alamat Baru</h3>
            <input
              type="text"
              required
              placeholder="Label (Rumah / Kantor)"
              value={newAddr.label}
              onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
              className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
            />
            <input
              type="text"
              required
              placeholder="Nama Penerima"
              value={newAddr.recipientName}
              onChange={(e) => setNewAddr({ ...newAddr, recipientName: e.target.value })}
              className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
            />
            <input
              type="tel"
              required
              placeholder="Nomor WhatsApp"
              value={newAddr.phone}
              onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
              className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
            />
            <textarea
              rows={2}
              required
              placeholder="Alamat Lengkap"
              value={newAddr.fullAddress}
              onChange={(e) => setNewAddr({ ...newAddr, fullAddress: e.target.value })}
              className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Provinsi"
                value={newAddr.province}
                onChange={(e) => setNewAddr({ ...newAddr, province: e.target.value })}
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Kota/Kabupaten"
                value={newAddr.city}
                onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Kecamatan"
                value={newAddr.district}
                onChange={(e) => setNewAddr({ ...newAddr, district: e.target.value })}
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                maxLength={5}
                placeholder="Kode Pos"
                value={newAddr.postalCode}
                onChange={(e) => setNewAddr({ ...newAddr, postalCode: e.target.value.replace(/\D/g, '') })}
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Simpan Alamat</span>
            </button>
          </form>
        </div>
      )}

      {tab === 'wishlist' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {wishlistProducts.length === 0 ? (
            <div className="col-span-full bg-white border border-[#E5DFD3] rounded-xl p-10 text-center text-sm text-[#817B72]">
              Belum ada produk yang disimpan di wishlist Anda.
            </div>
          ) : (
            wishlistProducts.map((p) => (
              <ProductCard key={p.id} product={p} onSelect={onSelectProduct} />
            ))
          )}
        </div>
      )}

      {tab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="max-w-lg bg-white border border-[#E5DFD3] rounded-xl p-6 space-y-4">
          <h3 className="font-serif text-xl font-semibold text-[#394536]">Ubah Informasi Akun & Kata Sandi</h3>
          <div>
            <label className="block text-xs font-medium text-[#394536] mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#394536] mb-1">Nomor WhatsApp</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#394536] mb-1 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#87977B]" />
              <span>Reset / Kata Sandi Baru (Opsional, minimal 6 karakter)</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Biarkan kosong jika tidak ingin mengganti"
              className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium"
          >
            {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      )}
    </section>
  );
};
