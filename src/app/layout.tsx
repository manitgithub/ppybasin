import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "SMART BASIN | ระบบอัจฉริยะลุ่มน้ำป่าพะยอม",
  description: "Dashboard สำหรับติดตามสถานการณ์น้ำและศูนย์อพยพในลุ่มน้ำป่าพะยอม",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${notoThai.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
