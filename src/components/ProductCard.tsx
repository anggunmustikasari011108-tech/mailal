'use client';

import React from 'react';
import { Eye, Heart } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatIDR, sanitizeImageUrl } from '../lib/formatters';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  const { wishlistIds, toggleWishlist } = useStore();
  const isWishlisted = wishlistIds.includes(product.id);
  const hasDiscount = Boolean(product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price);
  const finalPrice = hasDiscount ? Number(product.discountPrice) : product.price;
  const imgSrc = sanitizeImageUrl(product.thumbnailUrl);

  const kickerLabel = product.isNewArrival
    ? 'Koleksi Terbaru'
    : product.isBestSeller
    ? 'Terlaris'
    : product.isExclusive
    ? 'Eksklusif'
    : product.categoryName;

  return (
    <article className="group bg-white border border-[#E5DFD3] rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[3/4] bg-[#F7F2E8] overflow-hidden">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            referrerPolicy="no-referrer"
            onClick={() => onSelect(product)}
            className="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            onClick={() => onSelect(product)}
            className="w-full h-full flex items-center justify-center p-6 text-center cursor-pointer bg-gradient-to-br from-[#F7F2E8] to-[#EAE2D3]"
          >
            <span className="font-serif text-lg text-[#817B72]">{product.name}</span>
          </div>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void toggleWishlist(product.id);
          }}
          aria-label={isWishlisted ? 'Hapus dari Wishlist' : 'Simpan ke Wishlist'}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-colors border ${
            isWishlisted
              ? 'bg-[#394536] border-[#394536] text-white'
              : 'bg-white/90 border-[#E5DFD3] text-[#394536] hover:bg-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>

        {product.totalStock <= 0 && (
          <div className="absolute inset-x-0 bottom-0 bg-[#394536]/85 text-[#FCFAF6] text-xs font-medium py-1.5 text-center">
            Stok Habis
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-wider uppercase text-[#817B72] mb-1">
            {kickerLabel}
            {hasDiscount ? ' · Diskon' : ''}
          </p>
          <h3
            onClick={() => onSelect(product)}
            className="font-serif text-lg font-semibold text-[#394536] leading-snug cursor-pointer hover:text-[#87977B] transition-colors line-clamp-2"
          >
            {product.name}
          </h3>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-baseline gap-2 flex-wrap tabular-nums">
            <span className="text-base font-semibold text-[#394536]">{formatIDR(finalPrice)}</span>
            {hasDiscount && (
              <span className="text-xs text-[#817B72] line-through">{formatIDR(product.price)}</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelect(product)}
            className="w-full py-2.5 px-4 rounded-lg border border-[#87977B] text-[#394536] text-xs sm:text-sm font-medium hover:bg-[#87977B] hover:text-white transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Eye className="w-4 h-4" />
            <span>Lihat Detail</span>
          </button>
        </div>
      </div>
    </article>
  );
};
