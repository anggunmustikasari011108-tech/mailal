'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Heart, Minus, Plus, ShoppingBag, Star, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatIDR, formatJakartaDate, sanitizeImageUrl } from '../lib/formatters';
import { Product } from '../types';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onSelectProduct: (p: Product) => void;
  onOpenCart: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onSelectProduct,
  onOpenCart,
}) => {
  const {
    variants,
    productImages,
    products,
    reviews,
    wishlistIds,
    firebaseUser,
    addToCart,
    toggleWishlist,
    submitReview,
    showToast,
  } = useStore();

  const productVariants = useMemo(
    () => (product ? variants.filter((v) => v.productId === product.id && v.isActive) : []),
    [product, variants]
  );

  const uniqueColors = useMemo(() => {
    const map = new Map<string, { colorName: string; colorHex: string }>();
    for (const v of productVariants) {
      if (!map.has(v.colorName)) {
        map.set(v.colorName, { colorName: v.colorName, colorHex: v.colorHex });
      }
    }
    return Array.from(map.values());
  }, [productVariants]);

  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'desc' | 'care' | 'size'>('desc');
  const [activeImage, setActiveImage] = useState<string>('');
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!product) return;
    setActiveImage(sanitizeImageUrl(product.thumbnailUrl));
    const firstInStock = productVariants.find((v) => v.stock > 0) || productVariants[0];
    if (firstInStock) {
      setSelectedColor(firstInStock.colorName);
      setSelectedSize(firstInStock.size);
    } else {
      setSelectedColor('');
      setSelectedSize('');
    }
    setQuantity(1);
    setActiveTab('desc');
  }, [product, productVariants]);

  const sizesForColor = useMemo(() => {
    return productVariants.filter((v) => v.colorName === selectedColor);
  }, [productVariants, selectedColor]);

  const activeVariant = useMemo(() => {
    return (
      productVariants.find((v) => v.colorName === selectedColor && v.size === selectedSize) ||
      sizesForColor[0] ||
      null
    );
  }, [productVariants, selectedColor, selectedSize, sizesForColor]);

  const galleryImages = useMemo(() => {
    if (!product) return [];
    const extra = productImages
      .filter((img) => img.productId === product.id)
      .map((img) => sanitizeImageUrl(img.url))
      .filter(Boolean);
    const thumb = sanitizeImageUrl(product.thumbnailUrl);
    return Array.from(new Set([thumb, ...extra].filter(Boolean)));
  }, [product, productImages]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return products
      .filter((p) => p.id !== product.id && p.isActive && p.categoryId === product.categoryId)
      .slice(0, 3);
  }, [product, products]);

  const productReviews = useMemo(() => {
    if (!product) return [];
    return reviews.filter((r) => r.productId === product.id && r.isApproved);
  }, [product, reviews]);

  if (!product) return null;

  const isWishlisted = wishlistIds.includes(product.id);
  const hasDiscount = Boolean(product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price);
  const basePrice = hasDiscount ? Number(product.discountPrice) : product.price;
  const finalPrice = Math.max(0, basePrice + (activeVariant?.priceAdjustment || 0));
  const variantStock = activeVariant ? activeVariant.stock : 0;

  const handleAddToCart = async () => {
    if (!activeVariant) {
      showToast('error', 'Silakan pilih warna dan ukuran terlebih dahulu.');
      return;
    }
    if (variantStock < quantity) {
      showToast('error', `Stok varian ini hanya tersedia ${variantStock} pcs.`);
      return;
    }
    await addToCart(product, activeVariant, quantity);
    onClose();
    onOpenCart();
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      await submitReview(product.id, reviewRating, reviewComment);
      setReviewComment('');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengirim ulasan.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#394536]/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
      <div className="relative bg-[#FCFAF6] border border-[#E5DFD3] rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup Detail Produk"
          className="sticky top-4 float-right mr-4 mt-4 z-10 w-10 h-10 rounded-full bg-white border border-[#E5DFD3] flex items-center justify-center text-[#394536] hover:bg-[#F7F2E8]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-5 sm:p-8">
          {/* Left: Gallery */}
          <div className="lg:col-span-6 space-y-4">
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[#F7F2E8] border border-[#E5DFD3]">
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#817B72]">
                  {product.name}
                </div>
              )}
            </div>
            {galleryImages.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {galleryImages.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`w-16 h-20 rounded-lg overflow-hidden border-2 shrink-0 ${
                      activeImage === img ? 'border-[#87977B]' : 'border-[#E5DFD3]'
                    }`}
                  >
                    <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <p className="text-xs font-mono text-[#817B72] mb-1">
                {product.categoryName} · SKU: {activeVariant?.sku || product.sku}
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#394536] leading-tight">
                {product.name}
              </h2>
              <div className="mt-3 flex items-baseline gap-3 tabular-nums">
                <span className="text-2xl font-semibold text-[#394536]">{formatIDR(finalPrice)}</span>
                {hasDiscount && (
                  <span className="text-base text-[#817B72] line-through">{formatIDR(product.price)}</span>
                )}
              </div>
            </div>

            {/* Dynamic Color Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[#394536]">Warna</span>
                <span className="text-[#817B72]">{selectedColor || '-'}</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {uniqueColors.map((c) => {
                  const isSelected = c.colorName === selectedColor;
                  return (
                    <button
                      key={c.colorName}
                      type="button"
                      onClick={() => {
                        setSelectedColor(c.colorName);
                        const firstSize = productVariants.find(
                          (v) => v.colorName === c.colorName && v.stock > 0
                        ) || productVariants.find((v) => v.colorName === c.colorName);
                        if (firstSize) setSelectedSize(firstSize.size);
                        setQuantity(1);
                      }}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-[#394536] bg-[#F7F2E8] text-[#394536]'
                          : 'border-[#E5DFD3] bg-white text-[#817B72] hover:border-[#87977B]'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/15 shrink-0"
                        style={{ backgroundColor: c.colorHex }}
                      />
                      <span>{c.colorName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Size Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[#394536]">Ukuran</span>
                <span className="text-xs font-mono text-[#817B72] tabular-nums">
                  Stok varian: {variantStock} pcs
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizesForColor.map((v) => {
                  const isSelected = v.size === activeVariant?.size;
                  const out = v.stock <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={out}
                      onClick={() => {
                        setSelectedSize(v.size);
                        setQuantity(1);
                      }}
                      className={`min-w-[48px] px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        out
                          ? 'border-[#E5DFD3] bg-[#F7F2E8]/60 text-[#817B72]/50 line-through cursor-not-allowed'
                          : isSelected
                          ? 'border-[#394536] bg-[#394536] text-white'
                          : 'border-[#E5DFD3] bg-white text-[#394536] hover:border-[#87977B]'
                      }`}
                    >
                      {v.size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity & CTA */}
            <div className="flex items-center gap-3 pt-2">
              <div className="inline-flex items-center border border-[#E5DFD3] rounded-lg bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-3 text-[#394536] hover:bg-[#F7F2E8]"
                  aria-label="Kurangi jumlah"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center text-sm font-mono font-semibold tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(Math.max(1, variantStock), q + 1))}
                  className="p-3 text-[#394536] hover:bg-[#F7F2E8]"
                  aria-label="Tambah jumlah"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={variantStock <= 0}
                onClick={() => void handleAddToCart()}
                className="flex-1 py-3 px-5 rounded-lg bg-[#87977B] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity inline-flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{variantStock > 0 ? 'Tambah ke Keranjang' : 'Stok Habis'}</span>
              </button>

              <button
                type="button"
                onClick={() => void toggleWishlist(product.id)}
                aria-label="Simpan ke Wishlist"
                className={`p-3 rounded-lg border transition-colors ${
                  isWishlisted
                    ? 'border-[#394536] bg-[#394536] text-white'
                    : 'border-[#E5DFD3] bg-white text-[#394536] hover:bg-[#F7F2E8]'
                }`}
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Product Details Tabs */}
            <div className="border-t border-[#E5DFD3] pt-5 space-y-4">
              <div className="flex items-center gap-1 p-1 bg-[#F7F2E8] rounded-lg w-fit">
                {[
                  { id: 'desc', label: 'Deskripsi' },
                  { id: 'care', label: 'Bahan & Perawatan' },
                  { id: 'size', label: 'Panduan Ukuran' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as 'desc' | 'care' | 'size')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      activeTab === tab.id
                        ? 'bg-white text-[#394536] shadow-sm'
                        : 'text-[#817B72] hover:text-[#394536]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'desc' && (
                <p className="text-sm text-[#394536] leading-relaxed">{product.description}</p>
              )}
              {activeTab === 'care' && (
                <div className="space-y-2 text-sm text-[#394536]">
                  <p>
                    <strong className="font-semibold">Material:</strong> {product.material || 'Bahan Muslimah Pilihan'}
                  </p>
                  <p>
                    <strong className="font-semibold">Perawatan:</strong>{' '}
                    {product.careInfo || 'Cuci lembut dengan tangan dan jemur di tempat teduh.'}
                  </p>
                </div>
              )}
              {activeTab === 'size' && (
                <p className="text-sm text-[#394536] leading-relaxed whitespace-pre-line">
                  {product.sizeGuide || 'S (LD 96), M (LD 102), L (LD 108), XL (LD 114), XXL (LD 120).'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Reviews & Related Products */}
        <div className="border-t border-[#E5DFD3] p-5 sm:p-8 space-y-8 bg-white/60">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-serif text-xl font-semibold text-[#394536]">
                Ulasan Pelanggan ({productReviews.length})
              </h3>
              {productReviews.length === 0 ? (
                <p className="text-sm text-[#817B72]">Belum ada ulasan untuk produk ini.</p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {productReviews.map((rev) => (
                    <div key={rev.id} className="p-3.5 rounded-lg border border-[#E5DFD3] bg-white">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-[#394536]">{rev.userName}</span>
                        <span className="text-[#817B72]">{formatJakartaDate(rev.createdAt, false)}</span>
                      </div>
                      <div className="flex items-center gap-0.5 text-[#C5A46D] mb-1.5">
                        {Array.from({ length: rev.rating }).map((_, idx) => (
                          <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>
                      <p className="text-sm text-[#394536]">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-3 bg-white p-5 rounded-xl border border-[#E5DFD3]">
              <h4 className="font-serif text-lg font-semibold text-[#394536]">Tulis Ulasan</h4>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setReviewRating(num)}
                    className={`p-1 ${num <= reviewRating ? 'text-[#C5A46D]' : 'text-[#E5DFD3]'}`}
                  >
                    <Star className="w-5 h-5 fill-current" />
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={firebaseUser ? 'Bagikan pengalaman Anda mengenai kualitas bahan dan potongan...' : 'Silakan masuk terlebih dahulu untuk menulis ulasan.'}
                disabled={!firebaseUser}
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm focus:outline-none focus:border-[#87977B]"
              />
              <button
                type="submit"
                disabled={!firebaseUser || submittingReview || !reviewComment.trim()}
                className="px-4 py-2 rounded-lg bg-[#394536] text-white text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{submittingReview ? 'Mengirim...' : 'Kirim Ulasan'}</span>
              </button>
            </form>
          </div>

          {relatedProducts.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-[#E5DFD3]">
              <h3 className="font-serif text-xl font-semibold text-[#394536]">Produk Terkait</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {relatedProducts.map((rp) => (
                  <button
                    key={rp.id}
                    type="button"
                    onClick={() => onSelectProduct(rp)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#E5DFD3] bg-white hover:border-[#87977B] text-left transition-colors"
                  >
                    <img
                      src={sanitizeImageUrl(rp.thumbnailUrl)}
                      alt={rp.name}
                      className="w-16 h-20 rounded-lg object-cover bg-[#F7F2E8] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-[#817B72]">{rp.categoryName}</p>
                      <p className="font-serif font-semibold text-sm text-[#394536] truncate">{rp.name}</p>
                      <p className="text-xs font-semibold text-[#87977B] tabular-nums mt-1">
                        {formatIDR(rp.discountPrice && rp.discountPrice > 0 ? rp.discountPrice : rp.price)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
