'use client';

import React, { useEffect, useState } from 'react';
import { Check, Download, Plus, Printer, Trash2, X } from 'lucide-react';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { useStore } from '../../context/StoreContext';
import { exportInvoicePDF } from '../../lib/exportUtils';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  formatIDR,
  formatJakartaDate,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  sanitizeImageUrl,
} from '../../lib/formatters';
import { BankAccount, Order, OrderStatus, PaymentRecord, Shipment, ShipmentStatus } from '../../types';

interface AdminOperationsSectionProps {
  section: 'ORDERS' | 'PAYMENTS' | 'CUSTOMERS' | 'COUPONS' | 'SHIPPING';
}

const ORDER_STATUS_LIST: OrderStatus[] = [
  'MENUNGGU_PEMBAYARAN',
  'MENUNGGU_VERIFIKASI',
  'PEMBAYARAN_DIKONFIRMASI',
  'SEDANG_DIPROSES',
  'SEDANG_DIKEMAS',
  'DIKIRIM',
  'SELESAI',
  'DIBATALKAN',
];

export const AdminOperationsSection: React.FC<AdminOperationsSectionProps> = ({ section }) => {
  const {
    orders,
    orderItems,
    payments,
    paymentSettings,
    shipments,
    allCustomers,
    coupons,
    boutiqueSettings,
    userProfile,
    logActivity,
    showToast,
  } = useStore();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [qrisConfigState, setQrisConfigState] = useState<{ configured: boolean; message: string } | null>(null);

  // Payment settings form
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(paymentSettings.bankAccounts);
  const [newBankName, setNewBankName] = useState('');
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccHolder, setNewAccHolder] = useState('');
  const [codEnabled, setCodEnabled] = useState(paymentSettings.codEnabled);
  const [codTerms, setCodTerms] = useState(paymentSettings.codTerms);
  const [codMaxAmount, setCodMaxAmount] = useState(String(paymentSettings.codMaxAmount));
  const [shippingBaseCost, setShippingBaseCost] = useState(String(paymentSettings.shippingBaseCost));
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(
    String(paymentSettings.freeShippingThreshold)
  );

  // Coupon form
  const [cCode, setCCode] = useState('');
  const [cType, setCType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [cValue, setCValue] = useState('10');
  const [cMinPurchase, setCMinPurchase] = useState('300000');
  const [cUsageLimit, setCUsageLimit] = useState('100');
  const [cStartDate, setCStartDate] = useState('2026-01-01');
  const [cEndDate, setCEndDate] = useState('2027-12-31');
  const [cDesc, setCDesc] = useState('');

  // Shipment inline edits
  const [shipEdits, setShipEdits] = useState<
    Record<string, { courier: string; trackingNumber: string; status: ShipmentStatus }>
  >({});

  useEffect(() => {
    setBankAccounts(paymentSettings.bankAccounts);
    setCodEnabled(paymentSettings.codEnabled);
    setCodTerms(paymentSettings.codTerms);
    setCodMaxAmount(String(paymentSettings.codMaxAmount));
    setShippingBaseCost(String(paymentSettings.shippingBaseCost));
    setFreeShippingThreshold(String(paymentSettings.freeShippingThreshold));
  }, [paymentSettings]);

  useEffect(() => {
    if (section === 'PAYMENTS') {
      fetch('/api/payments/qris/config-status')
        .then((r) => r.json())
        .then((d: { configured: boolean; message: string }) => setQrisConfigState(d))
        .catch(() => null);
    }
  }, [section]);

  const handleUpdateOrderStatus = async (order: Order, nextStatus: OrderStatus) => {
    try {
      const nextHistory = [
        ...(order.statusHistory || []),
        {
          status: nextStatus,
          note: statusNote.trim() || `Status diubah menjadi ${ORDER_STATUS_LABELS[nextStatus]}`,
          changedBy: userProfile?.displayName || 'Admin',
          changedAt: new Date().toISOString(),
        },
      ];
      await updateDoc(doc(db, 'orders', order.id), {
        orderStatus: nextStatus,
        statusHistory: nextHistory.slice(-25),
        updatedAt: serverTimestamp(),
      });
      await logActivity('UPDATE_ORDER_STATUS', 'orders', order.id, `${order.invoiceNumber} -> ${nextStatus}`);
      setStatusNote('');
      setSelectedOrder({ ...order, orderStatus: nextStatus, statusHistory: nextHistory });
      showToast('success', `Status pesanan ${order.invoiceNumber} diperbarui.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  const handleVerifyPayment = async (payment: PaymentRecord, approve: boolean) => {
    const order = orders.find((o) => o.id === payment.orderId);
    if (!order) return;
    try {
      const batch = writeBatch(db);
      const nextPayStatus = approve
        ? payment.method === 'COD'
          ? 'LUNAS'
          : 'BERHASIL'
        : 'DITOLAK';
      const nextOrderStatus: OrderStatus = approve
        ? order.orderStatus === 'SELESAI'
          ? 'SELESAI'
          : 'PEMBAYARAN_DIKONFIRMASI'
        : 'MENUNGGU_PEMBAYARAN';

      batch.update(doc(db, 'payments', payment.id), {
        status: nextPayStatus,
        verifiedBy: userProfile?.displayName || 'Admin',
        rejectionReason: approve ? '' : rejectReason.trim() || 'Bukti pembayaran tidak sesuai.',
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'orders', order.id), {
        paymentStatus: nextPayStatus,
        orderStatus: nextOrderStatus,
        statusHistory: [
          ...(order.statusHistory || []),
          {
            status: nextOrderStatus,
            note: approve
              ? `Pembayaran ${PAYMENT_METHOD_LABELS[payment.method]} diverifikasi (${PAYMENT_STATUS_LABELS[nextPayStatus]}).`
              : `Pembayaran ditolak: ${rejectReason.trim() || 'Bukti tidak valid'}.`,
            changedBy: userProfile?.displayName || 'Admin',
            changedAt: new Date().toISOString(),
          },
        ].slice(-25),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      await logActivity(
        approve ? 'APPROVE_PAYMENT' : 'REJECT_PAYMENT',
        'payments',
        payment.id,
        `${payment.invoiceNumber} (${nextPayStatus})`
      );
      setRejectReason('');
      showToast('success', approve ? 'Pembayaran berhasil dikonfirmasi.' : 'Pembayaran ditolak.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payments/${payment.id}`);
    }
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(
        doc(db, 'payment_settings', 'default'),
        {
          ...paymentSettings,
          bankAccounts,
          codEnabled,
          codTerms: codTerms.trim(),
          codMaxAmount: Math.max(0, Number(codMaxAmount) || 0),
          shippingBaseCost: Math.max(0, Number(shippingBaseCost) || 0),
          freeShippingThreshold: Math.max(0, Number(freeShippingThreshold) || 0),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await logActivity('UPDATE_PAYMENT_SETTINGS', 'payment_settings', 'default', 'Memperbarui rekening, COD, dan ongkir');
      showToast('success', 'Pengaturan pembayaran & pengiriman disimpan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'payment_settings/default');
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `coupon_${Date.now()}`;
    try {
      await setDoc(doc(db, 'coupons', id), {
        code: cCode.trim().toUpperCase(),
        type: cType,
        value: Math.max(0, Number(cValue) || 0),
        minPurchase: Math.max(0, Number(cMinPurchase) || 0),
        maxDiscount: cType === 'PERCENTAGE' ? 150000 : Math.max(0, Number(cValue) || 0),
        startDate: cStartDate,
        endDate: cEndDate,
        usageLimit: Math.max(1, Number(cUsageLimit) || 1),
        usedCount: 0,
        isActive: true,
        description: cDesc.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logActivity('CREATE_COUPON', 'coupons', id, `Menambah voucher ${cCode.toUpperCase()}`);
      setCCode('');
      setCDesc('');
      showToast('success', 'Voucher promo berhasil dibuat.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `coupons/${id}`);
    }
  };

  const handleSaveShipment = async (shipment: Shipment) => {
    const edit = shipEdits[shipment.id] || {
      courier: shipment.courier,
      trackingNumber: shipment.trackingNumber || '',
      status: shipment.status,
    };
    try {
      await updateDoc(doc(db, 'shipments', shipment.id), {
        courier: edit.courier,
        trackingNumber: edit.trackingNumber,
        status: edit.status,
        updatedAt: serverTimestamp(),
      });
      if (edit.status === 'DIKIRIM') {
        const ord = orders.find((o) => o.id === shipment.orderId);
        if (ord && ord.orderStatus !== 'DIKIRIM') {
          await handleUpdateOrderStatus(ord, 'DIKIRIM');
        }
      }
      showToast('success', `Pengiriman ${shipment.invoiceNumber} diperbarui.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shipments/${shipment.id}`);
    }
  };

  if (section === 'ORDERS') {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-3xl font-semibold text-[#394536]">Manajemen Pesanan</h1>

        <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F2E8] text-xs">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Pelanggan</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Metode</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Bayar</th>
                <th className="px-4 py-3">Status Pesanan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {orders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-[#817B72]">Belum ada pesanan masuk.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{o.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#394536]">{o.customerName}</p>
                      <p className="text-xs text-[#817B72]">{o.customerPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#817B72]">{formatJakartaDate(o.createdAt)}</td>
                    <td className="px-4 py-3 text-xs">{PAYMENT_METHOD_LABELS[o.paymentMethod]}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatIDR(o.totalAmount)}</td>
                    <td className="px-4 py-3 text-xs">{PAYMENT_STATUS_LABELS[o.paymentStatus]}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-[#394536]">
                      {ORDER_STATUS_LABELS[o.orderStatus]}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(o)}
                        className="px-3 py-1.5 rounded-lg border border-[#87977B] text-xs font-medium hover:bg-[#F7F2E8]"
                      >
                        Kelola
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-[#FCFAF6] border border-[#E5DFD3] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-3">
                <div>
                  <p className="font-mono text-xs text-[#817B72]">{selectedOrder.invoiceNumber}</p>
                  <h2 className="font-serif text-2xl font-semibold text-[#394536]">Detail & Status Pesanan</h2>
                </div>
                <button type="button" onClick={() => setSelectedOrder(null)} className="p-1.5 rounded-lg hover:bg-[#F7F2E8]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-white p-4 rounded-xl border border-[#E5DFD3]">
                <div>
                  <p className="font-semibold text-[#394536]">Penerima</p>
                  <p>{selectedOrder.customerName} ({selectedOrder.customerPhone})</p>
                  <p className="text-[#817B72]">{selectedOrder.customerEmail}</p>
                </div>
                <div>
                  <p className="font-semibold text-[#394536]">Alamat Kirim</p>
                  <p>
                    {selectedOrder.shippingAddress.fullAddress}, {selectedOrder.shippingAddress.district},{' '}
                    {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.province}{' '}
                    {selectedOrder.shippingAddress.postalCode}
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#E5DFD3] space-y-2">
                {orderItems
                  .filter((oi) => oi.orderId === selectedOrder.id)
                  .map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.productName} ({item.colorName} · {item.size}) × {item.quantity}
                      </span>
                      <span className="font-medium tabular-nums">{formatIDR(item.subtotal)}</span>
                    </div>
                  ))}
              </div>

              <div className="space-y-3 bg-white p-4 rounded-xl border border-[#E5DFD3]">
                <label className="block text-xs font-semibold text-[#394536]">Ubah Status Pesanan</label>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Catatan perubahan status (opsional)..."
                  className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  {ORDER_STATUS_LIST.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => void handleUpdateOrderStatus(selectedOrder, st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                        selectedOrder.orderStatus === st
                          ? 'bg-[#394536] text-white border-[#394536]'
                          : 'bg-[#FCFAF6] text-[#394536] border-[#E5DFD3] hover:border-[#87977B]'
                      }`}
                    >
                      {ORDER_STATUS_LABELS[st]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    exportInvoicePDF(
                      selectedOrder,
                      orderItems.filter((oi) => oi.orderId === selectedOrder.id),
                      boutiqueSettings.brandName,
                      boutiqueSettings.projectName,
                      boutiqueSettings.address
                    )
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#87977B] text-white text-xs font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>Cetak / Unduh Invoice PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E5DFD3] text-xs font-medium"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Halaman</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (section === 'PAYMENTS') {
    return (
      <div className="space-y-8">
        <h1 className="font-serif text-3xl font-semibold text-[#394536]">Manajemen & Verifikasi Pembayaran</h1>

        {qrisConfigState && (
          <div className={`p-4 rounded-xl border text-xs ${qrisConfigState.configured ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
            <strong>Status Gateway QRIS Resmi:</strong> {qrisConfigState.message}
          </div>
        )}

        <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F2E8] text-xs">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Metode</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3">Bukti / Ref</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {payments.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[#817B72]">Belum ada transaksi pembayaran.</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono text-xs">{p.invoiceNumber}</td>
                    <td className="px-4 py-3 text-xs">{PAYMENT_METHOD_LABELS[p.method]}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatIDR(p.amount)}</td>
                    <td className="px-4 py-3 text-xs">
                      {p.proofImageUrl ? (
                        <a
                          href={sanitizeImageUrl(p.proofImageUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-[#87977B]"
                        >
                          Lihat Bukti Transfer
                        </a>
                      ) : p.qrisReferenceId ? (
                        <span className="font-mono">{p.qrisReferenceId}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">{PAYMENT_STATUS_LABELS[p.status]}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {p.status !== 'BERHASIL' && p.status !== 'LUNAS' && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleVerifyPayment(p, true)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#87977B] text-white text-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{p.method === 'COD' ? 'Konfirmasi Lunas' : 'Setujui'}</span>
                          </button>
                          {p.method === 'TRANSFER_BANK' && (
                            <button
                              type="button"
                              onClick={() => void handleVerifyPayment(p, false)}
                              className="px-3 py-1 rounded-lg border border-red-200 text-red-700 text-xs"
                            >
                              Tolak
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Payment & Bank Accounts Settings */}
        <form onSubmit={handleSavePaymentSettings} className="bg-white border border-[#E5DFD3] rounded-xl p-6 space-y-5">
          <h2 className="font-serif text-xl font-semibold text-[#394536]">Pengaturan Rekening Bank, COD & Ongkos Kirim</h2>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#394536]">Daftar Rekening Bank Resmi</p>
            {bankAccounts.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-[#E5DFD3] text-xs">
                <span>
                  <strong>{b.bankName}</strong> · <span className="font-mono">{b.accountNumber}</span> · a.n. {b.accountHolder}
                </span>
                <button
                  type="button"
                  onClick={() => setBankAccounts((prev) => prev.filter((x) => x.id !== b.id))}
                  className="text-red-600 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input type="text" placeholder="Nama Bank" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} className="rounded-lg border border-[#E5DFD3] px-3 py-2 text-xs" />
              <input type="text" placeholder="Nomor Rekening" value={newAccNumber} onChange={(e) => setNewAccNumber(e.target.value)} className="rounded-lg border border-[#E5DFD3] px-3 py-2 text-xs font-mono" />
              <input type="text" placeholder="Atas Nama" value={newAccHolder} onChange={(e) => setNewAccHolder(e.target.value)} className="rounded-lg border border-[#E5DFD3] px-3 py-2 text-xs" />
              <button
                type="button"
                onClick={() => {
                  if (!newBankName || !newAccNumber || !newAccHolder) return;
                  setBankAccounts((prev) => [
                    ...prev,
                    { id: `bank_${Date.now()}`, bankName: newBankName, accountNumber: newAccNumber, accountHolder: newAccHolder, isActive: true },
                  ]);
                  setNewBankName('');
                  setNewAccNumber('');
                  setNewAccHolder('');
                }}
                className="px-3 py-2 rounded-lg border border-[#87977B] text-xs font-medium"
              >
                + Tambah Rekening
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#E5DFD3]">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={codEnabled} onChange={(e) => setCodEnabled(e.target.checked)} />
              <span>Aktifkan Metode COD</span>
            </label>
            <div>
              <label className="block text-xs font-medium mb-1">Maksimal Transaksi COD (IDR)</label>
              <input type="number" value={codMaxAmount} onChange={(e) => setCodMaxAmount(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Ongkir Dasar (IDR)</label>
              <input type="number" value={shippingBaseCost} onChange={(e) => setShippingBaseCost(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1">Syarat & Ketentuan COD</label>
              <input type="text" value={codTerms} onChange={(e) => setCodTerms(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Minimal Gratis Ongkir (IDR)</label>
              <input type="number" value={freeShippingThreshold} onChange={(e) => setFreeShippingThreshold(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
            </div>
          </div>

          <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium">
            Simpan Pengaturan Pembayaran
          </button>
        </form>
      </div>
    );
  }

  if (section === 'CUSTOMERS') {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-3xl font-semibold text-[#394536]">Data Pelanggan</h1>
        <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F2E8] text-xs">
              <tr>
                <th className="px-4 py-3">Nama Pelanggan</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3 text-right">Total Pesanan</th>
                <th className="px-4 py-3 text-right">Total Belanja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {allCustomers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.fullName}</td>
                  <td className="px-4 py-3 text-xs text-[#817B72]">{c.email}</td>
                  <td className="px-4 py-3 text-xs">{c.phone || '-'}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{c.totalOrders}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatIDR(c.totalSpent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'COUPONS') {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-3xl font-semibold text-[#394536]">Voucher dan Promo</h1>
        <form onSubmit={handleCreateCoupon} className="bg-white border border-[#E5DFD3] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium mb-1">Kode Voucher *</label>
            <input type="text" required value={cCode} onChange={(e) => setCCode(e.target.value.toUpperCase())} placeholder="SYAWAL15" className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm font-mono uppercase" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Tipe Diskon</label>
            <select value={cType} onChange={(e) => setCType(e.target.value as typeof cType)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm bg-white">
              <option value="PERCENTAGE">Persentase (%)</option>
              <option value="FIXED">Nominal (IDR)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nilai Diskon</label>
            <input type="number" required min={1} value={cValue} onChange={(e) => setCValue(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Minimal Pembelian</label>
            <input type="number" required min={0} value={cMinPurchase} onChange={(e) => setCMinPurchase(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Tanggal Mulai</label>
            <input type="date" value={cStartDate} onChange={(e) => setCStartDate(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Tanggal Berakhir</label>
            <input type="date" value={cEndDate} onChange={(e) => setCEndDate(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Kuota Penggunaan</label>
            <input type="number" required min={1} value={cUsageLimit} onChange={(e) => setCUsageLimit(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="px-4 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium inline-flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Buat Voucher</span>
          </button>
        </form>

        <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F2E8] text-xs">
              <tr>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Diskon</th>
                <th className="px-4 py-3 text-right">Min. Belanja</th>
                <th className="px-4 py-3 text-right">Terpakai / Kuota</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                  <td className="px-4 py-3">{c.type === 'PERCENTAGE' ? `${c.value}%` : formatIDR(c.value)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatIDR(c.minPurchase)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{c.usedCount} / {c.usageLimit}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void updateDoc(doc(db, 'coupons', c.id), { isActive: !c.isActive, updatedAt: serverTimestamp() })}
                      className={`text-xs underline ${c.isActive ? 'text-emerald-700' : 'text-[#817B72]'}`}
                    >
                      {c.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => void deleteDoc(doc(db, 'coupons', c.id))} className="text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── SHIPPING MANAGEMENT ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-[#394536]">Manajemen Pengiriman & Resi</h1>
      <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F7F2E8] text-xs">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Kurir</th>
              <th className="px-4 py-3">Nomor Resi</th>
              <th className="px-4 py-3">Status Kirim</th>
              <th className="px-4 py-3 text-right">Simpan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {shipments.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#817B72]">Belum ada data pengiriman.</td></tr>
            ) : (
              shipments.map((s) => {
                const edit = shipEdits[s.id] || {
                  courier: s.courier,
                  trackingNumber: s.trackingNumber || '',
                  status: s.status,
                };
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-mono text-xs">{s.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={edit.courier}
                        onChange={(e) =>
                          setShipEdits((prev) => ({ ...prev, [s.id]: { ...edit, courier: e.target.value } }))
                        }
                        className="rounded border border-[#E5DFD3] px-2 py-1 text-xs w-36"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="Resi JNE/J&T..."
                        value={edit.trackingNumber}
                        onChange={(e) =>
                          setShipEdits((prev) => ({
                            ...prev,
                            [s.id]: { ...edit, trackingNumber: e.target.value },
                          }))
                        }
                        className="rounded border border-[#E5DFD3] px-2 py-1 text-xs font-mono w-44"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={edit.status}
                        onChange={(e) =>
                          setShipEdits((prev) => ({
                            ...prev,
                            [s.id]: { ...edit, status: e.target.value as ShipmentStatus },
                          }))
                        }
                        className="rounded border border-[#E5DFD3] px-2 py-1 text-xs bg-white"
                      >
                        {['MENUNGGU', 'DIKEMAS', 'DIKIRIM', 'DITERIMA', 'DIBATALKAN'].map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleSaveShipment(s)}
                        className="px-3 py-1.5 rounded-lg bg-[#87977B] text-white text-xs font-medium"
                      >
                        Update Resi
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
