import type { Metadata } from 'next';
import { Assistant } from 'next/font/google';
import './globals.css';

const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  variable: '--font-assistant',
});

export const metadata: Metadata = {
  title: 'Shared Document',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${assistant.className} antialiased bg-gray-50 m-0`}>
        {children}
      </body>
    </html>
  );
}
