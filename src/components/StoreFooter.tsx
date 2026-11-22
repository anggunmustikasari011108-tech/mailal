'use client';

import React, { useState } from 'react';
import { Instagram, Mail, MapPin, Phone, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { sanitizeImageUrl } from '../lib/formatters';

export const StoreFooter: React.FC = () => {
  const { boutiqueSettings } = useStore();
  const [policyModal, setPolicyModal] = useState<{ title: string; body: string } | null>(null);

  const logoSrc =
    sanitizeImageUrl(boutiqueSettings.logoUrl) ||
    '/assets/aistudio/Logo_Boutique_Hijab_Mailal_Elegan_47622cbc.png';

  return (
    <footer className="bg-[#394536] text-[#F7F2E8] border-t border-[#87977B]/30 no-print">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-14 grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-5 space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={logoSrc}
              alt={boutiqueSettings.brandName}
              className="w-12 h-12 rounded-full object-contain bg-[#F7F2E8] p-0.5"
            />
            <div>
              <p className="font-serif text-2xl font-semibold tracking-wide text-white">
                {boutiqueSettings.brandName}
              </p>
              <p className="text-xs text-[#C5A46D]">{boutiqueSettings.projectName}</p>
            </div>
          </div>
          <p className="text-sm text-[#F7F2E8]/80 leading-relaxed max-w-md">
            {boutiqueSettings.brandDescription}
          </p>
        </div>

        <div className="md:col-span-4 space-y-3 text-sm">
          <h3 className="font-serif text-lg font-semibold text-white">Informasi Butik</h3>
          <p className="flex items-start gap-2.5 text-[#F7F2E8]/85">
            <MapPin className="w-4 h-4 text-[#C5A46D] shrink-0 mt-0.5" />
            <span>{boutiqueSettings.address}</span>
          </p>
          <p className="flex items-center gap-2.5 text-[#F7F2E8]/85">
            <Phone className="w-4 h-4 text-[#C5A46D] shrink-0" />
            <span>WhatsApp: {boutiqueSettings.whatsapp}</span>
          </p>
          <p className="flex items-center gap-2.5 text-[#F7F2E8]/85">
            <Instagram className="w-4 h-4 text-[#C5A46D] shrink-0" />
            <span>Instagram: {boutiqueSettings.instagram}</span>
          </p>
          <p className="flex items-center gap-2.5 text-[#F7F2E8]/85">
            <Mail className="w-4 h-4 text-[#C5A46D] shrink-0" />
            <span>Email: {boutiqueSettings.email}</span>
          </p>
        </div>

        <div className="md:col-span-3 space-y-3 text-sm">
          <h3 className="font-serif text-lg font-semibold text-white">Layanan & Kebijakan</h3>
          <ul className="space-y-2 text-[#F7F2E8]/85">
            <li>
              <button
                type="button"
                onClick={() =>
                  setPolicyModal({
                    title: 'Kebijakan Privasi',
                    body: boutiqueSettings.privacyPolicy,
                  })
                }
                className="hover:text-[#C5A46D] transition-colors text-left"
              >
                Kebijakan Privasi
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() =>
                  setPolicyModal({
                    title: 'Syarat dan Ketentuan',
                    body: boutiqueSettings.termsAndConditions,
                  })
                }
                className="hover:text-[#C5A46D] transition-colors text-left"
              >
                Syarat dan Ketentuan
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() =>
                  setPolicyModal({
                    title: 'Kebijakan Pengembalian',
                    body: boutiqueSettings.returnPolicy,
                  })
                }
                className="hover:text-[#C5A46D] transition-colors text-left"
              >
                Kebijakan Pengembalian
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() =>
                  setPolicyModal({
                    title: 'Informasi Pengiriman',
                    body: boutiqueSettings.shippingPolicy,
                  })
                }
                className="hover:text-[#C5A46D] transition-colors text-left"
              >
                Informasi Pengiriman
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#F7F2E8]/10 px-4 sm:px-6 lg:px-10 py-5 max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#F7F2E8]/65">
        <span>
          © {new Date().getFullYear()} {boutiqueSettings.brandName} · {boutiqueSettings.projectName}
        </span>
        <span>Jam Operasional: {boutiqueSettings.operatingHours}</span>
      </div>

      {policyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#FCFAF6] text-[#394536] border border-[#E5DFD3] rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-3">
              <h4 className="font-serif text-2xl font-semibold">{policyModal.title}</h4>
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                className="p-1.5 rounded-lg hover:bg-[#F7F2E8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-[#394536] whitespace-pre-line">{policyModal.body}</p>
          </div>
        </div>
      )}
    </footer>
  );
};
