import type { Metadata, Viewport } from 'next';
import ServiceWorkerRegister from './sw-register';
import './globals.css';

export const metadata: Metadata = {
  title: '客户管理与SKU价格管理系统',
  description: 'PWA客户订单管理系统 - 开单、SKU管理、PDF打印',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '订单管理',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
