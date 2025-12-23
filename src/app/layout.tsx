import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MainLayout } from "@/components/Layout/MainLayout";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "RebelX Headquarters | Unified ERP",
  description: "Advanced ERP system for RebelX operations, CRM, and warehouse management.",
  icons: {
    icon: "https://res.cloudinary.com/dwkq4s4rg/image/upload/v1766349101/rebelx-headquarters/assets/rebelx_favicon_new.png",
    shortcut: "https://res.cloudinary.com/dwkq4s4rg/image/upload/v1766349101/rebelx-headquarters/assets/rebelx_favicon_new.png",
    apple: "https://res.cloudinary.com/dwkq4s4rg/image/upload/v1766349101/rebelx-headquarters/assets/rebelx_favicon_new.png",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="antialiased">
        <Providers>
          <MainLayout>
            {children}
          </MainLayout>
        </Providers>
      </body>
    </html>
  );
}
