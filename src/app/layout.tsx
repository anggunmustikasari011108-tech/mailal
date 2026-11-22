import type { Metadata } from 'next';
import { Cormorant_Garamond, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from '../components/Providers';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'MAILAL BOUTIQ HIJAB DAN BUSANA',
  description:
    'Website E-Commerce Fashion Muslimah Modern & Elegan dengan Sistem Manajemen Boutique Terintegrasi.',
  icons: {
    icon: '/assets/aistudio/Logo_Boutique_Hijab_Mailal_Elegan_47622cbc.png',
  },
  openGraph: {
    title: 'MAILAL BOUTIQ HIJAB DAN BUSANA',
    description:
      'Website E-Commerce Fashion Muslimah Modern & Elegan dengan Sistem Manajemen Boutique Terintegrasi.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MAILAL BOUTIQ HIJAB DAN BUSANA',
    description:
      'Website E-Commerce Fashion Muslimah Modern & Elegan dengan Sistem Manajemen Boutique Terintegrasi.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${cormorant.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
