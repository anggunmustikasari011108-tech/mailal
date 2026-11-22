'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  DEFAULT_BOUTIQUE_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
  INITIAL_BANNERS,
  INITIAL_CATEGORIES,
  INITIAL_COUPONS,
  INITIAL_PRODUCTS,
  INITIAL_VARIANTS,
  seedInitialBoutiqueData,
} from '../lib/defaultData';
import { generateInvoiceNumber } from '../lib/formatters';
import {
  ActivityLog,
  BoutiqueSettings,
  CartItem,
  Category,
  Coupon,
  CustomerRecord,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentRecord,
  PaymentSettings,
  PaymentStatus,
  Product,
  ProductImage,
  ProductReview,
  ProductVariant,
  SavedAddress,
  Shipment,
  ShippingAddress,
  StockMovement,
  UserProfile,
  UserRole,
  WebsiteBanner,
  WishlistItem,
} from '../types';

export interface PlaceOrderInput {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: ShippingAddress;
  notes?: string;
  paymentMethod: PaymentMethod;
  couponCode?: string;
}

interface StoreContextValue {
  authReady: boolean;
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  customerRecord: CustomerRecord | null;
  isStaff: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;

  boutiqueSettings: BoutiqueSettings;
  paymentSettings: PaymentSettings;
  banners: WebsiteBanner[];
  categories: Category[];
  products: Product[];
  variants: ProductVariant[];
  productImages: ProductImage[];
  coupons: Coupon[];
  reviews: ProductReview[];

  cartItems: CartItem[];
  wishlistIds: string[];
  wishlists: WishlistItem[];
  orders: Order[];
  orderItems: OrderItem[];
  payments: PaymentRecord[];
  shipments: Shipment[];

  // Admin datasets
  allUsers: UserProfile[];
  allCustomers: CustomerRecord[];
  stockMovements: StockMovement[];
  activityLogs: ActivityLog[];

  // Toast notifications
  toastMessage: { type: 'success' | 'error' | 'info'; text: string } | null;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
  clearToast: () => void;

  // Auth actions
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  updateAccountProfile: (displayName: string, phone: string) => Promise<void>;
  saveCustomerAddresses: (addresses: SavedAddress[]) => Promise<void>;

