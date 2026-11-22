'use client';

import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '../../context/StoreContext';
import { formatIDR, toJakartaDateKey } from '../../lib/formatters';

export const AdminOverview: React.FC = () => {
  const { orders, orderItems, products, variants, allCustomers } = useStore();
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.orderStatus === 'DIBATALKAN') return false;
      const key = toJakartaDateKey(o.createdAt);
      if (dateFrom && key && key < dateFrom) return false;
      if (dateTo && key && key > dateTo) return false;
      return true;
    });
  }, [orders, dateFrom, dateTo]);

  const paidOrders = useMemo(
    () =>
      filteredOrders.filter(
        (o) => o.paymentStatus === 'BERHASIL' || o.paymentStatus === 'LUNAS' || o.orderStatus === 'SELESAI'
      ),
    [filteredOrders]
  );

  const totalRevenue = useMemo(
    () => paidOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    [paidOrders]
  );

  const totalItemsSold = useMemo(() => {
    const validIds = new Set(filteredOrders.map((o) => o.id));
    return orderItems
      .filter((oi) => validIds.has(oi.orderId))
      .reduce((sum, oi) => sum + oi.quantity, 0);
  }, [filteredOrders, orderItems]);

  const newOrdersCount = useMemo(
    () =>
      orders.filter(
        (o) => o.orderStatus === 'MENUNGGU_PEMBAYARAN' || o.orderStatus === 'MENUNGGU_VERIFIKASI' || o.orderStatus === 'SEDANG_DIPROSES'
      ).length,
    [orders]
  );

  const unpaidOrdersCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.orderStatus !== 'DIBATALKAN' &&
          (o.paymentStatus === 'BELUM_DIBAYAR' || o.paymentStatus === 'MENUNGGU_VERIFIKASI')
      ).length,
    [orders]
  );

  const activeProductsCount = useMemo(() => products.filter((p) => p.isActive).length, [products]);
  const lowStockVariants = useMemo(
    () => variants.filter((v) => v.isActive && v.stock <= v.minStock),
    [variants]
  );

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    const validIds = new Set(filteredOrders.map((o) => o.id));
    orderItems
      .filter((oi) => validIds.has(oi.orderId))
      .forEach((oi) => {
        const curr = map.get(oi.productId) || { name: oi.productName, qty: 0, revenue: 0 };
        curr.qty += oi.quantity;
        curr.revenue += oi.subtotal;
        map.set(oi.productId, curr);
      });
    if (map.size === 0) {
      return [...products]
        .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
        .slice(0, 5)
        .map((p) => ({ name: p.name.slice(0, 22), qty: p.soldCount || 0, revenue: 0 }));
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map((x) => ({ ...x, name: x.name.slice(0, 22) }));
  }, [filteredOrders, orderItems, products]);

  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    const prodCatMap = new Map(products.map((p) => [p.id, p.categoryName]));
    const validIds = new Set(filteredOrders.map((o) => o.id));
    orderItems
      .filter((oi) => validIds.has(oi.orderId))
      .forEach((oi) => {
        const cat = prodCatMap.get(oi.productId) || 'Lainnya';
        map.set(cat, (map.get(cat) || 0) + oi.quantity);
      });
    if (map.size === 0) {
      products.forEach((p) => {
        map.set(p.categoryName, (map.get(p.categoryName) || 0) + (p.soldCount || 0));
      });
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredOrders, orderItems, products]);

  const salesSeries = useMemo(() => {
    const map = new Map<string, { label: string; pendapatan: number; pesanan: number }>();
    filteredOrders.forEach((o) => {
      const key = toJakartaDateKey(o.createdAt) || new Date().toISOString().slice(0, 10);
      let bucket = key;
      if (period === 'MONTHLY') bucket = key.slice(0, 7);
      else if (period === 'YEARLY') bucket = key.slice(0, 4);
      else if (period === 'WEEKLY') {
        const d = new Date(key);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        bucket = `Mg ${weekStart.toISOString().slice(5, 10)}`;
      }
      const curr = map.get(bucket) || { label: bucket, pendapatan: 0, pesanan: 0 };
      curr.pendapatan += o.totalAmount;
      curr.pesanan += 1;
      map.set(bucket, curr);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredOrders, period]);

  const PIE_COLORS = ['#87977B', '#C5A46D', '#394536', '#B3A48B', '#817B72'];

  const kpiCards = [
    { label: 'Total Pendapatan (Terbayar)', value: formatIDR(totalRevenue) },
    { label: 'Total Penjualan (Unit)', value: `${totalItemsSold} pcs` },
    { label: 'Jumlah Pesanan', value: String(filteredOrders.length) },
    { label: 'Pesanan Baru / Aktif', value: String(newOrdersCount) },
    { label: 'Pesanan Belum Dibayar', value: String(unpaidOrdersCount) },
    { label: 'Jumlah Pelanggan', value: String(allCustomers.length) },
    { label: 'Jumlah Produk Aktif', value: String(activeProductsCount) },
    { label: 'Varian Stok Menipis', value: String(lowStockVariants.length) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#394536]">Ringkasan Boutique</h1>
          <p className="text-sm text-[#817B72]">Seluruh metrik dihitung langsung dari database transaksi nyata.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 bg-[#F7F2E8] rounded-lg">
            {[
              { id: 'DAILY', label: 'Harian' },
              { id: 'WEEKLY', label: 'Mingguan' },
              { id: 'MONTHLY', label: 'Bulanan' },
              { id: 'YEARLY', label: 'Tahunan' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id as typeof period)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                  period === p.id ? 'bg-white text-[#394536] shadow-xs' : 'text-[#817B72]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Dari Tanggal"
            className="px-2.5 py-1.5 rounded-lg border border-[#E5DFD3] bg-white text-xs"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Sampai Tanggal"
            className="px-2.5 py-1.5 rounded-lg border border-[#E5DFD3] bg-white text-xs"
          />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-white border border-[#E5DFD3] rounded-xl p-4">
            <p className="text-xs text-[#817B72]">{k.label}</p>
            <p className="text-xl sm:text-2xl font-semibold text-[#394536] mt-1 tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E5DFD3] rounded-xl p-5 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-[#394536]">
            Grafik Penjualan & Pendapatan ({period})
          </h2>
          <div className="h-72">
            {salesSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-[#817B72]">
                Belum ada transaksi pada rentang periode yang dipilih.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val) => formatIDR(Number(val) || 0)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="pendapatan"
                    name="Pendapatan (IDR)"
                    stroke="#87977B"
                    strokeWidth={2.5}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E5DFD3] rounded-xl p-5 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-[#394536]">Kategori Paling Diminati</h2>
          <div className="h-72">
            {topCategories.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-[#817B72]">
                Belum ada data kategori.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topCategories}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    label
                  >
                    {topCategories.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top Selling Products & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E5DFD3] rounded-xl p-5 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-[#394536]">Produk Terlaris</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qty" name="Terjual (pcs)" fill="#C5A46D" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E5DFD3] rounded-xl p-5 space-y-3">
          <h2 className="font-serif text-xl font-semibold text-[#394536]">Peringatan Stok Minimum</h2>
          {lowStockVariants.length === 0 ? (
            <p className="text-sm text-[#817B72]">Seluruh stok varian dalam kondisi aman.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {lowStockVariants.map((v) => {
                const prod = products.find((p) => p.id === v.productId);
                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#394536]">{prod?.name || v.productId}</p>
                      <p className="text-[#817B72]">
                        {v.colorName} · Ukuran {v.size} (Min: {v.minStock})
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-amber-800 tabular-nums">
                      Sisa {v.stock}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
