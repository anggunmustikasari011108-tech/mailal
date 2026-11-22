import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  BoutiqueSettings,
  Category,
  Coupon,
  PaymentSettings,
  Product,
  ProductVariant,
  WebsiteBanner,
} from '../types';

export const DEFAULT_BOUTIQUE_SETTINGS: BoutiqueSettings = {
  brandName: 'MAILAL BOUTIQ',
  projectName: 'MAILAL BOUTIQ HIJAB DAN BUSANA',
  logoUrl: '/assets/aistudio/Logo_Boutique_Hijab_Mailal_Elegan_47622cbc.png',
  faviconUrl: '/assets/aistudio/Logo_Boutique_Hijab_Mailal_Elegan_47622cbc.png',
  primaryColor: '#87977B',
  secondaryColor: '#F7F2E8',
  accentColor: '#C5A46D',
  backgroundColor: '#FCFAF6',
  textColor: '#394536',
  secondaryTextColor: '#817B72',
  brandDescription:
    'Rumah mode muslimah modern yang menghadirkan koleksi gamis, abaya, khimar, dan busana syar’i premium dengan material pilihan serta jahitan berstandar butik.',
  address: 'JL. Raden Intan-Kartini ( Tanjung Karang ), Lampung',
  whatsapp: '+62-878-0184-9817',
  instagram: '@mailalboutiq.id',
  email: 'halo@mailalboutiq.id',
  operatingHours: 'Senin – Sabtu, 09.00 – 20.00 WIB',
  shippingPolicy:
    'Pesanan yang terkonfirmasi sebelum pukul 15.00 WIB akan diproses pada hari yang sama (Senin–Sabtu). Pengiriman menggunakan JNE, J&T Express, SiCepat, dan Anteraja dengan nomor resi yang dapat dilacak melalui halaman Akun Pelanggan. Gratis ongkos kirim untuk pembelian di atas Rp 750.000.',
  returnPolicy:
    'Penukaran ukuran atau pengembalian produk cacat produksi dapat diajukan maksimal 3x24 jam setelah paket diterima dengan menyertakan video unboxing serta tag label masih terpasang utuh dan belum dicuci.',
  termsAndConditions:
    'Seluruh harga tercantum dalam mata uang Rupiah (IDR). Pesanan diproses setelah pembayaran diverifikasi atau konfirmasi Cash On Delivery disetujui. Ketersediaan stok dihitung secara real-time per kombinasi ukuran dan warna.',
  privacyPolicy:
    'Data pribadi pelanggan seperti nama, nomor WhatsApp, email, dan alamat pengiriman dijaga kerahasiaannya dan hanya digunakan untuk keperluan pemrosesan pesanan serta pengiriman resmi butik.',
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  bankAccounts: [
    {
      id: 'bsi-01',
      bankName: 'Bank Syariah Indonesia (BSI)',
      accountNumber: '7190024881',
      accountHolder: 'MAILAL BOUTIQ HIJAB',
      isActive: true,
    },
    {
      id: 'bca-01',
      bankName: 'Bank Central Asia (BCA)',
      accountNumber: '5420819204',
      accountHolder: 'MAILAL BOUTIQ HIJAB',
      isActive: true,
    },
  ],
  bankTransferInstructions:
    'Silakan transfer sesuai total nominal tagihan hingga digit terakhir ke salah satu rekening resmi di atas, lalu unggah bukti transfer pada detail pesanan untuk diverifikasi tim kami.',
  codEnabled: true,
  codTerms:
    'Layanan Bayar di Tempat (COD) berlaku untuk total belanja maksimal Rp 2.500.000 pada area jangkauan kurir. Mohon siapkan uang pas dan pastikan nomor WhatsApp aktif saat kurir tiba.',
  codMaxAmount: 2500000,
  qrisProvider: 'Midtrans Core API (QRIS)',
  qrisInstructions:
    'Pindai kode QRIS resmi menggunakan aplikasi perbankan syariah/konvensional atau dompet digital Anda. Status transaksi diverifikasi otomatis melalui server gateway pembayaran.',
  shippingBaseCost: 22000,
  freeShippingThreshold: 750000,
};

