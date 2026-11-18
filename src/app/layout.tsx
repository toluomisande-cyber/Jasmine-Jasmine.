import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '../components/Providers';

export const metadata: Metadata = {
  title: 'Jasmine',
  description: 'Jasmine — Personal AI Assistant',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Jasmine',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[var(--j-bg)] text-[var(--j-text)] font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
