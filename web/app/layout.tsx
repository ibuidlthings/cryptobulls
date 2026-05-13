import type { Metadata } from "next";
import "./globals.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import WalletProviders from "./components/WalletProviders";

export const metadata: Metadata = {
  title: "CryptoBulls - Hybrid token-NFT layer for pump.fun",
  description:
    "The first hybrid token-NFT layer for pump.fun-launched memecoins. Wrap 1,000,000 $BULLS into a tradeable bull NFT. The vault follows the NFT through every marketplace transfer.",
  metadataBase: new URL("https://cryptobulls.fun"),
  // Trust / discoverability signals for wallet review processes
  // (Phantom Blowfish, Magic Eden / Tensor crawlers).
  applicationName: "CryptoBulls",
  authors: [{ name: "CryptoBulls", url: "https://github.com/ibuidlthings/cryptobulls" }],
  creator: "CryptoBulls",
  publisher: "CryptoBulls",
  keywords: ["solana", "pump.fun", "memecoin", "nft", "metaplex", "$BULLS", "CryptoBulls"],
  category: "decentralized-application",
  alternates: {
    canonical: "https://cryptobulls.fun",
  },
  openGraph: {
    title: "CryptoBulls",
    description: "Hybrid token-NFT layer for pump.fun. Wrap. Trade. Unwrap.",
    url: "https://cryptobulls.fun",
    siteName: "CryptoBulls",
    type: "website",
    images: ["/mascot.png"],
  },
  twitter: {
    card: "summary_large_image",
    site: "@CTBullsfun",
    creator: "@CTBullsfun",
    images: ["/mascot.png"],
  },
  icons: { icon: "/mascot.png" },
  other: {
    // Solana ecosystem signals - what wallet/marketplace crawlers look for
    // when deciding whether a dApp is trustworthy enough to allow connect.
    "solana:network": "mainnet-beta",
    "solana:program-id": "A2tUttiL2v2fYxPyeUSZ75CqnjDp5sewCqcnXubgoxm",
    "dapp:source": "https://github.com/ibuidlthings/cryptobulls",
    "dapp:twitter": "https://x.com/CTBullsfun",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProviders>
          <Header />
          {children}
          <Footer />
        </WalletProviders>
      </body>
    </html>
  );
}