export const INITIAL_BANNERS: Omit<WebsiteBanner, 'updatedAt'>[] = [
  {
    id: 'hero-main',
    title: 'Koleksi Utama Butik',
    headline: 'Keanggunan dalam Kesederhanaan.',
    subheadline:
      'Hadirkan keindahan berbusana dengan koleksi fashion muslimah yang memadukan kenyamanan, kualitas, dan kesantunan.',
    imageUrl: '/assets/images/hero_boutique_editorial_1795319645025.jpg',
    ctaPrimaryText: 'Jelajahi Koleksi',
    ctaSecondaryText: 'Belanja Sekarang',
    placement: 'HERO',
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'promo-raya',
    title: 'Promo Koleksi Terpilih',
    headline: 'Diskon Spesial Koleksi Eksklusif Hingga 15%',
    subheadline:
      'Gunakan kode voucher ANGGUN10 untuk potongan 10% minimal belanja Rp 500.000 serta nikmati gratis ongkir.',
    imageUrl: '/assets/images/product_outer_lace_1795319645511.jpg',
    ctaPrimaryText: 'Lihat Produk Diskon',
    ctaSecondaryText: 'Salin Kode ANGGUN10',
    placement: 'PROMO',
    isActive: true,
    sortOrder: 2,
  },
];

export const INITIAL_CATEGORIES: Omit<Category, 'createdAt'>[] = [
  { id: 'cat-gamis', name: 'Gamis', slug: 'gamis', description: 'Gamis syar’i siluet anggun untuk keseharian maupun acara formal.', sortOrder: 1, isActive: true },
  { id: 'cat-abaya', name: 'Abaya', slug: 'abaya', description: 'Abaya flowy berbahan silk dan crepe premium.', sortOrder: 2, isActive: true },
  { id: 'cat-tunik', name: 'Tunik', slug: 'tunik', description: 'Tunik modern berpotongan longgar dan rapi.', sortOrder: 3, isActive: true },
  { id: 'cat-blouse', name: 'Blouse Muslimah', slug: 'blouse-muslimah', description: 'Atasan muslimah elegan untuk aktivitas profesional.', sortOrder: 4, isActive: true },
  { id: 'cat-khimar', name: 'Khimar', slug: 'khimar', description: 'Khimar syar’i berbahan ringan, jatuh, dan tidak menerawang.', sortOrder: 5, isActive: true },
  { id: 'cat-hijab', name: 'Hijab', slug: 'hijab', description: 'Pashmina dan hijab segi empat premium.', sortOrder: 6, isActive: true },
  { id: 'cat-setelan', name: 'Setelan Muslimah', slug: 'setelan-muslimah', description: 'Setelan tunik dan rok/celana serasi.', sortOrder: 7, isActive: true },
  { id: 'cat-rok', name: 'Rok', slug: 'rok', description: 'Rok A-line dan plisket muslimah.', sortOrder: 8, isActive: true },
  { id: 'cat-outer', name: 'Outer', slug: 'outer', description: 'Long outer organza dan jacquard mewah.', sortOrder: 9, isActive: true },
  { id: 'cat-terbaru', name: 'Busana Muslimah Terbaru', slug: 'busana-muslimah-terbaru', description: 'Rilisan terbaru edisi terbatas butik.', sortOrder: 10, isActive: true },
];

