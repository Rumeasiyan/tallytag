import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "TALLYTAG",
  description: "Count and check office assets with phones, even offline.",
  manifest: "/manifest.json",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a6a66" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>
          <Shell>{children}</Shell>
        </I18nProvider>
      </body>
    </html>
  );
}
