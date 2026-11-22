'use client';

import React, { useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { AccountPortal } from './AccountPortal';
import { AdminDashboard } from './admin/AdminDashboard';
import { AuthModal } from './AuthModal';
import { CartDrawer } from './CartDrawer';
import { CheckoutModal } from './CheckoutModal';
import { ProductDetailModal } from './ProductDetailModal';
import { StoreFooter } from './StoreFooter';
import { ActivePage, StoreHeader } from './StoreHeader';
import { StorefrontView } from './StorefrontView';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';

interface BoutiqueAppShellProps {
  initialPage?: ActivePage;
}

export const BoutiqueAppShell: React.FC<BoutiqueAppShellProps> = ({ initialPage = 'HOME' }) => {
  const { toastMessage, clearToast } = useStore();
  const [activePage, setActivePage] = useState<ActivePage>(initialPage);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [searchMode, setSearchMode] = useState<boolean>(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [checkoutOpen, setCheckoutOpen] = useState<boolean>(false);
  const [authOpen, setAuthOpen] = useState<boolean>(false);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');

  const handleNavigate = (page: ActivePage, categoryId?: string) => {
    setActivePage(page);
    setSelectedCategoryId(categoryId || '');
    setSearchMode(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAF6] text-[#394536]">
      {activePage === 'ADMIN' ? (
        <AdminDashboard onExitAdmin={() => handleNavigate('HOME')} />
      ) : (
        <>
          <StoreHeader
            activePage={activePage}
            onNavigate={handleNavigate}
            onOpenSearch={() => {
              setActivePage('CATALOG');
              setSelectedCategoryId('');
              setSearchMode(true);
            }}
            onOpenCart={() => setCartOpen(true)}
            onOpenAuth={() => setAuthOpen(true)}
          />

          <main className="flex-1">
            {activePage === 'ACCOUNT' ? (
              <AccountPortal
                onSelectProduct={(p) => setSelectedProduct(p)}
                onOpenAdmin={() => handleNavigate('ADMIN')}
              />
            ) : (
              <StorefrontView
                activePage={activePage}
                selectedCategoryId={selectedCategoryId}
                searchOpen={searchMode}
                onNavigate={handleNavigate}
                onSelectProduct={(p) => setSelectedProduct(p)}
              />
            )}
          </main>

          <StoreFooter />
        </>
      )}

      {/* Modals & Drawers */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onSelectProduct={(p) => setSelectedProduct(p)}
        onOpenCart={() => setCartOpen(true)}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        appliedCouponCode={appliedCouponCode}
        onApplyCoupon={(code) => setAppliedCouponCode(code)}
        onProceedCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        appliedCouponCode={appliedCouponCode}
        onOpenAuth={() => setAuthOpen(true)}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl border shadow-lg flex items-center gap-3 text-xs sm:text-sm ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : toastMessage.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-white border-[#E5DFD3] text-[#394536]'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
          ) : toastMessage.type === 'error' ? (
            <XCircle className="w-4 h-4 shrink-0 text-red-700" />
          ) : (
            <Info className="w-4 h-4 shrink-0 text-[#87977B]" />
          )}
          <span className="flex-1">{toastMessage.text}</span>
          <button type="button" onClick={clearToast} aria-label="Tutup notifikasi">
            <X className="w-4 h-4 opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}
    </div>
  );
};
