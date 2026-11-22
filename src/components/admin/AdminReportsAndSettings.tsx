'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Printer, Upload } from 'lucide-react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useStore } from '../../context/StoreContext';
import { exportReportExcel, exportReportPDF } from '../../lib/exportUtils';
import { db, handleFirestoreError, OperationType, uploadImageToServer } from '../../lib/firebase';
import {
  formatIDR,
  formatJakartaDate,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  ROLE_LABELS,
  toJakartaDateKey,
} from '../../lib/formatters';
import { BoutiqueSettings, UserRole, WebsiteBanner } from '../../types';

interface AdminReportsAndSettingsProps {
  section: 'REPORTS' | 'WEBSITE_SETTINGS' | 'BOUTIQUE_SETTINGS' | 'USERS';
}

type ReportType =
  | 'PENJUALAN'
  | 'PENDAPATAN'
  | 'TRANSAKSI'
  | 'PEMBAYARAN'
  | 'PESANAN'
  | 'PRODUK_TERLARIS'
  | 'STOK'
  | 'PELANGGAN'
  | 'VOUCHER';

export const AdminReportsAndSettings: React.FC<AdminReportsAndSettingsProps> = ({ section }) => {
  const {
    orders,
    orderItems,
    payments,
    products,
    variants,
    allCustomers,
    coupons,
    boutiqueSettings,
    banners,
    allUsers,
    activityLogs,
    isSuperAdmin,
    logActivity,
    showToast,
  } = useStore();

  // ─── Reports State ───────────────────────────────────────────────────────
  const [reportType, setReportType] = useState<ReportType>('PENJUALAN');
  const [periodPreset, setPeriodPreset] = useState<'ALL' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ─── Boutique Settings State ─────────────────────────────────────────────
  const [bForm, setBForm] = useState<BoutiqueSettings>(boutiqueSettings);
  const [uploadingAsset, setUploadingAsset] = useState(false);

  // ─── Website Banner State ────────────────────────────────────────────────
  const [editingBanner, setEditingBanner] = useState<WebsiteBanner | null>(banners[0] || null);

  useEffect(() => {
    setBForm(boutiqueSettings);
  }, [boutiqueSettings]);

  useEffect(() => {
    if (!editingBanner && banners.length > 0) {
      setEditingBanner(banners[0]);
    }
  }, [banners, editingBanner]);

  const filteredOrdersByPeriod = useMemo(() => {
    const todayKey = toJakartaDateKey(new Date());
    return orders.filter((o) => {
      const k = toJakartaDateKey(o.createdAt);
      if (!k) return periodPreset === 'ALL';
      if (periodPreset === 'DAILY') return k === todayKey;
      if (periodPreset === 'WEEKLY') {
        const d = new Date(todayKey);
        const weekAgo = new Date(d);
        weekAgo.setDate(d.getDate() - 7);
        return k >= weekAgo.toISOString().slice(0, 10);
      }
      if (periodPreset === 'MONTHLY') return k.slice(0, 7) === todayKey.slice(0, 7);
      if (periodPreset === 'YEARLY') return k.slice(0, 4) === todayKey.slice(0, 4);
      if (periodPreset === 'CUSTOM') {
        if (dateFrom && k < dateFrom) return false;
        if (dateTo && k > dateTo) return false;
      }
      return true;
    });
  }, [orders, periodPreset, dateFrom, dateTo]);

  // Profit calculation ONLY when costPrice is filled (> 0)
  const profitSummary = useMemo(() => {
    const validOrderIds = new Set(
      filteredOrdersByPeriod.filter((o) => o.orderStatus !== 'DIBATALKAN').map((o) => o.id)
    );
    let revenueWithCost = 0;
    let totalCost = 0;
    let hasAnyCost = false;
    orderItems
      .filter((oi) => validOrderIds.has(oi.orderId))
      .forEach((oi) => {
        if (oi.costPrice && oi.costPrice > 0) {
          hasAnyCost = true;
          revenueWithCost += oi.subtotal;
          totalCost += oi.costPrice * oi.quantity;
        }
      });
    return {
      hasAnyCost,
      profit: revenueWithCost - totalCost,
    };
  }, [filteredOrdersByPeriod, orderItems]);

  const reportTable = useMemo(() => {
    switch (reportType) {
      case 'PENJUALAN':
      case 'PENDAPATAN':
      case 'TRANSAKSI':
      case 'PESANAN': {
        const headers = ['Invoice', 'Tanggal', 'Pelanggan', 'Metode', 'Status Bayar', 'Status Pesanan', 'Total (IDR)'];
        const rows = filteredOrdersByPeriod.map((o) => [
          o.invoiceNumber,
          formatJakartaDate(o.createdAt),
          o.customerName,
          PAYMENT_METHOD_LABELS[o.paymentMethod],
          PAYMENT_STATUS_LABELS[o.paymentStatus],
          ORDER_STATUS_LABELS[o.orderStatus],
          o.totalAmount,
        ]);
        const totalSum = filteredOrdersByPeriod
          .filter((o) => o.orderStatus !== 'DIBATALKAN')
          .reduce((s, o) => s + o.totalAmount, 0);
        const summary = [
          `Total Transaksi: ${filteredOrdersByPeriod.length} pesanan`,
          `Total Nilai Penjualan: ${formatIDR(totalSum)}`,
          profitSummary.hasAnyCost
            ? `Estimasi Keuntungan (produk dengan harga modal terisi): ${formatIDR(profitSummary.profit)}`
            : 'Estimasi Keuntungan: Harga modal belum diisi pada item terjual.',
        ];
        return { headers, rows, summary };
      }
      case 'PEMBAYARAN': {
        const headers = ['Invoice', 'Metode', 'Nominal (IDR)', 'Status', 'Ref / Verifikator', 'Tanggal'];
        const rows = payments.map((p) => [
          p.invoiceNumber,
          PAYMENT_METHOD_LABELS[p.method],
          p.amount,
          PAYMENT_STATUS_LABELS[p.status],
          p.qrisReferenceId || p.verifiedBy || '-',
          formatJakartaDate(p.createdAt),
        ]);
        return { headers, rows, summary: [`Total Catatan Pembayaran: ${payments.length}`] };
      }
      case 'PRODUK_TERLARIS': {
        const headers = ['SKU', 'Nama Produk', 'Kategori', 'Harga', 'Stok', 'Terjual'];
        const rows = [...products]
          .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
          .map((p) => [p.sku, p.name, p.categoryName, p.price, p.totalStock, p.soldCount || 0]);
        return { headers, rows, summary: [`Total Produk Terdata: ${products.length}`] };
      }
      case 'STOK': {
        const headers = ['SKU Varian', 'Produk', 'Warna', 'Ukuran', 'Stok Tersedia', 'Stok Min'];
        const rows = variants.map((v) => {
          const prod = products.find((p) => p.id === v.productId);
          return [v.sku, prod?.name || v.productId, v.colorName, v.size, v.stock, v.minStock];
        });
        return { headers, rows, summary: [`Total Varian Stok: ${variants.length}`] };
      }
      case 'PELANGGAN': {
        const headers = ['Nama Pelanggan', 'Email', 'WhatsApp', 'Jumlah Pesanan', 'Total Belanja (IDR)'];
        const rows = allCustomers.map((c) => [c.fullName, c.email, c.phone || '-', c.totalOrders, c.totalSpent]);
        return { headers, rows, summary: [`Total Pelanggan Terdaftar: ${allCustomers.length}`] };
      }
      case 'VOUCHER': {
        const headers = ['Kode', 'Tipe', 'Nilai', 'Min. Belanja', 'Terpakai', 'Kuota', 'Status'];
        const rows = coupons.map((c) => [
          c.code,
          c.type,
          c.value,
          c.minPurchase,
          c.usedCount,
          c.usageLimit,
          c.isActive ? 'Aktif' : 'Nonaktif',
        ]);
        return { headers, rows, summary: [`Total Voucher Promo: ${coupons.length}`] };
      }
    }
  }, [reportType, filteredOrdersByPeriod, profitSummary, payments, products, variants, allCustomers, coupons]);

  const handleSaveBoutiqueSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'boutique_settings', 'default'), {
        ...bForm,
        updatedAt: serverTimestamp(),
      });
      await logActivity('UPDATE_BOUTIQUE_SETTINGS', 'boutique_settings', 'default', `Brand: ${bForm.brandName}`);
      showToast('success', 'Pengaturan boutique & identitas brand berhasil disimpan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'boutique_settings/default');
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    try {
      await setDoc(doc(db, 'website_banners', editingBanner.id), {
        ...editingBanner,
        updatedAt: serverTimestamp(),
      });
      await logActivity('UPDATE_BANNER', 'website_banners', editingBanner.id, editingBanner.title);
      showToast('success', 'Banner website berhasil diperbarui.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `website_banners/${editingBanner.id}`);
    }
  };

  const handleUploadAsset = async (
    file: File | undefined,
    cat: 'logo' | 'banner',
    onDone: (url: string) => void
  ) => {
    if (!file) return;
    setUploadingAsset(true);
    try {
      const url = await uploadImageToServer(file, cat);
      onDone(url);
      showToast('success', 'Gambar berhasil diunggah.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengunggah gambar.');
    } finally {
      setUploadingAsset(false);
    }
  };

  const handleRoleChange = async (uid: string, nextRole: UserRole) => {
    if (!isSuperAdmin) {
      showToast('error', 'Hanya Super Admin yang dapat mengubah hak akses role pengguna.');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      });
      await logActivity('CHANGE_USER_ROLE', 'users', uid, `Role diubah ke ${nextRole}`);
      showToast('success', 'Role pengguna berhasil diperbarui.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  if (section === 'REPORTS') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h1 className="font-serif text-3xl font-semibold text-[#394536]">Laporan Bisnis & Keuangan</h1>
          <div className="flex flex-wrap gap-2 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E5DFD3] bg-white text-xs font-medium"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak</span>
            </button>
            <button
              type="button"
              onClick={() =>
                exportReportPDF(
                  `Laporan ${reportType}`,
                  boutiqueSettings.brandName,
                  periodPreset,
                  reportTable.headers,
                  reportTable.rows,
                  reportTable.summary
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#394536] text-white text-xs font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor PDF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const jsonRows = reportTable.rows.map((r) => {
                  const obj: Record<string, string | number> = {};
                  reportTable.headers.forEach((h, i) => {
                    obj[h] = r[i];
                  });
                  return obj;
                });
                exportReportExcel(`laporan-${reportType.toLowerCase()}`, reportType, jsonRows);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#87977B] text-white text-xs font-medium"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor Excel</span>
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#E5DFD3] rounded-xl p-4 flex flex-wrap gap-3 items-center justify-between no-print">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                'PENJUALAN',
                'PENDAPATAN',
                'TRANSAKSI',
                'PEMBAYARAN',
                'PESANAN',
                'PRODUK_TERLARIS',
                'STOK',
                'PELANGGAN',
                'VOUCHER',
              ] as ReportType[]
            ).map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => setReportType(rt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  reportType === rt ? 'bg-[#394536] text-white' : 'bg-[#F7F2E8] text-[#394536]'
                }`}
              >
                {rt.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as typeof periodPreset)}
              className="rounded-lg border border-[#E5DFD3] px-3 py-1.5 text-xs bg-white"
            >
              <option value="ALL">Semua Waktu</option>
              <option value="DAILY">Harian (Hari Ini)</option>
              <option value="WEEKLY">Mingguan (7 Hari)</option>
              <option value="MONTHLY">Bulanan</option>
              <option value="YEARLY">Tahunan</option>
              <option value="CUSTOM">Rentang Tanggal</option>
            </select>
            {periodPreset === 'CUSTOM' && (
              <>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-[#E5DFD3] px-2 py-1 text-xs" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-[#E5DFD3] px-2 py-1 text-xs" />
              </>
            )}
          </div>
        </div>

        <div className="bg-[#F7F2E8] border border-[#E5DFD3] rounded-xl p-4 space-y-1 text-sm">
          {reportTable.summary.map((line, i) => (
            <p key={i} className="font-medium text-[#394536]">{line}</p>
          ))}
        </div>

        <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F2E8] text-xs">
              <tr>
                {reportTable.headers.map((h) => (
                  <th key={h} className="px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {reportTable.rows.length === 0 ? (
                <tr><td colSpan={reportTable.headers.length} className="px-4 py-8 text-center text-[#817B72]">Tidak ada data untuk laporan ini.</td></tr>
              ) : (
                reportTable.rows.map((row, idx) => (
                  <tr key={idx}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-3 text-xs tabular-nums">
                        {typeof cell === 'number' && reportTable.headers[ci].includes('IDR')
                          ? formatIDR(cell)
                          : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'WEBSITE_SETTINGS') {
    return (
      <div className="space-y-8">
        <h1 className="font-serif text-3xl font-semibold text-[#394536]">Pengaturan Website & Banner</h1>

        <form onSubmit={handleSaveBoutiqueSettings} className="bg-white border border-[#E5DFD3] rounded-xl p-6 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-[#394536]">Warna Identitas & Favicon</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { key: 'primaryColor', label: 'Primary' },
              { key: 'secondaryColor', label: 'Secondary' },
              { key: 'accentColor', label: 'Accent' },
              { key: 'backgroundColor', label: 'Background' },
              { key: 'textColor', label: 'Text' },
              { key: 'secondaryTextColor', label: 'Muted Text' },
            ].map((c) => (
              <div key={c.key}>
                <label className="block text-xs font-medium mb-1">{c.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={String(bForm[c.key as keyof BoutiqueSettings] || '#87977B')}
                    onChange={(e) => setBForm({ ...bForm, [c.key]: e.target.value })}
                    className="w-10 h-9 rounded border border-[#E5DFD3]"
                  />
                  <span className="font-mono text-xs">{String(bForm[c.key as keyof BoutiqueSettings])}</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">URL Favicon</label>
            <input
              type="text"
              value={bForm.faviconUrl}
              onChange={(e) => setBForm({ ...bForm, faviconUrl: e.target.value })}
              className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium">
            Simpan Warna & Favicon
          </button>
        </form>

        {editingBanner && (
          <form onSubmit={handleSaveBanner} className="bg-white border border-[#E5DFD3] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold text-[#394536]">Kelola Banner Hero & Promo</h2>
              <select
                value={editingBanner.id}
                onChange={(e) => {
                  const found = banners.find((b) => b.id === e.target.value);
                  if (found) setEditingBanner(found);
                }}
                className="rounded-lg border border-[#E5DFD3] px-3 py-1.5 text-xs bg-white"
              >
                {banners.map((b) => (
                  <option key={b.id} value={b.id}>{b.title} ({b.placement})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Headline Banner *</label>
                <input type="text" required value={editingBanner.headline} onChange={(e) => setEditingBanner({ ...editingBanner, headline: e.target.value })} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Gambar Banner</label>
                <div className="flex gap-2">
                  <input type="text" value={editingBanner.imageUrl} onChange={(e) => setEditingBanner({ ...editingBanner, imageUrl: e.target.value })} className="flex-1 rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
                  <label className="px-3 py-2 rounded-lg border border-[#87977B] text-xs font-medium cursor-pointer inline-flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingAsset ? '...' : 'Unggah'}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void handleUploadAsset(e.target.files?.[0], 'banner', (u) => setEditingBanner({ ...editingBanner, imageUrl: u }))} />
                  </label>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Subheadline</label>
              <textarea rows={2} value={editingBanner.subheadline || ''} onChange={(e) => setEditingBanner({ ...editingBanner, subheadline: e.target.value })} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="Teks Tombol Utama" value={editingBanner.ctaPrimaryText || ''} onChange={(e) => setEditingBanner({ ...editingBanner, ctaPrimaryText: e.target.value })} className="rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
              <input type="text" placeholder="Teks Tombol Kedua" value={editingBanner.ctaSecondaryText || ''} onChange={(e) => setEditingBanner({ ...editingBanner, ctaSecondaryText: e.target.value })} className="rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium">
              Simpan Perubahan Banner
            </button>
          </form>
        )}
      </div>
    );
  }

  if (section === 'BOUTIQUE_SETTINGS') {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-3xl font-semibold text-[#394536]">Pengaturan Boutique & Identitas Brand</h1>
        <form onSubmit={handleSaveBoutiqueSettings} className="bg-white border border-[#E5DFD3] rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Nama Brand Dinamis *</label>
              <input type="text" required value={bForm.brandName} onChange={(e) => setBForm({ ...bForm, brandName: e.target.value })} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Nama Proyek / Butik *</label>
              <input type="text" required value={bForm.projectName} onChange={(e) => setBForm({ ...bForm, projectName: e.target.value })} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Logo Boutique</label>
            <div className="flex gap-2">
              <input type="text" value={bForm.logoUrl} onChange={(e) => setBForm({ ...bForm, logoUrl: e.target.value })} className="flex-1 rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
              <label className="px-3 py-2 rounded-lg border border-[#87977B] text-xs font-medium cursor-pointer inline-flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah Logo</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void handleUploadAsset(e.target.files?.[0], 'logo', (u) => setBForm({ ...bForm, logoUrl: u }))} />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Deskripsi Brand</label>
            <textarea rows={2} value={bForm.brandDescription} onChange={(e) => setBForm({ ...bForm, brandDescription: e.target.value })} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Alamat Butik" value={bForm.address} onChange={(e) => setBForm({ ...bForm, address: e.target.value })} className="rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
            <input type="text" placeholder="Jam Operasional" value={bForm.operatingHours} onChange={(e) => setBForm({ ...bForm, operatingHours: e.target.value })} className="rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
            <input type="text" placeholder="Nomor WhatsApp" value={bForm.whatsapp} onChange={(e) => setBForm({ ...bForm, whatsapp: e.target.value })} className="rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
            <input type="text" placeholder="Instagram" value={bForm.instagram} onChange={(e) => setBForm({ ...bForm, instagram: e.target.value })} className="rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
            <input type="email" placeholder="Email Resmi" value={bForm.email} onChange={(e) => setBForm({ ...bForm, email: e.target.value })} className="rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#E5DFD3]">
            <div>
              <label className="block text-xs font-medium mb-1">Kebijakan Pengiriman</label>
              <textarea rows={3} value={bForm.shippingPolicy} onChange={(e) => setBForm({ ...bForm, shippingPolicy: e.target.value })} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Kebijakan Pengembalian / Retur</label>
              <textarea rows={3} value={bForm.returnPolicy} onChange={(e) => setBForm({ ...bForm, returnPolicy: e.target.value })} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Syarat dan Ketentuan</label>
              <textarea rows={3} value={bForm.termsAndConditions} onChange={(e) => setBForm({ ...bForm, termsAndConditions: e.target.value })} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Kebijakan Privasi</label>
              <textarea rows={3} value={bForm.privacyPolicy} onChange={(e) => setBForm({ ...bForm, privacyPolicy: e.target.value })} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-xs" />
            </div>
          </div>
          <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium">
            Simpan Pengaturan Boutique
          </button>
        </form>
      </div>
    );
  }

  // ─── USERS & ACTIVITY AUDIT LOGS ─────────────────────────────────────────
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-semibold text-[#394536]">Manajemen Pengguna & Audit Aktivitas</h1>

      <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F7F2E8] text-xs">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role Saat Ini</th>
              <th className="px-4 py-3 text-right">Ubah Role (Super Admin)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {allUsers.map((u) => (
              <tr key={u.uid}>
                <td className="px-4 py-3 font-medium">{u.displayName}</td>
                <td className="px-4 py-3 text-xs text-[#817B72]">{u.email}</td>
                <td className="px-4 py-3 text-xs font-semibold">{ROLE_LABELS[u.role]}</td>
                <td className="px-4 py-3 text-right">
                  <select
                    disabled={!isSuperAdmin}
                    value={u.role}
                    onChange={(e) => void handleRoleChange(u.uid, e.target.value as UserRole)}
                    className="rounded-lg border border-[#E5DFD3] px-2.5 py-1 text-xs bg-white disabled:opacity-50"
                  >
                    {(['SUPER_ADMIN', 'ADMIN', 'STAF', 'PELANGGAN'] as UserRole[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <h2 className="font-serif text-xl font-semibold text-[#394536]">Audit Aktivitas Admin & Staf</h2>
        <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F2E8] text-xs">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Aktor</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {activityLogs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[#817B72]">Belum ada catatan audit aktivitas.</td></tr>
              ) : (
                activityLogs.slice(0, 50).map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-xs text-[#817B72]">{formatJakartaDate(log.createdAt)}</td>
                    <td className="px-4 py-3 text-xs font-medium">{log.actorName} ({log.actorRole})</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#817B72]">{log.targetType}</td>
                    <td className="px-4 py-3 text-xs">{log.details || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
