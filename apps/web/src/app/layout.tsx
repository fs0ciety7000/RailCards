import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Space_Grotesk } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// Display face reserved for page titles, the wordmark, CR amounts/stat
// numbers and card names — see --font-display in globals.css.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

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
    <html lang="fr" className={`dark ${GeistSans.variable} ${spaceGrotesk.variable}`}>
      <body>
        {/* Single, stable anchor for globals.css's stacking-context rule (keeps
            page content above the body::before noise texture) — scoped to an
            id rather than "body > div" so it never matches portalled overlays
            (Dialog, Toast) that also mount directly under <body>. */}
        <div id="rc-app-root">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
