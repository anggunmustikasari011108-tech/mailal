'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatIDR, sanitizeImageUrl } from '../lib/formatters';
import { Product } from '../types';
import { ProductCard } from './ProductCard';
import { ActivePage } from './StoreHeader';

interface StorefrontViewProps {
  activePage: ActivePage;
  selectedCategoryId: string;
  searchOpen: boolean;
  onNavigate: (page: ActivePage, categoryId?: string) => void;
  onSelectProduct: (product: Product) => void;
}

type CollectionTab =
  | 'NEW_ARRIVAL'
  | 'BEST_SELLER'
  | 'FEATURED'
  | 'TOP_SELLING'
  | 'DISCOUNT'
  | 'EXCLUSIVE';

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  activePage,
  selectedCategoryId,
  searchOpen,
  onNavigate,
  onSelectProduct,
}) => {
  const {
    boutiqueSettings,
    banners,
    categories,
    products,
    variants,
    wishlistIds,
    showToast,
  } = useStore();

  const [collectionTab, setCollectionTab] = useState<CollectionTab>('NEW_ARRIVAL');

  // Catalog Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCatId, setFilterCatId] = useState<string>(selectedCategoryId || 'ALL');
  const [filterSize, setFilterSize] = useState<string>('ALL');
  const [filterColor, setFilterColor] = useState<string>('ALL');
  const [filterStock, setFilterStock] = useState<'ALL' | 'IN_STOCK'>('ALL');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'BEST_SELLER'>('NEWEST');
  const [page, setPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    setFilterCatId(selectedCategoryId || 'ALL');
    setPage(1);
  }, [selectedCategoryId, activePage]);

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);
  const activeCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);

  const heroBanner = useMemo(
    () => banners.find((b) => b.placement === 'HERO' && b.isActive) || banners[0],
    [banners]
  );
  const promoBanner = useMemo(
    () => banners.find((b) => b.placement === 'PROMO' && b.isActive),
    [banners]
  );

  // Dynamic available sizes & colors across active variants
  const availableSizes = useMemo(() => {
    const set = new Set<string>(['S', 'M', 'L', 'XL', 'XXL']);
    variants.forEach((v) => {
      if (v.isActive && v.size) set.add(v.size);
    });
    return Array.from(set);
  }, [variants]);

  const availableColors = useMemo(() => {
    const set = new Set<string>();
    variants.forEach((v) => {
      if (v.isActive && v.colorName) set.add(v.colorName);
    });
    return Array.from(set);
  }, [variants]);

  const tabbedProducts = useMemo(() => {
    switch (collectionTab) {
      case 'NEW_ARRIVAL':
        return activeProducts.filter((p) => p.isNewArrival);
      case 'BEST_SELLER':
        return activeProducts.filter((p) => p.isBestSeller);
      case 'FEATURED':
        return activeProducts.filter((p) => p.isFeatured);
      case 'TOP_SELLING':
        return [...activeProducts].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
      case 'DISCOUNT':
        return activeProducts.filter((p) => p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price);
      case 'EXCLUSIVE':
        return activeProducts.filter((p) => p.isExclusive);
      default:
        return activeProducts;
    }
  }, [activeProducts, collectionTab]);

  const filteredCatalog = useMemo(() => {
    let list = [...activeProducts];

    if (activePage === 'NEW_ARRIVALS') {
      list = list.filter((p) => p.isNewArrival);
    } else if (activePage === 'PROMO') {
      list = list.filter((p) => p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price);
    } else if (activePage === 'WISHLIST') {
      list = list.filter((p) => wishlistIds.includes(p.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    if (filterCatId !== 'ALL') {
      list = list.filter((p) => p.categoryId === filterCatId);
    }

    if (filterSize !== 'ALL') {
      const matchingProdIds = new Set(
        variants.filter((v) => v.isActive && v.size === filterSize && v.stock > 0).map((v) => v.productId)
      );
      list = list.filter((p) => matchingProdIds.has(p.id));
    }

    if (filterColor !== 'ALL') {
      const matchingProdIds = new Set(
        variants.filter((v) => v.isActive && v.colorName === filterColor && v.stock > 0).map((v) => v.productId)
      );
      list = list.filter((p) => matchingProdIds.has(p.id));
    }

    if (filterStock === 'IN_STOCK') {
      list = list.filter((p) => p.totalStock > 0);
    }

    const minVal = minPrice ? Number(minPrice) : 0;
    const maxVal = maxPrice ? Number(maxPrice) : Infinity;
    list = list.filter((p) => {
      const effectivePrice = p.discountPrice && p.discountPrice > 0 ? p.discountPrice : p.price;
      return effectivePrice >= minVal && effectivePrice <= maxVal;
    });

    if (sortBy === 'PRICE_ASC') {
      list.sort((a, b) => {
        const pa = a.discountPrice && a.discountPrice > 0 ? a.discountPrice : a.price;
        const pb = b.discountPrice && b.discountPrice > 0 ? b.discountPrice : b.price;
        return pa - pb;
      });
    } else if (sortBy === 'PRICE_DESC') {
      list.sort((a, b) => {
        const pa = a.discountPrice && a.discountPrice > 0 ? a.discountPrice : a.price;
        const pb = b.discountPrice && b.discountPrice > 0 ? b.discountPrice : b.price;
        return pb - pa;
      });
    } else if (sortBy === 'BEST_SELLER') {
      list.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
    }

    return list;
  }, [
    activeProducts,
    activePage,
    wishlistIds,
    searchQuery,
    filterCatId,
    filterSize,
    filterColor,
    filterStock,
    minPrice,
    maxPrice,
    sortBy,
    variants,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCatalog.length / ITEMS_PER_PAGE));
  const pagedCatalog = filteredCatalog.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // ─── ABOUT VIEW ──────────────────────────────────────────────────────────
  if (activePage === 'ABOUT') {
    return (
      <section className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-10 py-14 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[#C5A46D] font-semibold">
              Tentang {boutiqueSettings.brandName}
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl font-semibold text-[#394536] leading-tight">
              {boutiqueSettings.projectName}
            </h1>
            <p className="text-base text-[#817B72] leading-relaxed">
              {boutiqueSettings.brandDescription}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
              <div className="p-4 rounded-xl bg-white border border-[#E5DFD3]">
                <p className="font-serif text-lg font-semibold text-[#394536]">Material Pilihan</p>
                <p className="text-xs text-[#817B72] mt-1">
                  Italian silk crepe, linen organik, dan ceruti lembut yang sejuk dan tidak menerawang.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white border border-[#E5DFD3]">
                <p className="font-serif text-lg font-semibold text-[#394536]">Jahitan Berstandar Butik</p>
                <p className="text-xs text-[#817B72] mt-1">
                  Setiap siluet dirancang sopan, wudhu-friendly, dan nyaman dipakai sepanjang hari.
                </p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-6">
            <img
              src={sanitizeImageUrl(heroBanner?.imageUrl) || '/assets/images/hero_boutique_editorial_1795319645025.jpg'}
              alt={boutiqueSettings.brandName}
              className="w-full aspect-[4/3] object-cover rounded-2xl border border-[#E5DFD3]"
            />
          </div>
        </div>
      </section>
    );
  }

  // ─── CONTACT VIEW ────────────────────────────────────────────────────────
  if (activePage === 'CONTACT') {
    return (
      <section className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-10 py-14 space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[#C5A46D] font-semibold">Layanan Pelanggan</p>
          <h1 className="font-serif text-4xl font-semibold text-[#394536]">Hubungi Butik Kami</h1>
          <p className="text-sm text-[#817B72]">
            Tim konsultan busana {boutiqueSettings.brandName} siap membantu pemilihan ukuran, detail bahan, dan status pesanan Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#E5DFD3] rounded-2xl p-6 space-y-4">
            <h2 className="font-serif text-2xl font-semibold text-[#394536]">Alamat & Jam Operasional</h2>
            <p className="flex items-start gap-3 text-sm text-[#394536]">
              <MapPin className="w-4 h-4 text-[#87977B] shrink-0 mt-1" />
              <span>{boutiqueSettings.address}</span>
            </p>
            <p className="flex items-center gap-3 text-sm text-[#394536]">
              <Clock className="w-4 h-4 text-[#87977B] shrink-0" />
              <span>{boutiqueSettings.operatingHours}</span>
            </p>
          </div>
          <div className="bg-white border border-[#E5DFD3] rounded-2xl p-6 space-y-4">
            <h2 className="font-serif text-2xl font-semibold text-[#394536]">Kanal Resmi</h2>
            <p className="flex items-center gap-3 text-sm text-[#394536]">
              <Phone className="w-4 h-4 text-[#87977B] shrink-0" />
              <span>WhatsApp: {boutiqueSettings.whatsapp}</span>
            </p>
            <p className="flex items-center gap-3 text-sm text-[#394536]">
              <Instagram className="w-4 h-4 text-[#87977B] shrink-0" />
              <span>Instagram: {boutiqueSettings.instagram}</span>
            </p>
            <p className="flex items-center gap-3 text-sm text-[#394536]">
              <Mail className="w-4 h-4 text-[#87977B] shrink-0" />
              <span>Email: {boutiqueSettings.email}</span>
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ─── CATEGORIES DIRECTORY VIEW ───────────────────────────────────────────
  if (activePage === 'CATEGORIES') {
    return (
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-12 space-y-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[#C5A46D] font-semibold">Kurasi Busana Muslimah</p>
          <h1 className="font-serif text-4xl font-semibold text-[#394536]">Kategori Koleksi</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeCategories.map((cat) => {
            const count = activeProducts.filter((p) => p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onNavigate('CATALOG', cat.id)}
                className="group p-6 rounded-2xl bg-white border border-[#E5DFD3] hover:border-[#87977B] text-left transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  <p className="text-xs font-mono text-[#817B72]">{count} Produk</p>
                  <h2 className="font-serif text-2xl font-semibold text-[#394536] mt-1 group-hover:text-[#87977B]">
                    {cat.name}
                  </h2>
                  <p className="text-sm text-[#817B72] mt-2">{cat.description}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#394536]">
                  <span>Lihat Koleksi</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  // ─── HOMEPAGE VIEW ───────────────────────────────────────────────────────
  if (activePage === 'HOME' && !searchOpen) {
    return (
      <div>
        {/* Hero Section */}
        <section className="relative bg-[#F7F2E8] border-b border-[#E5DFD3] overflow-hidden islamic-lattice-bg">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-5 space-y-6">
              <p className="text-xs uppercase tracking-[0.22em] text-[#C5A46D] font-semibold">
                {boutiqueSettings.projectName}
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold text-[#394536] leading-[1.1]">
                {heroBanner?.headline || 'Keanggunan dalam Kesederhanaan.'}
              </h1>
              <p className="text-base text-[#817B72] leading-relaxed max-w-xl">
                {heroBanner?.subheadline ||
                  'Hadirkan keindahan berbusana dengan koleksi fashion muslimah yang memadukan kenyamanan, kualitas, dan kesantunan.'}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('CATALOG')}
                  className="px-6 py-3.5 rounded-lg bg-[#87977B] text-white text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2"
                >
                  <span>{heroBanner?.ctaPrimaryText || 'Jelajahi Koleksi'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('NEW_ARRIVALS')}
                  className="px-6 py-3.5 rounded-lg border border-[#394536] text-[#394536] text-sm font-medium hover:bg-[#394536] hover:text-white transition-colors"
                >
                  {heroBanner?.ctaSecondaryText || 'Belanja Sekarang'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="relative rounded-2xl overflow-hidden border border-[#E5DFD3] bg-white shadow-sm">
                <img
                  src={
                    sanitizeImageUrl(heroBanner?.imageUrl) ||
                    '/assets/images/hero_boutique_editorial_1795319645025.jpg'
                  }
                  alt={heroBanner?.headline || 'Koleksi Busana Muslimah'}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-[16/10] object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Categories Bar Section */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-12 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#C5A46D] font-semibold">Kategori Pilihan</p>
              <h2 className="font-serif text-3xl font-semibold text-[#394536]">Telusuri Berdasarkan Busana</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('CATEGORIES')}
              className="text-sm font-medium text-[#394536] hover:text-[#87977B] inline-flex items-center gap-1"
            >
              <span>Semua Kategori</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {activeCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onNavigate('CATALOG', cat.id)}
                className="px-4 py-3.5 rounded-xl bg-white border border-[#E5DFD3] hover:border-[#87977B] hover:bg-[#F7F2E8]/60 text-left transition-colors"
              >
                <p className="font-serif text-base font-semibold text-[#394536] truncate">{cat.name}</p>
                <p className="text-[11px] text-[#817B72] mt-0.5 tabular-nums">
                  {activeProducts.filter((p) => p.categoryId === cat.id).length} item
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Product Collections Tabs */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pb-16 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5DFD3] pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#C5A46D] font-semibold">Koleksi Butik</p>
              <h2 className="font-serif text-3xl font-semibold text-[#394536]">Pilihan Eksklusif Muslimah</h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F7F2E8] rounded-xl">
              {[
                { id: 'NEW_ARRIVAL', label: 'New Arrival' },
                { id: 'BEST_SELLER', label: 'Best Seller' },
                { id: 'FEATURED', label: 'Featured Collection' },
                { id: 'TOP_SELLING', label: 'Produk Terlaris' },
                { id: 'DISCOUNT', label: 'Produk Diskon' },
                { id: 'EXCLUSIVE', label: 'Koleksi Eksklusif' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCollectionTab(t.id as CollectionTab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    collectionTab === t.id
                      ? 'bg-white text-[#394536] shadow-xs'
                      : 'text-[#817B72] hover:text-[#394536]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {tabbedProducts.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} onSelect={onSelectProduct} />
            ))}
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => onNavigate('CATALOG')}
              className="px-7 py-3 rounded-lg border border-[#87977B] text-[#394536] text-sm font-medium hover:bg-[#87977B] hover:text-white transition-colors"
            >
              Lihat Seluruh Katalog ({activeProducts.length} Produk)
            </button>
          </div>
        </section>

        {/* Promo Banner */}
        {promoBanner && (
          <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pb-16">
            <div className="rounded-2xl bg-[#F7F2E8] border border-[#E5DFD3] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-center">
              <div className="lg:col-span-7 p-8 sm:p-12 space-y-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#C5A46D] font-semibold">
                  {promoBanner.title}
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#394536]">
                  {promoBanner.headline}
                </h2>
                <p className="text-sm sm:text-base text-[#817B72] max-w-xl">{promoBanner.subheadline}</p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('PROMO')}
                    className="px-5 py-2.5 rounded-lg bg-[#394536] text-white text-sm font-medium"
                  >
                    {promoBanner.ctaPrimaryText || 'Lihat Promo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText('ANGGUN10');
                      showToast('success', 'Kode voucher ANGGUN10 disalin ke clipboard.');
                    }}
                    className="px-5 py-2.5 rounded-lg border border-[#394536] text-[#394536] text-sm font-medium"
                  >
                    {promoBanner.ctaSecondaryText || 'Salin Kode ANGGUN10'}
                  </button>
                </div>
              </div>
              <div className="lg:col-span-5 h-64 lg:h-full">
                <img
                  src={sanitizeImageUrl(promoBanner.imageUrl)}
                  alt={promoBanner.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </section>
        )}
      </div>
    );
  }

  // ─── FULL CATALOG / SEARCH / FILTER / PAGINATION VIEW ────────────────────
  const pageTitle =
    activePage === 'NEW_ARRIVALS'
      ? 'Koleksi Terbaru'
      : activePage === 'PROMO'
      ? 'Promo & Produk Diskon'
      : activePage === 'WISHLIST'
      ? 'Wishlist Anda'
      : 'Katalog Busana Muslimah';

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E5DFD3] pb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C5A46D] font-semibold">
            {boutiqueSettings.brandName}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#394536]">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-[#817B72] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama produk, SKU, bahan..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#E5DFD3] bg-white text-sm focus:outline-none focus:border-[#87977B]"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="Urutkan Produk"
            className="px-3 py-2.5 rounded-lg border border-[#E5DFD3] bg-white text-sm text-[#394536]"
          >
            <option value="NEWEST">Produk Terbaru</option>
            <option value="PRICE_ASC">Harga Termurah</option>
            <option value="PRICE_DESC">Harga Tertinggi</option>
            <option value="BEST_SELLER">Produk Terlaris</option>
          </select>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white border border-[#E5DFD3] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div>
          <label className="block text-[11px] font-medium text-[#817B72] mb-1">Kategori</label>
          <select
            value={filterCatId}
            onChange={(e) => {
              setFilterCatId(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-[#E5DFD3] px-2.5 py-2 text-xs bg-[#FCFAF6]"
          >
            <option value="ALL">Semua Kategori</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#817B72] mb-1">Ukuran</label>
          <select
            value={filterSize}
            onChange={(e) => {
              setFilterSize(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-[#E5DFD3] px-2.5 py-2 text-xs bg-[#FCFAF6]"
          >
            <option value="ALL">Semua Ukuran</option>
            {availableSizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#817B72] mb-1">Warna</label>
          <select
            value={filterColor}
            onChange={(e) => {
              setFilterColor(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-[#E5DFD3] px-2.5 py-2 text-xs bg-[#FCFAF6]"
          >
            <option value="ALL">Semua Warna</option>
            {availableColors.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#817B72] mb-1">Harga Min (Rp)</label>
          <input
            type="number"
            min={0}
            value={minPrice}
            onChange={(e) => {
              setMinPrice(e.target.value);
              setPage(1);
            }}
            placeholder="0"
            className="w-full rounded-lg border border-[#E5DFD3] px-2.5 py-2 text-xs bg-[#FCFAF6]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#817B72] mb-1">Harga Maks (Rp)</label>
          <input
            type="number"
            min={0}
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(e.target.value);
              setPage(1);
            }}
            placeholder="1000000"
            className="w-full rounded-lg border border-[#E5DFD3] px-2.5 py-2 text-xs bg-[#FCFAF6]"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterStock}
            onChange={(e) => {
              setFilterStock(e.target.value as 'ALL' | 'IN_STOCK');
              setPage(1);
            }}
            aria-label="Filter Stok"
            className="flex-1 rounded-lg border border-[#E5DFD3] px-2.5 py-2 text-xs bg-[#FCFAF6]"
          >
            <option value="ALL">Semua Stok</option>
            <option value="IN_STOCK">Tersedia</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterCatId('ALL');
              setFilterSize('ALL');
              setFilterColor('ALL');
              setFilterStock('ALL');
              setMinPrice('');
              setMaxPrice('');
              setPage(1);
            }}
            title="Reset Filter"
            className="px-3 py-2 rounded-lg border border-[#E5DFD3] text-xs text-[#817B72] hover:bg-[#F7F2E8]"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-[#817B72]">
        <span className="inline-flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" />
          Menampilkan {pagedCatalog.length} dari {filteredCatalog.length} produk
        </span>
        {(minPrice || maxPrice) && (
          <span className="tabular-nums">
            Rentang harga: {minPrice ? formatIDR(Number(minPrice)) : 'Rp 0'} –{' '}
            {maxPrice ? formatIDR(Number(maxPrice)) : 'Maks'}
          </span>
        )}
      </div>

      {/* Grid */}
      {pagedCatalog.length === 0 ? (
        <div className="bg-white border border-[#E5DFD3] rounded-2xl p-12 text-center space-y-3">
          <p className="font-serif text-2xl font-semibold text-[#394536]">Produk Tidak Ditemukan</p>
          <p className="text-sm text-[#817B72]">
            Coba ubah kata kunci pencarian atau atur ulang filter kategori, ukuran, maupun warna.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {pagedCatalog.map((product) => (
            <ProductCard key={product.id} product={product} onSelect={onSelectProduct} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-2 rounded-lg border border-[#E5DFD3] bg-white disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPage(idx + 1)}
              className={`w-9 h-9 rounded-lg text-xs font-mono font-semibold ${
                page === idx + 1
                  ? 'bg-[#394536] text-white'
                  : 'bg-white border border-[#E5DFD3] text-[#394536]'
              }`}
            >
              {idx + 1}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="p-2 rounded-lg border border-[#E5DFD3] bg-white disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
};
