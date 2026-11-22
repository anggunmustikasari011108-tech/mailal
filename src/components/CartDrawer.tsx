'use client';

import React, { useMemo, useState } from 'react';
import { Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatIDR, sanitizeImageUrl } from '../lib/formatters';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  appliedCouponCode: string;
  onApplyCoupon: (code: string) => void;
  onProceedCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  onClose,
  appliedCouponCode,
  onApplyCoupon,
  onProceedCheckout,
}) => {
  const {
    cartItems,
    variants,
    coupons,
    paymentSettings,
    updateCartItemQuantity,
    updateCartItemVariant,
    removeFromCart,
    showToast,
  } = useStore();

  const [voucherInput, setVoucherInput] = useState(appliedCouponCode);

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

  const handleVoucherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = voucherInput.trim().toUpperCase();
    if (!code) {
      onApplyCoupon('');
      return;
    }
    const found = coupons.find((c) => c.code.toUpperCase() === code && c.isActive);
    if (!found) {
      showToast('error', 'Kode voucher tidak ditemukan atau sudah tidak aktif.');
      return;
    }
    if (found.usedCount >= found.usageLimit) {
      showToast('error', 'Kuota penggunaan voucher ini sudah habis.');
      return;
    }
    if (subtotal < found.minPurchase) {
      showToast('error', `Minimal belanja untuk voucher ${found.code} adalah ${formatIDR(found.minPurchase)}.`);
      return;
    }
    onApplyCoupon(found.code);
    showToast('success', `Voucher ${found.code} berhasil diterapkan.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#394536]/45 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#FCFAF6] h-full flex flex-col border-l border-[#E5DFD3] shadow-2xl">
        <div className="px-6 py-5 border-b border-[#E5DFD3] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#87977B]" />
            <h2 className="font-serif text-xl font-semibold text-[#394536]">
              Keranjang Belanja ({cartItems.reduce((s, i) => s + i.quantity, 0)})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Keranjang"
            className="p-2 rounded-lg text-[#817B72] hover:bg-[#F7F2E8]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
              <ShoppingBag className="w-12 h-12 text-[#817B72]/50 mb-4" />
              <p className="font-serif text-xl font-semibold text-[#394536] mb-1">
                Keranjang Anda Masih Kosong
              </p>
              <p className="text-sm text-[#817B72] mb-6">
                Jelajahi koleksi gamis, abaya, dan khimar eksklusif kami untuk memulai belanja.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium"
              >
                Lanjut Belanja
              </button>
            </div>
          ) : (
            cartItems.map((item) => {
              const productVariants = variants.filter(
                (v) => v.productId === item.productId && v.isActive && v.stock > 0
              );
              const currentVariant = variants.find((v) => v.id === item.variantId);
              const maxStock = currentVariant ? currentVariant.stock : 99;

              return (
                <div
                  key={item.id}
                  className="flex gap-3.5 p-3.5 rounded-xl bg-white border border-[#E5DFD3]"
                >
                  <img
                    src={sanitizeImageUrl(item.imageUrl)}
                    alt={item.productName}
                    className="w-20 h-24 rounded-lg object-cover bg-[#F7F2E8] shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif font-semibold text-base text-[#394536] leading-tight truncate">
                        {item.productName}
                      </h3>
                      <button
                        type="button"
                        onClick={() => void removeFromCart(item.id)}
                        aria-label="Hapus Item"
                        className="text-[#817B72] hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Inline Variant Switcher (Color & Size) */}
                    {productVariants.length > 0 && (
                      <select
                        value={item.variantId}
                        onChange={(e) => {
                          const nextV = productVariants.find((v) => v.id === e.target.value);
                          if (nextV) void updateCartItemVariant(item.id, nextV);
                        }}
                        aria-label="Ubah Ukuran dan Warna"
                        className="w-full text-xs border border-[#E5DFD3] rounded-md px-2 py-1.5 bg-[#FCFAF6] text-[#394536]"
                      >
                        {productVariants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.colorName} · Ukuran {v.size} (Stok {v.stock})
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <div className="inline-flex items-center border border-[#E5DFD3] rounded-md">
                        <button
                          type="button"
                          onClick={() => void updateCartItemQuantity(item.id, item.quantity - 1)}
                          className="p-1.5 text-[#394536] hover:bg-[#F7F2E8]"
                          aria-label="Kurangi"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center text-xs font-mono font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => void updateCartItemQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= maxStock}
                          className="p-1.5 text-[#394536] hover:bg-[#F7F2E8] disabled:opacity-40"
                          aria-label="Tambah"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-[#394536] tabular-nums">
                        {formatIDR(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="border-t border-[#E5DFD3] bg-white p-5 space-y-4">
            <form onSubmit={handleVoucherSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 text-[#817B72] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                  placeholder="Kode voucher (mis. ANGGUN10)"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5DFD3] text-xs font-mono uppercase focus:outline-none focus:border-[#87977B]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg border border-[#87977B] text-[#394536] text-xs font-medium hover:bg-[#F7F2E8]"
              >
                Terapkan
              </button>
            </form>

            <div className="space-y-1.5 text-sm tabular-nums">
              <div className="flex justify-between text-[#817B72]">
                <span>Subtotal Produk</span>
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
              {shippingCost > 0 && (
                <p className="text-[11px] text-[#817B72]">
                  Gratis ongkir untuk belanja minimal {formatIDR(paymentSettings.freeShippingThreshold)}.
                </p>
              )}
              <div className="flex justify-between font-semibold text-base text-[#394536] pt-2 border-t border-[#E5DFD3]">
                <span>Total Pembayaran</span>
                <span>{formatIDR(totalAmount)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onProceedCheckout}
              className="w-full py-3 px-5 rounded-lg bg-[#87977B] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Lanjut ke Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
