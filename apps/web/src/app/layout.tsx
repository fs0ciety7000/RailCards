import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RailCards",
    template: "%s · RailCards",
  },
  description: "Le jeu de cartes à collectionner de l'univers ferroviaire belge.",
};

export const viewport: Viewport = {
  themeColor: "#0b1a33",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
