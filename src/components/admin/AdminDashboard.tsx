'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  CreditCard,
  FileSpreadsheet,
  FolderTree,
  Globe,
  LayoutDashboard,
  Layers,
  Menu,
  Package,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tag,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ROLE_LABELS } from '../../lib/formatters';
import { AdminCatalogSection } from './AdminCatalogSection';
import { AdminOperationsSection } from './AdminOperationsSection';
import { AdminOverview } from './AdminOverview';
import { AdminReportsAndSettings } from './AdminReportsAndSettings';

export type AdminTab =
  | 'DASHBOARD'
  | 'PRODUCTS'
  | 'CATEGORIES'
  | 'VARIANTS'
  | 'STOCK'
  | 'ORDERS'
  | 'PAYMENTS'
  | 'CUSTOMERS'
  | 'COUPONS'
  | 'SHIPPING'
  | 'REPORTS'
  | 'WEBSITE_SETTINGS'
  | 'BOUTIQUE_SETTINGS'
  | 'USERS';

interface AdminDashboardProps {
  onExitAdmin: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExitAdmin }) => {
  const { boutiqueSettings, userProfile, isStaff } = useStore();
  const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FCFAF6] p-6">
        <div className="bg-white border border-[#E5DFD3] rounded-2xl p-8 max-w-md text-center space-y-4">
          <h2 className="font-serif text-2xl font-semibold text-[#394536]">Akses Terbatas</h2>
          <p className="text-sm text-[#817B72]">
            Halaman ini hanya dapat diakses oleh Administrator atau Staf Boutique yang berwenang.
          </p>
          <button
            type="button"
            onClick={onExitAdmin}
            className="px-5 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium"
          >
            Kembali ke Toko Online
          </button>
        </div>
      </div>
    );
  }

  const sidebarItems: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'PRODUCTS', label: 'Manajemen Produk', icon: Package },
    { id: 'CATEGORIES', label: 'Kategori', icon: FolderTree },
    { id: 'VARIANTS', label: 'Varian Produk', icon: Layers },
    { id: 'STOCK', label: 'Manajemen Stok', icon: Boxes },
    { id: 'ORDERS', label: 'Pesanan', icon: ShoppingCart },
    { id: 'PAYMENTS', label: 'Pembayaran', icon: CreditCard },
    { id: 'CUSTOMERS', label: 'Pelanggan', icon: Users },
    { id: 'COUPONS', label: 'Voucher dan Promo', icon: Tag },
    { id: 'SHIPPING', label: 'Pengiriman', icon: Truck },
    { id: 'REPORTS', label: 'Laporan', icon: BarChart3 },
    { id: 'WEBSITE_SETTINGS', label: 'Pengaturan Website', icon: Globe },
    { id: 'BOUTIQUE_SETTINGS', label: 'Pengaturan Boutique', icon: Store },
    { id: 'USERS', label: 'Manajemen Pengguna', icon: ShieldCheck },
  ];

  const renderBody = () => {
    switch (activeTab) {
      case 'DASHBOARD':
        return <AdminOverview />;
      case 'PRODUCTS':
      case 'CATEGORIES':
      case 'VARIANTS':
      case 'STOCK':
        return <AdminCatalogSection section={activeTab} />;
      case 'ORDERS':
      case 'PAYMENTS':
      case 'CUSTOMERS':
      case 'COUPONS':
      case 'SHIPPING':
        return <AdminOperationsSection section={activeTab} />;
      case 'REPORTS':
      case 'WEBSITE_SETTINGS':
      case 'BOUTIQUE_SETTINGS':
      case 'USERS':
        return <AdminReportsAndSettings section={activeTab} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FCFAF6] text-[#394536]">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:w-64 xl:w-72 flex-col bg-white border-r border-[#E5DFD3] shrink-0 no-print">
        <div className="p-5 border-b border-[#E5DFD3] space-y-1">
          <p className="font-serif text-xl font-semibold text-[#394536]">{boutiqueSettings.brandName}</p>
          <p className="text-[11px] text-[#817B72]">{ROLE_LABELS[userProfile?.role || 'ADMIN']}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  active
                    ? 'bg-[#394536] text-white'
                    : 'text-[#394536] hover:bg-[#F7F2E8]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-[#E5DFD3]">
          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#E5DFD3] text-xs font-medium hover:bg-[#F7F2E8]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Lihat Toko Online</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex bg-black/40">
          <aside className="w-72 bg-white h-full flex flex-col border-r border-[#E5DFD3]">
            <div className="p-4 border-b border-[#E5DFD3] flex items-center justify-between">
              <span className="font-serif text-lg font-semibold">{boutiqueSettings.brandName} Admin</span>
              <button type="button" onClick={() => setSidebarOpen(false)} className="p-1.5">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-left ${
                      active ? 'bg-[#394536] text-white' : 'text-[#394536] hover:bg-[#F7F2E8]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-[#E5DFD3]">
              <button
                type="button"
                onClick={onExitAdmin}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#E5DFD3] text-xs font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Lihat Toko Online</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-[#E5DFD3] px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-[#E5DFD3]"
              aria-label="Buka Menu Admin"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs text-[#817B72] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#87977B]" />
              <span>Admin Panel · {sidebarItems.find((i) => i.id === activeTab)?.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[#394536] hidden sm:inline">
              {userProfile?.displayName || userProfile?.email}
            </span>
            <button
              type="button"
              onClick={onExitAdmin}
              className="lg:hidden px-3 py-1.5 rounded-lg border border-[#E5DFD3] text-xs font-medium"
            >
              Toko
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {renderBody()}
        </main>
      </div>
    </div>
  );
};
