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
          <a
            href="https://github.com/ibuidlthings/cryptobulls"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="CryptoBulls on GitHub"
            className="text-[var(--bull-dim)] hover:text-[var(--bull-accent)] transition-colors p-2 rounded-md"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </a>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