export const INITIAL_PRODUCTS: Array<Omit<Product, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'prod-gamis-aisyah',
    name: 'Gamis Aisyah Premium',
    slug: 'gamis-aisyah-premium',
    sku: 'MB-GMS-001',
    categoryId: 'cat-gamis',
    categoryName: 'Gamis',
    description:
      'Gamis Aisyah Premium dirancang dari bahan Silk Crepe Grade-A yang lembut, sejuk, dan jatuh sempurna. Dilengkapi lipit halus pada rok serta sulaman benang emas tipis di bagian manset wudhu-friendly dan resleting depan tersembunyi.',
    material: 'Italian Silk Crepe & Sulam Benang Emas',
    careInfo: 'Cuci lembut dengan tangan menggunakan deterjen cair khusus sutra. Setrika suhu rendah dari bagian dalam.',
    sizeGuide: 'S: LD 96 cm / PB 135 cm | M: LD 102 cm / PB 138 cm | L: LD 108 cm / PB 140 cm | XL: LD 114 cm / PB 142 cm | XXL: LD 120 cm / PB 144 cm',
    price: 589000,
    discountPrice: 499000,
    costPrice: 310000,
    isNewArrival: true,
    isBestSeller: true,
    isFeatured: true,
    isExclusive: true,
    isActive: true,
    thumbnailUrl: '/assets/images/product_gamis_aisyah_1795319644966.jpg',
    totalStock: 45,
    soldCount: 84,
  },
  {
    id: 'prod-abaya-zahra',
    name: 'Abaya Zahra Champagne Silk',
    slug: 'abaya-zahra-champagne-silk',
    sku: 'MB-ABY-002',
    categoryId: 'cat-abaya',
    categoryName: 'Abaya',
    description:
      'Abaya potongan kimono longgar bernuansa krem hangat dengan aksen sulam bordir halus pada bagian dada dan piping emas lembut. Ideal untuk menghadiri kajian, silaturahmi, maupun perayaan hari raya.',
    material: 'Matte Satin Silk Premium',
    careInfo: 'Disarankan dry clean atau hand-wash dingin. Jemur di tempat teduh.',
    sizeGuide: 'S: LD 104 cm / PB 136 cm | M: LD 110 cm / PB 139 cm | L: LD 116 cm / PB 142 cm | XL: LD 122 cm / PB 144 cm',
    price: 675000,
    discountPrice: 0,
    costPrice: 365000,
    isNewArrival: true,
    isBestSeller: true,
    isFeatured: true,
    isExclusive: true,
    isActive: true,
    thumbnailUrl: '/assets/images/product_abaya_zahra_1795319644781.jpg',
    totalStock: 26,
    soldCount: 62,
  },
  {
    id: 'prod-khimar-safiya',
    name: 'Khimar Syar’i Safiya Ceruti',
    slug: 'khimar-syari-safiya-ceruti',
    sku: 'MB-KHM-003',
    categoryId: 'cat-khimar',
    categoryName: 'Khimar',
    description:
      'Khimar dua lapis berbahan Ceruti Babydoll Armany yang ringan, adem, dan menutup dada hingga pinggang dengan anggun. Bagian pet antem (anti tembem) membentuk bingkai wajah secara rapi.',
    material: 'Ceruti Babydoll Armany Double Layer',
    careInfo: 'Cuci manual tanpa pemutih. Simpan dengan digantung agar tidak mudah kusut.',
    sizeGuide: 'M: Panjang Depan 85 cm / Belakang 110 cm | L: Panjang Depan 95 cm / Belakang 125 cm | XL: Panjang Depan 105 cm / Belakang 135 cm',
    price: 245000,
    discountPrice: 215000,
    costPrice: 115000,
    isNewArrival: true,
    isBestSeller: false,
    isFeatured: true,
    isExclusive: false,
    isActive: true,
    thumbnailUrl: '/assets/images/product_khimar_silk_1795319644909.jpg',
    totalStock: 34,
    soldCount: 51,
  },
  {
    id: 'prod-setelan-madina',
    name: 'Setelan Tunik Madina Organic Linen',
    slug: 'setelan-tunik-madina-organic-linen',
    sku: 'MB-SET-004',
    categoryId: 'cat-setelan',
    categoryName: 'Setelan Muslimah',
    description:
      'Setelan tunik kerah shanghai berkancing tersembunyi dipadukan dengan celana kulot berpotongan longgar. Menggunakan kain linen organik bertekstur lembut yang menyerap keringat sepanjang hari.',
    material: '100% Linen Ramie Organik',
    careInfo: 'Cuci terpisah pada putaran lembut. Setrika dalam kondisi agak lembap.',
    sizeGuide: 'S: LD 98 cm | M: LD 104 cm | L: LD 110 cm | XL: LD 116 cm',
    price: 495000,
    discountPrice: 445000,
    costPrice: 250000,
    isNewArrival: false,
    isBestSeller: true,
    isFeatured: true,
    isExclusive: false,
    isActive: true,
    thumbnailUrl: '/assets/images/product_tunik_linen_1795319644912.jpg',
    totalStock: 28,
    soldCount: 73,
  },
  {
    id: 'prod-outer-naura',
    name: 'Long Outer Naura Organza Jacquard',
    slug: 'long-outer-naura-organza-jacquard',
    sku: 'MB-OUT-005',
    categoryId: 'cat-outer',
    categoryName: 'Outer',
    description:
      'Long outer eksklusif berbahan organza jacquard motif floral lembut dengan lengan balon manset karet. Memberikan lapisan keanggunan instan di atas gamis atau dress polos Anda.',
    material: 'Organza Jacquard Silk Blend',
    careInfo: 'Cuci tangan dingin tanpa diperas keras. Gunakan setrika uap.',
    sizeGuide: 'All Size (S-M): LD 106 cm / PB 132 cm | Plus (L-XXL): LD 120 cm / PB 136 cm',
    price: 425000,
    discountPrice: 375000,
    costPrice: 210000,
    isNewArrival: true,
    isBestSeller: false,
    isFeatured: true,
    isExclusive: true,
    isActive: true,
    thumbnailUrl: '/assets/images/product_outer_lace_1795319645511.jpg',
    totalStock: 22,
    soldCount: 39,
  },
  {
    id: 'prod-tunik-hanum',
    name: 'Tunik Hanum Minimalist Pleats',
    slug: 'tunik-hanum-minimalist-pleats',
    sku: 'MB-TNK-006',
    categoryId: 'cat-tunik',
    categoryName: 'Tunik',
    description:
      'Tunik panjang berpotongan A-line dengan detail plisket lembut dan kancing mutiara tersembunyi. Mudah dipadupadankan dengan rok maupun kulot favorit untuk tampilan kasual elegan.',
    material: 'Tencel Linen Blend',
    careInfo: 'Cuci lembut dengan suhu maksimal 30°C.',
    sizeGuide: 'S: LD 96 cm | M: LD 102 cm | L: LD 108 cm | XL: LD 114 cm',
    price: 345000,
    discountPrice: 0,
    costPrice: 175000,
    isNewArrival: false,
    isBestSeller: true,
    isFeatured: false,
    isExclusive: false,
    isActive: true,
    thumbnailUrl: '/assets/images/product_tunik_linen_1795319644912.jpg',
    totalStock: 30,
    soldCount: 44,
  },
];

