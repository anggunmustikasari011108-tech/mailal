'use client';

import React, { useState } from 'react';
import {
  Heart,
  LayoutDashboard,
  Menu,
  Search,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { sanitizeImageUrl } from '../lib/formatters';

export type ActivePage =
  | 'HOME'
  | 'CATALOG'
  | 'NEW_ARRIVALS'
  | 'CATEGORIES'
  | 'PROMO'
  | 'ABOUT'
  | 'CONTACT'
  | 'WISHLIST'
  | 'ACCOUNT'
  | 'ADMIN';

interface StoreHeaderProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage, categoryId?: string) => void;
  onOpenSearch: () => void;
  onOpenCart: () => void;
  onOpenAuth: () => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({
  activePage,
  onNavigate,
  onOpenSearch,
  onOpenCart,
  onOpenAuth,
}) => {
  const { boutiqueSettings, cartItems, wishlistIds, firebaseUser, userProfile, isStaff } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const logoSrc = sanitizeImageUrl(boutiqueSettings.logoUrl) || '/assets/aistudio/Logo_Boutique_Hijab_Mailal_Elegan_47622cbc.png';

  const navItems: Array<{ label: string; page: ActivePage }> = [
    { label: 'Beranda', page: 'HOME' },
    { label: 'Semua Produk', page: 'CATALOG' },
    { label: 'Koleksi Terbaru', page: 'NEW_ARRIVALS' },
    { label: 'Kategori', page: 'CATEGORIES' },
    { label: 'Promo', page: 'PROMO' },
    { label: 'Tentang Kami', page: 'ABOUT' },
    { label: 'Kontak', page: 'CONTACT' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#FCFAF6]/95 backdrop-blur-md border-b border-[#E5DFD3] no-print">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <button
          type="button"
          onClick={() => onNavigate('HOME')}
          className="flex items-center gap-3 shrink-0 text-left focus-visible:outline-2 focus-visible:outline-[#87977B]"
        >
          <img
            src={logoSrc}
            alt={boutiqueSettings.brandName}
            referrerPolicy="no-referrer"
            className="h-10 w-10 sm:h-11 sm:w-11 object-contain rounded-full border border-[#E5DFD3] bg-[#F7F2E8]"
          />
          <span className="font-serif text-xl sm:text-2xl font-semibold tracking-wide text-[#394536] whitespace-nowrap">
            {boutiqueSettings.brandName}
          </span>
        </button>

        {/* Desktop Nav Links */}
        <nav className="hidden xl:flex items-center gap-6" aria-label="Navigasi Utama">
          {navItems.map((item) => {
            const isActive = activePage === item.page;
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => onNavigate(item.page)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
                  isActive
                    ? 'text-[#394536] border-[#C5A46D]'
                    : 'text-[#817B72] border-transparent hover:text-[#394536]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Cari Produk"
            className="p-2.5 rounded-lg text-[#394536] hover:bg-[#F7F2E8] transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('WISHLIST')}
            aria-label="Wishlist"
            className="relative p-2.5 rounded-lg text-[#394536] hover:bg-[#F7F2E8] transition-colors"
          >
            <Heart className="w-5 h-5" />
            {wishlistIds.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#C5A46D] text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                {wishlistIds.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label="Keranjang Belanja"
            className="relative p-2.5 rounded-lg text-[#394536] hover:bg-[#F7F2E8] transition-colors"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalCartCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#87977B] text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                {totalCartCount}
              </span>
            )}
          </button>

          {isStaff && (
            <button
              type="button"
              onClick={() => onNavigate('ADMIN')}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#394536] text-[#FCFAF6] text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard Admin</span>
            </button>
          )}

          {firebaseUser ? (
            <button
              type="button"
              onClick={() => onNavigate('ACCOUNT')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5DFD3] bg-[#F7F2E8] text-[#394536] text-xs sm:text-sm font-medium hover:border-[#C5A46D] transition-colors whitespace-nowrap shrink-0"
            >
              <User className="w-4 h-4 text-[#87977B]" />
              <span className="max-w-[90px] truncate">{userProfile?.displayName || 'Akun'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#87977B] text-white text-xs sm:text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <User className="w-4 h-4" />
              <span>Masuk</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Menu Navigasi"
            className="xl:hidden p-2.5 rounded-lg text-[#394536] hover:bg-[#F7F2E8]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Menu Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-[#E5DFD3] bg-[#FCFAF6] px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.page}
              type="button"
              onClick={() => {
                onNavigate(item.page);
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                activePage === item.page
                  ? 'bg-[#F7F2E8] text-[#394536]'
                  : 'text-[#817B72] hover:bg-[#F7F2E8]/60 hover:text-[#394536]'
              }`}
            >
              {item.label}
            </button>
          ))}
          {isStaff && (
            <button
              type="button"
              onClick={() => {
                onNavigate('ADMIN');
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium bg-[#394536] text-white mt-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Buka Dashboard Administrator</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
