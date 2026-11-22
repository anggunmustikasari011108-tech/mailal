'use client';

import React, { useState } from 'react';
import { Edit3, Plus, Trash2, Upload } from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { useStore } from '../../context/StoreContext';
import { db, handleFirestoreError, OperationType, uploadImageToServer } from '../../lib/firebase';
import { formatIDR, formatJakartaDate, sanitizeImageUrl, slugify } from '../../lib/formatters';
import { Product } from '../../types';

interface AdminCatalogSectionProps {
  section: 'PRODUCTS' | 'CATEGORIES' | 'VARIANTS' | 'STOCK';
}

export const AdminCatalogSection: React.FC<AdminCatalogSectionProps> = ({ section }) => {
  const {
    categories,
    products,
    variants,
    stockMovements,
    firebaseUser,
    userProfile,
    logActivity,
    showToast,
  } = useStore();

  // ─── Product CRUD State ──────────────────────────────────────────────────
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [pName, setPName] = useState('');
  const [pSku, setPSku] = useState('');
  const [pCatId, setPCatId] = useState(categories[0]?.id || '');
  const [pPrice, setPPrice] = useState('');
  const [pDiscountPrice, setPDiscountPrice] = useState('');
  const [pCostPrice, setPCostPrice] = useState('');
  const [pMaterial, setPMaterial] = useState('');
  const [pCareInfo, setPCareInfo] = useState('');
  const [pSizeGuide, setPSizeGuide] = useState('');
  const [pDescription, setPDescription] = useState('');
  const [pThumb, setPThumb] = useState('');
  const [pNewArrival, setPNewArrival] = useState(true);
  const [pBestSeller, setPBestSeller] = useState(false);
  const [pFeatured, setPFeatured] = useState(true);
  const [pExclusive, setPExclusive] = useState(false);
  const [pActive, setPActive] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ─── Category CRUD State ─────────────────────────────────────────────────
  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // ─── Variant CRUD State ──────────────────────────────────────────────────
  const [vProdId, setVProdId] = useState(products[0]?.id || '');
  const [vSize, setVSize] = useState('M');
  const [vCustomSize, setVCustomSize] = useState('');
  const [vColorName, setVColorName] = useState('');
  const [vColorHex, setVColorHex] = useState('#87977B');
  const [vStock, setVStock] = useState('10');
  const [vMinStock, setVMinStock] = useState('3');

  // ─── Stock Movement State ────────────────────────────────────────────────
  const [smVariantId, setSmVariantId] = useState(variants[0]?.id || '');
  const [smType, setSmType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [smQty, setSmQty] = useState('5');
  const [smReason, setSmReason] = useState('');

  const resetProductForm = () => {
    setEditingProductId(null);
    setPName('');
    setPSku('');
    setPCatId(categories[0]?.id || '');
    setPPrice('');
    setPDiscountPrice('');
    setPCostPrice('');
    setPMaterial('');
    setPCareInfo('');
    setPSizeGuide('');
    setPDescription('');
    setPThumb('');
    setPNewArrival(true);
    setPBestSeller(false);
    setPFeatured(true);
    setPExclusive(false);
    setPActive(true);
  };

  const loadProductForEdit = (p: Product) => {
    setEditingProductId(p.id);
    setPName(p.name);
    setPSku(p.sku);
    setPCatId(p.categoryId);
    setPPrice(String(p.price));
    setPDiscountPrice(p.discountPrice ? String(p.discountPrice) : '');
    setPCostPrice(p.costPrice ? String(p.costPrice) : '');
    setPMaterial(p.material || '');
    setPCareInfo(p.careInfo || '');
    setPSizeGuide(p.sizeGuide || '');
    setPDescription(p.description);
    setPThumb(p.thumbnailUrl);
    setPNewArrival(Boolean(p.isNewArrival));
    setPBestSeller(Boolean(p.isBestSeller));
    setPFeatured(Boolean(p.isFeatured));
    setPExclusive(Boolean(p.isExclusive));
    setPActive(p.isActive);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadImageToServer(file, 'product');
      setPThumb(url);
      showToast('success', 'Foto produk berhasil diunggah.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengunggah foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categories.find((c) => c.id === pCatId) || categories[0];
    if (!cat) {
      showToast('error', 'Pilih kategori terlebih dahulu.');
      return;
    }
    const id = editingProductId || `prod_${Date.now()}`;
    const existing = products.find((p) => p.id === id);

    try {
      const payload = {
        name: pName.trim(),
        slug: slugify(pName),
        sku: pSku.trim().toUpperCase(),
        categoryId: cat.id,
        categoryName: cat.name,
        description: pDescription.trim(),
        material: pMaterial.trim(),
        careInfo: pCareInfo.trim(),
        sizeGuide: pSizeGuide.trim(),
        price: Math.max(0, Number(pPrice) || 0),
        discountPrice: pDiscountPrice ? Math.max(0, Number(pDiscountPrice)) : 0,
        costPrice: pCostPrice ? Math.max(0, Number(pCostPrice)) : 0,
        isNewArrival: pNewArrival,
        isBestSeller: pBestSeller,
        isFeatured: pFeatured,
        isExclusive: pExclusive,
        isActive: pActive,
        thumbnailUrl: pThumb.trim() || '/assets/images/product_gamis_aisyah_1795319644966.jpg',
        totalStock: existing ? existing.totalStock : 0,
        soldCount: existing ? existing.soldCount : 0,
        updatedAt: serverTimestamp(),
      };

      if (editingProductId) {
        await updateDoc(doc(db, 'products', id), payload);
        await logActivity('EDIT_PRODUCT', 'products', id, `Mengubah produk ${payload.name}`);
        showToast('success', 'Produk berhasil diperbarui.');
      } else {
        await setDoc(doc(db, 'products', id), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        await logActivity('CREATE_PRODUCT', 'products', id, `Menambah produk ${payload.name}`);
        showToast('success', 'Produk baru berhasil ditambahkan.');
      }
      resetProductForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${id}`);
    }
  };

  const handleToggleProductActive = async (p: Product) => {
    try {
      await updateDoc(doc(db, 'products', p.id), {
        isActive: !p.isActive,
        updatedAt: serverTimestamp(),
      });
      await logActivity('TOGGLE_PRODUCT', 'products', p.id, `${!p.isActive ? 'Aktifkan' : 'Nonaktifkan'} ${p.name}`);
      showToast('success', `Status produk ${p.name} diperbarui.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${p.id}`);
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    try {
      await deleteDoc(doc(db, 'products', p.id));
      await logActivity('DELETE_PRODUCT', 'products', p.id, `Hapus produk ${p.name}`);
      showToast('info', `Produk ${p.name} dihapus.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${p.id}`);
    }
  };

  // ─── Category Handlers ───────────────────────────────────────────────────
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingCatId || `cat_${slugify(cName)}_${Date.now().toString().slice(-4)}`;
    try {
      if (editingCatId) {
        await updateDoc(doc(db, 'categories', id), {
          name: cName.trim(),
          slug: slugify(cName),
          description: cDesc.trim(),
        });
        showToast('success', 'Kategori diperbarui.');
      } else {
        await setDoc(doc(db, 'categories', id), {
          name: cName.trim(),
          slug: slugify(cName),
          description: cDesc.trim(),
          sortOrder: categories.length + 1,
          isActive: true,
          createdAt: serverTimestamp(),
        });
        showToast('success', 'Kategori baru ditambahkan.');
      }
      setEditingCatId(null);
      setCName('');
      setCDesc('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `categories/${id}`);
    }
  };

  // ─── Variant Handlers ────────────────────────────────────────────────────
  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === vProdId);
    if (!prod) return;
    const finalSize = vSize === 'CUSTOM' ? vCustomSize.trim() : vSize;
    if (!finalSize || !vColorName.trim()) {
      showToast('error', 'Ukuran dan nama warna wajib diisi.');
      return;
    }
    const varId = `var_${Date.now()}`;
    const stockNum = Math.max(0, Number(vStock) || 0);
    const skuCode = `${prod.sku}-${slugify(vColorName).slice(0, 3).toUpperCase()}-${finalSize.toUpperCase()}`;

    try {
      await runTransaction(db, async (tx) => {
        const pRef = doc(db, 'products', prod.id);
        const pSnap = await tx.get(pRef);
        const currTotal = pSnap.exists() ? (pSnap.data().totalStock as number) || 0 : prod.totalStock;
        tx.set(doc(db, 'product_variants', varId), {
          productId: prod.id,
          sku: skuCode,
          size: finalSize,
          colorName: vColorName.trim(),
          colorHex: vColorHex,
          stock: stockNum,
          minStock: Math.max(0, Number(vMinStock) || 3),
          priceAdjustment: 0,
          isActive: true,
          updatedAt: serverTimestamp(),
        });
        tx.update(pRef, {
          totalStock: currTotal + stockNum,
          updatedAt: serverTimestamp(),
        });
      });
      await logActivity('CREATE_VARIANT', 'product_variants', varId, `${prod.name} (${vColorName} - ${finalSize})`);
      showToast('success', 'Varian produk berhasil ditambahkan.');
      setVColorName('');
      setVCustomSize('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `product_variants/${varId}`);
    }
  };

  // ─── Stock Movement Transaction ──────────────────────────────────────────
  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const variant = variants.find((v) => v.id === smVariantId);
    if (!variant) return;
    const prod = products.find((p) => p.id === variant.productId);
    if (!prod) return;
    const qtyVal = Math.max(0, Number(smQty) || 0);
    if (!smReason.trim()) {
      showToast('error', 'Alasan mutasi stok wajib diisi.');
      return;
    }

    try {
      await runTransaction(db, async (tx) => {
        const vRef = doc(db, 'product_variants', variant.id);
        const pRef = doc(db, 'products', prod.id);
        const [vSnap, pSnap] = await Promise.all([tx.get(vRef), tx.get(pRef)]);
        if (!vSnap.exists() || !pSnap.exists()) throw new Error('Varian atau produk tidak ditemukan.');

        const prevVarStock = (vSnap.data().stock as number) || 0;
        const prevProdTotal = (pSnap.data().totalStock as number) || 0;

        let newVarStock = prevVarStock;
        let delta = 0;
        if (smType === 'IN') {
          newVarStock = prevVarStock + qtyVal;
          delta = qtyVal;
        } else if (smType === 'OUT') {
          if (prevVarStock < qtyVal) throw new Error('Stok keluar melebihi stok varian saat ini.');
          newVarStock = prevVarStock - qtyVal;
          delta = -qtyVal;
        } else {
          newVarStock = qtyVal;
          delta = qtyVal - prevVarStock;
        }

        tx.update(vRef, { stock: newVarStock, updatedAt: serverTimestamp() });
        tx.update(pRef, {
          totalStock: Math.max(0, prevProdTotal + delta),
          updatedAt: serverTimestamp(),
        });

        const moveId = `sm_${Date.now()}`;
        tx.set(doc(db, 'stock_movements', moveId), {
          productId: prod.id,
          productName: prod.name,
          variantId: variant.id,
          variantLabel: `${variant.colorName} - ${variant.size}`,
          type: smType,
          quantityChange: delta,
          previousStock: prevVarStock,
          newStock: newVarStock,
          reason: smReason.trim(),
          actorId: firebaseUser?.uid || 'admin',
          actorName: userProfile?.displayName || 'Admin',
          createdAt: serverTimestamp(),
        });
      });
      showToast('success', 'Mutasi stok berhasil dicatat ke database.');
      setSmReason('');
    } catch (err) {
      if (err instanceof Error && !err.message.includes('Missing or insufficient')) {
        showToast('error', err.message);
      } else {
        handleFirestoreError(err, OperationType.WRITE, 'stock_movements');
      }
    }
  };

  if (section === 'PRODUCTS') {
    return (
      <div className="space-y-8">
        <h1 className="font-serif text-3xl font-semibold text-[#394536]">Manajemen Produk</h1>

        <form onSubmit={handleSaveProduct} className="bg-white border border-[#E5DFD3] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-[#394536]">
              {editingProductId ? 'Edit Produk' : 'Tambah Produk Baru'}
            </h2>
            {editingProductId && (
              <button type="button" onClick={resetProductForm} className="text-xs underline text-[#817B72]">
                Batal Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Nama Produk *</label>
              <input
                type="text"
                required
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">SKU Utama *</label>
              <input
                type="text"
                required
                value={pSku}
                onChange={(e) => setPSku(e.target.value)}
                placeholder="MB-GMS-007"
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Kategori *</label>
              <select
                value={pCatId}
                onChange={(e) => setPCatId(e.target.value)}
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Harga Jual (IDR) *</label>
              <input
                type="number"
                required
                min={0}
                value={pPrice}
                onChange={(e) => setPPrice(e.target.value)}
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Harga Diskon (Opsional)</label>
              <input
                type="number"
                min={0}
                value={pDiscountPrice}
                onChange={(e) => setPDiscountPrice(e.target.value)}
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Harga Modal (Untuk Hitung Laba)</label>
              <input
                type="number"
                min={0}
                value={pCostPrice}
                onChange={(e) => setPCostPrice(e.target.value)}
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Material / Bahan</label>
              <input
                type="text"
                value={pMaterial}
                onChange={(e) => setPMaterial(e.target.value)}
                placeholder="Italian Silk Crepe..."
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Foto Produk (URL atau Unggah)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pThumb}
                  onChange={(e) => setPThumb(e.target.value)}
                  placeholder="/uploads/... atau /assets/images/..."
                  className="flex-1 rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
                />
                <label className="px-3 py-2 rounded-lg border border-[#87977B] text-xs font-medium cursor-pointer inline-flex items-center gap-1.5 shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingPhoto ? 'Mengunggah...' : 'Unggah'}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handlePhotoUpload} />
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Deskripsi Produk *</label>
              <textarea
                rows={3}
                required
                value={pDescription}
                onChange={(e) => setPDescription(e.target.value)}
                className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Panduan Ukuran</label>
                <input
                  type="text"
                  value={pSizeGuide}
                  onChange={(e) => setPSizeGuide(e.target.value)}
                  className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Informasi Perawatan</label>
                <input
                  type="text"
                  value={pCareInfo}
                  onChange={(e) => setPCareInfo(e.target.value)}
                  className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-5 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={pNewArrival} onChange={(e) => setPNewArrival(e.target.checked)} /> New Arrival</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={pBestSeller} onChange={(e) => setPBestSeller(e.target.checked)} /> Best Seller</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={pFeatured} onChange={(e) => setPFeatured(e.target.checked)} /> Featured Collection</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={pExclusive} onChange={(e) => setPExclusive(e.target.checked)} /> Koleksi Eksklusif</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={pActive} onChange={(e) => setPActive(e.target.checked)} /> Produk Aktif</label>
          </div>

          <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>{editingProductId ? 'Simpan Perubahan Produk' : 'Tambah Produk'}</span>
          </button>
        </form>

        {/* Product List Table */}
        <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F2E8] text-xs text-[#394536]">
              <tr>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 flex items-center gap-3">
                    <img src={sanitizeImageUrl(p.thumbnailUrl)} alt={p.name} className="w-10 h-12 rounded object-cover bg-[#F7F2E8]" />
                    <span className="font-medium text-[#394536]">{p.name}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 text-xs">{p.categoryName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatIDR(p.discountPrice && p.discountPrice > 0 ? p.discountPrice : p.price)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{p.totalStock}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleProductActive(p)}
                      className={`text-xs font-medium underline ${p.isActive ? 'text-emerald-700' : 'text-[#817B72]'}`}
                    >
                      {p.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button type="button" onClick={() => loadProductForEdit(p)} className="p-1.5 text-[#394536] hover:bg-[#F7F2E8] rounded">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => void handleDeleteProduct(p)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
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

  if (section === 'CATEGORIES') {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-3xl font-semibold text-[#394536]">Manajemen Kategori</h1>
        <form onSubmit={handleSaveCategory} className="bg-white border border-[#E5DFD3] rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium mb-1">Nama Kategori *</label>
            <input type="text" required value={cName} onChange={(e) => setCName(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Deskripsi</label>
            <input type="text" value={cDesc} onChange={(e) => setCDesc(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium">
            {editingCatId ? 'Perbarui Kategori' : 'Tambah Kategori'}
          </button>
        </form>

        <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F2E8] text-xs">
              <tr>
                <th className="px-4 py-3">Nama Kategori</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Deskripsi</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#817B72]">{c.slug}</td>
                  <td className="px-4 py-3 text-xs text-[#817B72]">{c.description}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatId(c.id);
                        setCName(c.name);
                        setCDesc(c.description || '');
                      }}
                      className="p-1.5 hover:bg-[#F7F2E8] rounded"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteDoc(doc(db, 'categories', c.id))}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
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

  if (section === 'VARIANTS') {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-3xl font-semibold text-[#394536]">Varian Produk (Ukuran & Warna)</h1>
        <form onSubmit={handleCreateVariant} className="bg-white border border-[#E5DFD3] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium mb-1">Produk</label>
            <select value={vProdId} onChange={(e) => setVProdId(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm bg-white">
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Ukuran</label>
            <select value={vSize} onChange={(e) => setVSize(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm bg-white">
              {['S', 'M', 'L', 'XL', 'XXL', 'CUSTOM'].map((s) => (
                <option key={s} value={s}>{s === 'CUSTOM' ? 'Ukuran Khusus' : s}</option>
              ))}
            </select>
            {vSize === 'CUSTOM' && (
              <input type="text" placeholder="Mis. All Size" value={vCustomSize} onChange={(e) => setVCustomSize(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E5DFD3] px-2 py-1 text-xs" />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nama Warna *</label>
            <input type="text" required placeholder="Sage Green" value={vColorName} onChange={(e) => setVColorName(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <div className="w-16">
              <label className="block text-xs font-medium mb-1">Hex</label>
              <input type="color" value={vColorHex} onChange={(e) => setVColorHex(e.target.value)} className="w-full h-9 rounded border border-[#E5DFD3]" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Stok Awal</label>
              <input type="number" min={0} value={vStock} onChange={(e) => setVStock(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-2 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" className="px-4 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium">
            Tambah Varian
          </button>
        </form>

        <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F2E8] text-xs">
              <tr>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">SKU Varian</th>
                <th className="px-4 py-3">Warna</th>
                <th className="px-4 py-3">Ukuran</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3 text-right">Min. Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {variants.map((v) => {
                const prod = products.find((p) => p.id === v.productId);
                return (
                  <tr key={v.id}>
                    <td className="px-4 py-3 font-medium">{prod?.name || v.productId}</td>
                    <td className="px-4 py-3 font-mono text-xs">{v.sku}</td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border border-black/15" style={{ backgroundColor: v.colorHex }} />
                      <span>{v.colorName}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{v.size}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{v.stock}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#817B72]">{v.minStock}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── STOCK MANAGEMENT ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-[#394536]">Manajemen & Riwayat Stok</h1>

      <form onSubmit={handleStockAdjustment} className="bg-white border border-[#E5DFD3] rounded-xl p-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1">Pilih Varian Produk</label>
          <select value={smVariantId} onChange={(e) => setSmVariantId(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm bg-white">
            {variants.map((v) => {
              const prod = products.find((p) => p.id === v.productId);
              return (
                <option key={v.id} value={v.id}>
                  {prod?.name} — {v.colorName} ({v.size}) · Stok: {v.stock}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Jenis Mutasi</label>
          <select value={smType} onChange={(e) => setSmType(e.target.value as typeof smType)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm bg-white">
            <option value="IN">Stok Masuk (+)</option>
            <option value="OUT">Stok Keluar (-)</option>
            <option value="ADJUSTMENT">Penyesuaian (Set Nilai)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Jumlah</label>
          <input type="number" min={0} required value={smQty} onChange={(e) => setSmQty(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Alasan / Referensi *</label>
          <input type="text" required placeholder="Restock batch..." value={smReason} onChange={(e) => setSmReason(e.target.value)} className="w-full rounded-lg border border-[#E5DFD3] px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="md:col-span-5 w-fit px-5 py-2.5 rounded-lg bg-[#87977B] text-white text-sm font-medium">
          Simpan Mutasi Stok
        </button>
      </form>

      <div className="bg-white border border-[#E5DFD3] rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F7F2E8] text-xs">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Produk & Varian</th>
              <th className="px-4 py-3">Tipe</th>
              <th className="px-4 py-3 text-right">Perubahan</th>
              <th className="px-4 py-3 text-right">Stok Akhir</th>
              <th className="px-4 py-3">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {stockMovements.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#817B72]">Belum ada catatan mutasi stok.</td></tr>
            ) : (
              stockMovements.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-xs text-[#817B72]">{formatJakartaDate(m.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#394536]">{m.productName}</p>
                    <p className="text-xs text-[#817B72]">{m.variantLabel}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{m.type}</td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${m.quantityChange >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{m.newStock}</td>
                  <td className="px-4 py-3 text-xs text-[#817B72]">{m.reason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