export const INITIAL_VARIANTS: Array<Omit<ProductVariant, 'updatedAt'>> = [
  // Gamis Aisyah Premium (exact example from prompt)
  { id: 'var-aisyah-sage-m', productId: 'prod-gamis-aisyah', sku: 'MB-GMS-001-SGE-M', size: 'M', colorName: 'Sage Green', colorHex: '#87977B', stock: 10, minStock: 3, priceAdjustment: 0, isActive: true },
  { id: 'var-aisyah-sage-l', productId: 'prod-gamis-aisyah', sku: 'MB-GMS-001-SGE-L', size: 'L', colorName: 'Sage Green', colorHex: '#87977B', stock: 15, minStock: 3, priceAdjustment: 0, isActive: true },
  { id: 'var-aisyah-cream-m', productId: 'prod-gamis-aisyah', sku: 'MB-GMS-001-CRM-M', size: 'M', colorName: 'Cream', colorHex: '#E8DEC8', stock: 8, minStock: 3, priceAdjustment: 0, isActive: true },
  { id: 'var-aisyah-cream-l', productId: 'prod-gamis-aisyah', sku: 'MB-GMS-001-CRM-L', size: 'L', colorName: 'Cream', colorHex: '#E8DEC8', stock: 12, minStock: 3, priceAdjustment: 0, isActive: true },
  // Abaya Zahra
  { id: 'var-zahra-champ-s', productId: 'prod-abaya-zahra', sku: 'MB-ABY-002-CHP-S', size: 'S', colorName: 'Champagne Cream', colorHex: '#EFE5D5', stock: 7, minStock: 2, priceAdjustment: 0, isActive: true },
  { id: 'var-zahra-champ-m', productId: 'prod-abaya-zahra', sku: 'MB-ABY-002-CHP-M', size: 'M', colorName: 'Champagne Cream', colorHex: '#EFE5D5', stock: 9, minStock: 2, priceAdjustment: 0, isActive: true },
  { id: 'var-zahra-olive-l', productId: 'prod-abaya-zahra', sku: 'MB-ABY-002-OLV-L', size: 'L', colorName: 'Dark Olive', colorHex: '#394536', stock: 10, minStock: 2, priceAdjustment: 0, isActive: true },
  // Khimar Safiya
  { id: 'var-safiya-ivory-m', productId: 'prod-khimar-safiya', sku: 'MB-KHM-003-IVR-M', size: 'M', colorName: 'Ivory Cream', colorHex: '#F7F2E8', stock: 14, minStock: 4, priceAdjustment: 0, isActive: true },
  { id: 'var-safiya-ivory-l', productId: 'prod-khimar-safiya', sku: 'MB-KHM-003-IVR-L', size: 'L', colorName: 'Ivory Cream', colorHex: '#F7F2E8', stock: 12, minStock: 4, priceAdjustment: 0, isActive: true },
  { id: 'var-safiya-sage-xl', productId: 'prod-khimar-safiya', sku: 'MB-KHM-003-SGE-XL', size: 'XL', colorName: 'Sage Green', colorHex: '#87977B', stock: 8, minStock: 4, priceAdjustment: 0, isActive: true },
  // Setelan Madina
  { id: 'var-madina-sage-m', productId: 'prod-setelan-madina', sku: 'MB-SET-004-SGE-M', size: 'M', colorName: 'Olive Sage', colorHex: '#7A8A6F', stock: 9, minStock: 3, priceAdjustment: 0, isActive: true },
  { id: 'var-madina-sage-l', productId: 'prod-setelan-madina', sku: 'MB-SET-004-SGE-L', size: 'L', colorName: 'Olive Sage', colorHex: '#7A8A6F', stock: 11, minStock: 3, priceAdjustment: 0, isActive: true },
  { id: 'var-madina-sand-xl', productId: 'prod-setelan-madina', sku: 'MB-SET-004-SND-XL', size: 'XL', colorName: 'Warm Sand', colorHex: '#D8CDB9', stock: 8, minStock: 3, priceAdjustment: 0, isActive: true },
  // Long Outer Naura
  { id: 'var-naura-sage-s', productId: 'prod-outer-naura', sku: 'MB-OUT-005-SGE-S', size: 'S', colorName: 'Sage Organza', colorHex: '#87977B', stock: 8, minStock: 2, priceAdjustment: 0, isActive: true },
  { id: 'var-naura-sage-m', productId: 'prod-outer-naura', sku: 'MB-OUT-005-SGE-M', size: 'M', colorName: 'Sage Organza', colorHex: '#87977B', stock: 9, minStock: 2, priceAdjustment: 0, isActive: true },
  { id: 'var-naura-gold-l', productId: 'prod-outer-naura', sku: 'MB-OUT-005-GLD-L', size: 'L', colorName: 'Soft Gold', colorHex: '#C5A46D', stock: 5, minStock: 2, priceAdjustment: 0, isActive: true },
  // Tunik Hanum
  { id: 'var-hanum-cream-m', productId: 'prod-tunik-hanum', sku: 'MB-TNK-006-CRM-M', size: 'M', colorName: 'Cream Linen', colorHex: '#F3ECE0', stock: 15, minStock: 3, priceAdjustment: 0, isActive: true },
  { id: 'var-hanum-sage-l', productId: 'prod-tunik-hanum', sku: 'MB-TNK-006-SGE-L', size: 'L', colorName: 'Sage Green', colorHex: '#87977B', stock: 15, minStock: 3, priceAdjustment: 0, isActive: true },
];