  // Storefront actions
  addToCart: (product: Product, variant: ProductVariant, quantity: number) => Promise<void>;
  updateCartItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  updateCartItemVariant: (itemId: string, newVariant: ProductVariant) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  submitReview: (productId: string, rating: number, comment: string) => Promise<void>;
  placeOrder: (input: PlaceOrderInput) => Promise<{ orderId: string; invoiceNumber: string; paymentId: string }>;
  submitBankTransferProof: (orderId: string, paymentId: string, proofImageUrl: string, bankName: string) => Promise<void>;
  cancelCustomerOrder: (orderId: string, reason: string) => Promise<void>;
  logActivity: (action: string, targetType: string, targetId?: string, details?: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [customerRecord, setCustomerRecord] = useState<CustomerRecord | null>(null);

  const [boutiqueSettings, setBoutiqueSettings] = useState<BoutiqueSettings>(DEFAULT_BOUTIQUE_SETTINGS);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [banners, setBanners] = useState<WebsiteBanner[]>(INITIAL_BANNERS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [variants, setVariants] = useState<ProductVariant[]>(INITIAL_VARIANTS);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [reviews, setReviews] = useState<ProductReview[]>([]);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestCart, setGuestCart] = useState<CartItem[]>([]);
  const [wishlists, setWishlists] = useState<WishlistItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);

  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerRecord[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    window.setTimeout(() => {
      setToastMessage((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  };
  const clearToast = () => setToastMessage(null);

  const role: UserRole = userProfile?.role || 'PELANGGAN';
  const isSuperAdmin =
    role === 'SUPER_ADMIN' ||
    (Boolean(firebaseUser?.emailVerified) &&
      firebaseUser?.email === BOOTSTRAPPED_ADMIN_EMAIL);
  const isAdmin = isSuperAdmin || role === 'ADMIN';
  const isStaff = isAdmin || role === 'STAF';

  // Sync dynamic CSS theme variables, page title, and favicon from boutiqueSettings
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--boutique-primary', boutiqueSettings.primaryColor || '#87977B');
    root.style.setProperty('--boutique-secondary', boutiqueSettings.secondaryColor || '#F7F2E8');
    root.style.setProperty('--boutique-accent', boutiqueSettings.accentColor || '#C5A46D');
    root.style.setProperty('--boutique-bg', boutiqueSettings.backgroundColor || '#FCFAF6');
    root.style.setProperty('--boutique-text', boutiqueSettings.textColor || '#394536');
    root.style.setProperty('--boutique-muted', boutiqueSettings.secondaryTextColor || '#817B72');

    document.title = `${boutiqueSettings.brandName} — ${boutiqueSettings.projectName}`;
    const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (iconLink && boutiqueSettings.faviconUrl) {
      iconLink.href = boutiqueSettings.faviconUrl;
    }
  }, [boutiqueSettings]);

  // Auth listener & user document provisioning
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUserProfile(null);
        setCustomerRecord(null);
        setOrders([]);
        setOrderItems([]);
        setPayments([]);
        setShipments([]);
        setWishlists([]);
        setAllUsers([]);
        setAllCustomers([]);
        setStockMovements([]);
        setActivityLogs([]);
        setAuthReady(true);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        const isBootAdmin = user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;

        if (!snap.exists()) {
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Pelanggan',
            phone: user.phoneNumber || '',
            role: isBootAdmin ? 'SUPER_ADMIN' : 'PELANGGAN',
            isActive: true,
            photoUrl: user.photoURL || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
          if (isBootAdmin) {
            await seedInitialBoutiqueData();
          }
        } else {
          const existing = snap.data() as UserProfile;
          if (isBootAdmin && existing.role !== 'SUPER_ADMIN') {
            await updateDoc(userRef, { role: 'SUPER_ADMIN', updatedAt: serverTimestamp() });
            setUserProfile({ ...existing, role: 'SUPER_ADMIN' });
            await seedInitialBoutiqueData();
          } else {
            setUserProfile(existing);
            if (existing.role === 'SUPER_ADMIN' || existing.role === 'ADMIN') {
              await seedInitialBoutiqueData();
            }
          }
        }

        // Ensure customer profile exists
        const custRef = doc(db, 'customers', user.uid);
        const custSnap = await getDoc(custRef);
        if (!custSnap.exists()) {
          const newCust: Omit<CustomerRecord, 'id'> = {
            userId: user.uid,
            fullName: user.displayName || user.email?.split('@')[0] || 'Pelanggan',
            phone: user.phoneNumber || '',
            email: user.email || '',
            addresses: [],
            totalOrders: 0,
            totalSpent: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(custRef, newCust);
          setCustomerRecord({ id: user.uid, ...newCust });
        } else {
          setCustomerRecord({ id: custSnap.id, ...(custSnap.data() as Omit<CustomerRecord, 'id'>) });
        }

        // Sync any guest cart items into Firestore cart_items
        setGuestCart((prevGuest) => {
          if (prevGuest.length > 0) {
            const batch = writeBatch(db);
            for (const item of prevGuest) {
              const itemId = `${user.uid}_${item.variantId}`;
              batch.set(doc(db, 'cart_items', itemId), {
                userId: user.uid,
                productId: item.productId,
                variantId: item.variantId,
                productName: item.productName,
                size: item.size,
                colorName: item.colorName,
                imageUrl: item.imageUrl || '',
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                updatedAt: serverTimestamp(),
              });
            }
            void batch.commit();
          }
          return [];
        });
      } catch (err) {
        console.error('Gagal menginisialisasi sesi pengguna:', err);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Public Firestore listeners
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'boutique_settings', 'default'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as BoutiqueSettings;
            const resolvedBrandName = data.brandName === 'DINAMIS' ? 'MAILAL BOUTIQ' : data.brandName;
            const resolvedAddress =
              data.address === 'Jl. Kemang Raya No. 48, Jakarta Selatan 12730, Indonesia'
                ? 'JL. Raden Intan-Kartini ( Tanjung Karang ), Lampung'
                : data.address;
            const resolvedWhatsapp =
              data.whatsapp === '+62 812-8890-2410' ? '+62-878-0184-9817' : data.whatsapp;
            setBoutiqueSettings({
              ...DEFAULT_BOUTIQUE_SETTINGS,
              ...data,
              brandName: resolvedBrandName,
              address: resolvedAddress,
              whatsapp: resolvedWhatsapp,
            });
          }
        },
        (error) => handleFirestoreError(error, OperationType.GET, 'boutique_settings/default')
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'payment_settings', 'default'),
        (snap) => {
          if (snap.exists()) {
            setPaymentSettings({ ...DEFAULT_PAYMENT_SETTINGS, ...(snap.data() as PaymentSettings) });
          }
        },
        (error) => handleFirestoreError(error, OperationType.GET, 'payment_settings/default')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'website_banners'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WebsiteBanner, 'id'>) }));
            list.sort((a, b) => a.sortOrder - b.sortOrder);
            setBanners(list);
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'website_banners')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'categories'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }));
            list.sort((a, b) => a.sortOrder - b.sortOrder);
            setCategories(list);
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'categories')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'products'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
            setProducts(list);
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'products')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'product_variants'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductVariant, 'id'>) }));
            setVariants(list);
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'product_variants')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'product_images'),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductImage, 'id'>) }));
          list.sort((a, b) => a.sortOrder - b.sortOrder);
          setProductImages(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'product_images')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'coupons'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Coupon, 'id'>) }));
            setCoupons(list);
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'coupons')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'reviews'),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductReview, 'id'>) }));
          setReviews(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'reviews')
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  // Authenticated customer & staff listeners
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setCartItems(guestCart);
      return;
    }

    const unsubs: Array<() => void> = [];
    const uid = firebaseUser.uid;

    unsubs.push(
      onSnapshot(
        query(collection(db, 'cart_items'), where('userId', '==', uid)),
        (snap) => {
          setCartItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CartItem, 'id'>) })));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'cart_items')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'wishlists'), where('userId', '==', uid)),
        (snap) => {
          setWishlists(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WishlistItem, 'id'>) })));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'wishlists')
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'customers', uid),
        (snap) => {
          if (snap.exists()) {
            setCustomerRecord({ id: snap.id, ...(snap.data() as Omit<CustomerRecord, 'id'>) });
          }
        },
        (error) => handleFirestoreError(error, OperationType.GET, `customers/${uid}`)
      )
    );

    const ordersRef = isStaff
      ? collection(db, 'orders')
      : query(collection(db, 'orders'), where('userId', '==', uid));
    unsubs.push(
      onSnapshot(
        ordersRef,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
          setOrders(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
      )
    );

    const orderItemsRef = isStaff
      ? collection(db, 'order_items')
      : query(collection(db, 'order_items'), where('userId', '==', uid));
    unsubs.push(
      onSnapshot(
        orderItemsRef,
        (snap) => {
          setOrderItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrderItem, 'id'>) })));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'order_items')
      )
    );

    const paymentsRef = isStaff
      ? collection(db, 'payments')
      : query(collection(db, 'payments'), where('userId', '==', uid));
    unsubs.push(
      onSnapshot(
        paymentsRef,
        (snap) => {
          setPayments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRecord, 'id'>) })));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'payments')
      )
    );

    const shipmentsRef = isStaff
      ? collection(db, 'shipments')
      : query(collection(db, 'shipments'), where('userId', '==', uid));
    unsubs.push(
      onSnapshot(
        shipmentsRef,
        (snap) => {
          setShipments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Shipment, 'id'>) })));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'shipments')
      )
    );

    if (isStaff) {
      unsubs.push(
        onSnapshot(
          collection(db, 'customers'),
          (snap) => {
            setAllCustomers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomerRecord, 'id'>) })));
          },
          (error) => handleFirestoreError(error, OperationType.LIST, 'customers')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'stock_movements'),
          (snap) => {
            setStockMovements(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockMovement, 'id'>) })));
          },
          (error) => handleFirestoreError(error, OperationType.LIST, 'stock_movements')
        )
      );
    }

    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            setAllUsers(snap.docs.map((d) => d.data() as UserProfile));
          },
          (error) => handleFirestoreError(error, OperationType.LIST, 'users')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'activity_logs'),
          (snap) => {
            setActivityLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) })));
          },
          (error) => handleFirestoreError(error, OperationType.LIST, 'activity_logs')
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, firebaseUser, isStaff, isAdmin, guestCart]);

  const wishlistIds = useMemo(() => wishlists.map((w) => w.productId), [wishlists]);

  // ─── Auth Actions ────────────────────────────────────────────────────────
  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
    showToast('success', 'Berhasil masuk dengan akun Google.');
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    showToast('success', 'Selamat datang kembali.');
  };

  const registerWithEmail = async (name: string, email: string, password: string, phone?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email: email.trim(),
      displayName: name.trim(),
      phone: phone?.trim() || '',
      role: 'PELANGGAN',
      isActive: true,
      photoUrl: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'customers', cred.user.uid), {
      userId: cred.user.uid,
      fullName: name.trim(),
      phone: phone?.trim() || '',
      email: email.trim(),
      addresses: [],
      totalOrders: 0,
      totalSpent: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Verification email is best-effort
    }
    showToast('success', 'Registrasi berhasil! Akun pelanggan Anda sudah aktif.');
  };

  const requestPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
    showToast('success', 'Tautan reset kata sandi telah dikirim ke email Anda.');
  };

  const changePassword = async (newPassword: string) => {
    if (!auth.currentUser) throw new Error('Silakan masuk terlebih dahulu.');
    await updatePassword(auth.currentUser, newPassword);
    showToast('success', 'Kata sandi berhasil diperbarui.');
  };

  const logout = async () => {
    await signOut(auth);
    showToast('info', 'Anda telah keluar dari akun.');
  };

  const updateAccountProfile = async (displayName: string, phone: string) => {
    if (!firebaseUser) throw new Error('Autentikasi diperlukan.');
    try {
      await updateProfile(firebaseUser, { displayName: displayName.trim() });
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        displayName: displayName.trim(),
        phone: phone.trim(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'customers', firebaseUser.uid), {
        fullName: displayName.trim(),
        phone: phone.trim(),
        updatedAt: serverTimestamp(),
      });
      showToast('success', 'Informasi profil berhasil diperbarui.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
    }
  };

  const saveCustomerAddresses = async (addresses: SavedAddress[]) => {
    if (!firebaseUser) throw new Error('Autentikasi diperlukan.');
    try {
      await updateDoc(doc(db, 'customers', firebaseUser.uid), {
        addresses: addresses.slice(0, 10),
        updatedAt: serverTimestamp(),
      });
      showToast('success', 'Alamat pengiriman berhasil disimpan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `customers/${firebaseUser.uid}`);
    }
  };

  // ─── Storefront Actions ──────────────────────────────────────────────────
  const addToCart = async (product: Product, variant: ProductVariant, quantity: number) => {
    if (variant.stock < quantity) {
      showToast('error', `Stok varian ${variant.colorName} (${variant.size}) hanya tersisa ${variant.stock} pcs.`);
      return;
    }
    const basePrice = product.discountPrice && product.discountPrice > 0 ? product.discountPrice : product.price;
    const unitPrice = Math.max(0, basePrice + (variant.priceAdjustment || 0));

    if (!firebaseUser) {
      setGuestCart((prev) => {
        const existing = prev.find((i) => i.variantId === variant.id);
        if (existing) {
          const nextQty = Math.min(variant.stock, existing.quantity + quantity);
          return prev.map((i) => (i.variantId === variant.id ? { ...i, quantity: nextQty } : i));
        }
        return [
          ...prev,
          {
            id: `guest_${variant.id}`,
            userId: 'guest',
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            size: variant.size,
            colorName: variant.colorName,
            imageUrl: product.thumbnailUrl,
            unitPrice,
            quantity,
          },
        ];
      });
      showToast('success', `${product.name} (${variant.colorName}, ${variant.size}) ditambahkan ke keranjang.`);
      return;
    }

    const itemId = `${firebaseUser.uid}_${variant.id}`;
    const existing = cartItems.find((i) => i.variantId === variant.id);
    const nextQty = existing ? Math.min(variant.stock, existing.quantity + quantity) : quantity;

    try {
      await setDoc(doc(db, 'carts', firebaseUser.uid), {
        userId: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'cart_items', itemId), {
        userId: firebaseUser.uid,
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        size: variant.size,
        colorName: variant.colorName,
        imageUrl: product.thumbnailUrl,
        unitPrice,
        quantity: nextQty,
        updatedAt: serverTimestamp(),
      });
      showToast('success', `${product.name} (${variant.colorName}, ${variant.size}) ditambahkan ke keranjang.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `cart_items/${itemId}`);
    }
  };

  const updateCartItemQuantity = async (itemId: string, quantity: number) => {
    const item = cartItems.find((i) => i.id === itemId);
    if (!item) return;
    const variant = variants.find((v) => v.id === item.variantId);
    const maxStock = variant ? variant.stock : 99;
    const clampedQty = Math.max(1, Math.min(maxStock, quantity));

    if (!firebaseUser) {
      setGuestCart((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity: clampedQty } : i)));
      return;
    }
    try {
      await updateDoc(doc(db, 'cart_items', itemId), {
        quantity: clampedQty,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cart_items/${itemId}`);
    }
  };

  const updateCartItemVariant = async (itemId: string, newVariant: ProductVariant) => {
    const item = cartItems.find((i) => i.id === itemId);
    if (!item) return;
    const product = products.find((p) => p.id === item.productId);
    if (!product) return;
    if (newVariant.stock < 1) {
      showToast('error', 'Stok varian yang dipilih sedang kosong.');
      return;
    }
    const basePrice = product.discountPrice && product.discountPrice > 0 ? product.discountPrice : product.price;
    const unitPrice = Math.max(0, basePrice + (newVariant.priceAdjustment || 0));
    const clampedQty = Math.min(item.quantity, newVariant.stock);

    if (!firebaseUser) {
      setGuestCart((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                variantId: newVariant.id,
                size: newVariant.size,
                colorName: newVariant.colorName,
                unitPrice,
                quantity: clampedQty,
              }
            : i
        )
      );
      return;
    }

    try {
      const newDocId = `${firebaseUser.uid}_${newVariant.id}`;
      const batch = writeBatch(db);
      if (newDocId !== itemId) {
        batch.delete(doc(db, 'cart_items', itemId));
      }
      batch.set(doc(db, 'cart_items', newDocId), {
        userId: firebaseUser.uid,
        productId: product.id,
        variantId: newVariant.id,
        productName: product.name,
        size: newVariant.size,
        colorName: newVariant.colorName,
        imageUrl: product.thumbnailUrl,
        unitPrice,
        quantity: clampedQty,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `cart_items/${itemId}`);
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (!firebaseUser) {
      setGuestCart((prev) => prev.filter((i) => i.id !== itemId));
      return;
    }
    try {
      await deleteDoc(doc(db, 'cart_items', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `cart_items/${itemId}`);
    }
  };

  const toggleWishlist = async (productId: string) => {
    if (!firebaseUser) {
      showToast('info', 'Silakan masuk ke akun terlebih dahulu untuk menyimpan wishlist.');
      return;
    }
    const wishlistId = `${firebaseUser.uid}_${productId}`;
    const existsInWish = wishlists.some((w) => w.productId === productId);
    try {
      if (existsInWish) {
        await deleteDoc(doc(db, 'wishlists', wishlistId));
        showToast('info', 'Produk dihapus dari wishlist.');
      } else {
        await setDoc(doc(db, 'wishlists', wishlistId), {
          userId: firebaseUser.uid,
          productId,
          createdAt: serverTimestamp(),
        });
        showToast('success', 'Produk disimpan ke wishlist.');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `wishlists/${wishlistId}`);
    }
  };

  const submitReview = async (productId: string, rating: number, comment: string) => {
    if (!firebaseUser) {
      throw new Error('Silakan masuk untuk menulis ulasan.');
    }
    const reviewId = `rev_${firebaseUser.uid}_${productId}`;
    try {
      await setDoc(doc(db, 'reviews', reviewId), {
        productId,
        userId: firebaseUser.uid,
        userName: userProfile?.displayName || firebaseUser.displayName || 'Pelanggan',
        rating: Math.max(1, Math.min(5, rating)),
        comment: comment.trim().slice(0, 1000),
        isApproved: true,
        createdAt: serverTimestamp(),
      });
      showToast('success', 'Terima kasih atas ulasan Anda.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `reviews/${reviewId}`);
    }
  };

  const placeOrder = async (
    input: PlaceOrderInput
  ): Promise<{ orderId: string; invoiceNumber: string; paymentId: string }> => {
    if (!firebaseUser) {
      throw new Error('Silakan masuk ke akun Anda sebelum menyelesaikan pesanan.');
    }
    if (cartItems.length === 0) {
      throw new Error('Keranjang belanja Anda masih kosong.');
    }

    const invoiceNumber = generateInvoiceNumber();
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const paymentId = `pay_${orderId}`;
    const shipmentId = `shp_${orderId}`;

    try {
      await runTransaction(db, async (tx) => {
        // 1. Read and validate all product variants & products
        const variantReads = await Promise.all(
          cartItems.map(async (item) => {
            const vRef = doc(db, 'product_variants', item.variantId);
            const pRef = doc(db, 'products', item.productId);
            const [vSnap, pSnap] = await Promise.all([tx.get(vRef), tx.get(pRef)]);
            if (!vSnap.exists()) {
              throw new Error(`Varian produk ${item.productName} tidak ditemukan di database.`);
            }
            if (!pSnap.exists()) {
              throw new Error(`Produk ${item.productName} tidak ditemukan di database.`);
            }
            const vData = vSnap.data() as Omit<ProductVariant, 'id'>;
            const pData = pSnap.data() as Omit<Product, 'id'>;
            if (vData.stock < item.quantity) {
              throw new Error(
                `Stok ${item.productName} (${item.colorName} - ${item.size}) tersisa ${vData.stock} pcs.`
              );
            }
            return { item, vRef, vData, pRef, pData };
          })
        );

        // 2. Validate optional coupon
        let couponDocRef: ReturnType<typeof doc> | null = null;
        let couponData: Omit<Coupon, 'id'> | null = null;
        const normalizedCode = input.couponCode?.trim().toUpperCase();
        if (normalizedCode) {
          const matched = coupons.find((c) => c.code.toUpperCase() === normalizedCode);
          if (matched) {
            const cRef = doc(db, 'coupons', matched.id);
            const cSnap = await tx.get(cRef);
            if (cSnap.exists()) {
              const cd = cSnap.data() as Omit<Coupon, 'id'>;
              if (cd.isActive && cd.usedCount < cd.usageLimit) {
                couponDocRef = cRef;
                couponData = cd;
              }
            }
          }
        }

        // Read customer record for cumulative metrics
        const custRef = doc(db, 'customers', firebaseUser.uid);
        const custSnap = await tx.get(custRef);

        // 3. Calculate totals cleanly
        let subtotal = 0;
        for (const r of variantReads) {
          const basePrice =
            r.pData.discountPrice && r.pData.discountPrice > 0 ? r.pData.discountPrice : r.pData.price;
          const unitPrice = Math.max(0, basePrice + (r.vData.priceAdjustment || 0));
          subtotal += unitPrice * r.item.quantity;
        }

        let discountAmount = 0;
        if (couponData && subtotal >= couponData.minPurchase) {
          if (couponData.type === 'PERCENTAGE') {
            discountAmount = Math.round((subtotal * couponData.value) / 100);
            if (couponData.maxDiscount && couponData.maxDiscount > 0) {
              discountAmount = Math.min(discountAmount, couponData.maxDiscount);
            }
          } else {
            discountAmount = Math.min(subtotal, couponData.value);
          }
        }

        const afterDiscount = Math.max(0, subtotal - discountAmount);
        const shippingCost =
          afterDiscount >= paymentSettings.freeShippingThreshold ? 0 : paymentSettings.shippingBaseCost;
        const totalAmount = afterDiscount + shippingCost;

        if (input.paymentMethod === 'COD') {
          if (!paymentSettings.codEnabled) {
            throw new Error('Metode pembayaran COD sedang dinonaktifkan.');
          }
          if (paymentSettings.codMaxAmount > 0 && totalAmount > paymentSettings.codMaxAmount) {
            throw new Error('Total pesanan melebihi batas maksimal layanan COD.');
          }
        }

        const initialOrderStatus: OrderStatus =
          input.paymentMethod === 'COD' ? 'SEDANG_DIPROSES' : 'MENUNGGU_PEMBAYARAN';
        const initialPaymentStatus: PaymentStatus = 'BELUM_DIBAYAR';

        // 4. Write Order
        tx.set(doc(db, 'orders', orderId), {
          invoiceNumber,
          userId: firebaseUser.uid,
          customerName: input.customerName.trim(),
          customerPhone: input.customerPhone.trim(),
          customerEmail: input.customerEmail.trim(),
          shippingAddress: input.shippingAddress,
          notes: (input.notes || '').trim(),
          subtotal,
          discountAmount,
          couponCode: couponData ? couponData.code : '',
          shippingCost,
          totalAmount,
          paymentMethod: input.paymentMethod,
          paymentStatus: initialPaymentStatus,
          orderStatus: initialOrderStatus,
          statusHistory: [
            {
              status: initialOrderStatus,
              note:
                input.paymentMethod === 'COD'
                  ? 'Pesanan COD dibuat dan diteruskan ke proses persiapan.'
                  : 'Pesanan dibuat, menunggu pembayaran pelanggan.',
              changedBy: input.customerName.trim(),
              changedAt: new Date().toISOString(),
            },
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 5. Write Order Items, decrement variant & product stock, log stock movements
        for (const r of variantReads) {
          const basePrice =
            r.pData.discountPrice && r.pData.discountPrice > 0 ? r.pData.discountPrice : r.pData.price;
          const unitPrice = Math.max(0, basePrice + (r.vData.priceAdjustment || 0));
          const newVarStock = r.vData.stock - r.item.quantity;
          const newProdStock = Math.max(0, r.pData.totalStock - r.item.quantity);

          tx.update(r.vRef, {
            stock: newVarStock,
            updatedAt: serverTimestamp(),
          });
          tx.update(r.pRef, {
            totalStock: newProdStock,
            soldCount: (r.pData.soldCount || 0) + r.item.quantity,
            updatedAt: serverTimestamp(),
          });

          const oiId = `oi_${orderId}_${r.item.variantId}`;
          tx.set(doc(db, 'order_items', oiId), {
            orderId,
            userId: firebaseUser.uid,
            productId: r.item.productId,
            variantId: r.item.variantId,
            productName: r.pData.name,
            sku: r.vData.sku,
            size: r.vData.size,
            colorName: r.vData.colorName,
            imageUrl: r.pData.thumbnailUrl,
            quantity: r.item.quantity,
            unitPrice,
            costPrice: r.pData.costPrice || 0,
            subtotal: unitPrice * r.item.quantity,
            createdAt: serverTimestamp(),
          });

          const smId = `sm_${orderId}_${r.item.variantId}`;
          tx.set(doc(db, 'stock_movements', smId), {
            productId: r.item.productId,
            productName: r.pData.name,
            variantId: r.item.variantId,
            variantLabel: `${r.vData.colorName} - ${r.vData.size}`,
            type: 'SALE',
            quantityChange: -r.item.quantity,
            previousStock: r.vData.stock,
            newStock: newVarStock,
            reason: `Penjualan pesanan ${invoiceNumber}`,
            referenceId: orderId,
            actorId: firebaseUser.uid,
            actorName: input.customerName.trim(),
            createdAt: serverTimestamp(),
          });
        }

        // 6. Write Payment record
        tx.set(doc(db, 'payments', paymentId), {
          orderId,
          invoiceNumber,
          userId: firebaseUser.uid,
          method: input.paymentMethod,
          amount: totalAmount,
          status: initialPaymentStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 7. Write Shipment record
        tx.set(doc(db, 'shipments', shipmentId), {
          orderId,
          invoiceNumber,
          userId: firebaseUser.uid,
          courier: 'Belum Ditentukan',
          shippingService: 'Reguler',
          trackingNumber: '',
          shippingCost,
          status: 'MENUNGGU',
          estimatedDelivery: '2-4 hari kerja',
          updatedAt: serverTimestamp(),
        });

        // 8. Increment coupon usage if applied
        if (couponDocRef && couponData) {
          tx.update(couponDocRef, {
            usedCount: couponData.usedCount + 1,
            updatedAt: serverTimestamp(),
          });
        }

        // 9. Update customer cumulative stats
        if (custSnap.exists()) {
          const cData = custSnap.data() as CustomerRecord;
          tx.update(custRef, {
            totalOrders: (cData.totalOrders || 0) + 1,
            totalSpent: (cData.totalSpent || 0) + totalAmount,
            updatedAt: serverTimestamp(),
          });
        }

        // 10. Clear user's cart items
        for (const item of cartItems) {
          tx.delete(doc(db, 'cart_items', item.id));
        }
      });

      showToast('success', `Pesanan ${invoiceNumber} berhasil dibuat!`);
      return { orderId, invoiceNumber, paymentId };
    } catch (err) {
      if (err instanceof Error && !err.message.includes('Missing or insufficient permissions')) {
        throw err;
      }
      handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
    }
  };

  const submitBankTransferProof = async (
    orderId: string,
    paymentId: string,
    proofImageUrl: string,
    bankName: string
  ) => {
    if (!firebaseUser) throw new Error('Autentikasi diperlukan.');
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) throw new Error('Pesanan tidak ditemukan.');
      const existingOrder = orderSnap.data() as Order;

      const batch = writeBatch(db);
      batch.update(doc(db, 'payments', paymentId), {
        proofImageUrl,
        bankName,
        status: 'MENUNGGU_VERIFIKASI',
        updatedAt: serverTimestamp(),
      });
      batch.update(orderRef, {
        paymentStatus: 'MENUNGGU_VERIFIKASI',
        orderStatus: 'MENUNGGU_VERIFIKASI',
        statusHistory: [
          ...(existingOrder.statusHistory || []),
          {
            status: 'MENUNGGU_VERIFIKASI',
            note: `Bukti transfer (${bankName}) telah diunggah, menunggu verifikasi admin.`,
            changedBy: userProfile?.displayName || 'Pelanggan',
            changedAt: new Date().toISOString(),
          },
        ],
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      showToast('success', 'Bukti transfer berhasil dikirim dan menunggu verifikasi admin.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payments/${paymentId}`);
    }
  };

  const cancelCustomerOrder = async (orderId: string, reason: string) => {
    if (!firebaseUser) throw new Error('Autentikasi diperlukan.');
    try {
      const orderRef = doc(db, 'orders', orderId);
      const snap = await getDoc(orderRef);
      if (!snap.exists()) throw new Error('Pesanan tidak ditemukan.');
      const orderData = snap.data() as Order;

      await updateDoc(orderRef, {
        orderStatus: 'DIBATALKAN',
        statusHistory: [
          ...(orderData.statusHistory || []),
          {
            status: 'DIBATALKAN',
            note: reason || 'Dibatalkan oleh pelanggan.',
            changedBy: userProfile?.displayName || 'Pelanggan',
            changedAt: new Date().toISOString(),
          },
        ],
        updatedAt: serverTimestamp(),
      });
      showToast('info', 'Pesanan berhasil dibatalkan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const logActivity = async (action: string, targetType: string, targetId?: string, details?: string) => {
    if (!firebaseUser || !isStaff) return;
    try {
      const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await setDoc(doc(db, 'activity_logs', logId), {
        actorId: firebaseUser.uid,
        actorName: userProfile?.displayName || firebaseUser.email || 'Admin',
        actorRole: role,
        action: action.slice(0, 120),
        targetType: targetType.slice(0, 80),
        targetId: (targetId || '').slice(0, 128),
        details: (details || '').slice(0, 500),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Gagal mencatat audit log:', err);
    }
  };

  return (
    <StoreContext.Provider
      value={{
        authReady,
        firebaseUser,
        userProfile,
        customerRecord,
        isStaff,
        isAdmin,
        isSuperAdmin,
        boutiqueSettings,
        paymentSettings,
        banners,
        categories,
        products,
        variants,
        productImages,
        coupons,
        reviews,
        cartItems,
        wishlistIds,
        wishlists,
        orders,
        orderItems,
        payments,
        shipments,
        allUsers,
        allCustomers,
        stockMovements,
        activityLogs,
        toastMessage,
        showToast,
        clearToast,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        requestPasswordReset,
        changePassword,
        logout,
        updateAccountProfile,
        saveCustomerAddresses,
        addToCart,
        updateCartItemQuantity,
        updateCartItemVariant,
        removeFromCart,
        toggleWishlist,
        submitReview,
        placeOrder,
        submitBankTransferProof,
        cancelCustomerOrder,
        logActivity,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore harus digunakan di dalam StoreProvider.');
  return ctx;
}
