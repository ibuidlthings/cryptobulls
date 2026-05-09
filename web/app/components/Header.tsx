"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "./ConnectButton";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/wrap", label: "Wrap" },
  { href: "/unwrap", label: "Unwrap" },
  { href: "/gallery", label: "Gallery" },
  { href: "/thesis", label: "Thesis" },
  { href: "/tech", label: "Tech" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[rgba(10,10,12,0.85)] border-b border-[#1a1a22]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <img
            src="/mascot.png"
            alt="CryptoBulls"
            width={36}
            height={36}
            className="pixelated rounded-md"
          />
          <span className="font-extrabold text-lg tracking-tight">
            <span style={{ color: "var(--bull-accent)" }}>Crypto</span>Bulls
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {NAV.slice(1).map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-2 rounded-md transition-colors ${
                  active ? "text-[var(--bull-accent)]" : "text-[var(--bull-dim)] hover:text-[var(--bull-ink)]"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="https://x.com/CTBullsfun"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="CryptoBulls on X"
            className="text-[var(--bull-dim)] hover:text-[var(--bull-accent)] transition-colors p-2 rounded-md"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.819L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