export const INITIAL_COUPONS: Array<Omit<Coupon, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'coupon-anggun10',
    code: 'ANGGUN10',
    type: 'PERCENTAGE',
    value: 10,
    minPurchase: 500000,
    maxDiscount: 100000,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    usageLimit: 200,
    usedCount: 0,
    isActive: true,
    description: 'Diskon 10% (maks. Rp 100.000) untuk pembelanjaan minimal Rp 500.000',
  },
  {
    id: 'coupon-berkah50',
    code: 'BERKAH50',
    type: 'FIXED',
    value: 50000,
    minPurchase: 400000,
    maxDiscount: 50000,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    usageLimit: 150,
    usedCount: 0,
    isActive: true,
    description: 'Potongan langsung Rp 50.000 minimal belanja Rp 400.000',
  },
];

export async function seedInitialBoutiqueData(): Promise<void> {
  try {
    const existingCats = await getDocs(query(collection(db, 'categories'), limit(1)));
    const existingProds = await getDocs(query(collection(db, 'products'), limit(1)));
    const existingSettings = await getDocs(query(collection(db, 'boutique_settings'), limit(1)));

    if (!existingSettings.empty) {
      const settingsDoc = existingSettings.docs[0];
      const curr = settingsDoc.data() as BoutiqueSettings;
      const patch: Partial<BoutiqueSettings> = {};
      if (curr.brandName === 'DINAMIS') patch.brandName = 'MAILAL BOUTIQ';
      if (curr.address === 'Jl. Kemang Raya No. 48, Jakarta Selatan 12730, Indonesia') {
        patch.address = 'JL. Raden Intan-Kartini ( Tanjung Karang ), Lampung';
      }
      if (curr.whatsapp === '+62 812-8890-2410') {
        patch.whatsapp = '+62-878-0184-9817';
      }
      if (Object.keys(patch).length > 0) {
        await setDoc(
          doc(db, 'boutique_settings', settingsDoc.id),
          { ...patch, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
    }

    if (!existingSettings.empty && !existingCats.empty && !existingProds.empty) {
      return;
    }

    const batch = writeBatch(db);

    if (existingSettings.empty) {
      batch.set(doc(db, 'boutique_settings', 'default'), {
        ...DEFAULT_BOUTIQUE_SETTINGS,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'payment_settings', 'default'), {
        ...DEFAULT_PAYMENT_SETTINGS,
        updatedAt: serverTimestamp(),
      });
      for (const banner of INITIAL_BANNERS) {
        batch.set(doc(db, 'website_banners', banner.id), {
          ...banner,
          updatedAt: serverTimestamp(),
        });
      }
      for (const coupon of INITIAL_COUPONS) {
        batch.set(doc(db, 'coupons', coupon.id), {
          ...coupon,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    if (existingCats.empty) {
      for (const cat of INITIAL_CATEGORIES) {
        batch.set(doc(db, 'categories', cat.id), {
          ...cat,
          createdAt: serverTimestamp(),
        });
      }
    }

    if (existingProds.empty) {
      for (const prod of INITIAL_PRODUCTS) {
        batch.set(doc(db, 'products', prod.id), {
          ...prod,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const variant of INITIAL_VARIANTS) {
        batch.set(doc(db, 'product_variants', variant.id), {
          ...variant,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seedInitialBoutiqueData');
  }
}

export async function ensureBoutiqueSettingsDocument(): Promise<void> {
  try {
    await setDoc(
      doc(db, 'boutique_settings', 'default'),
      { ...DEFAULT_BOUTIQUE_SETTINGS, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'boutique_settings/default');
  }
}
