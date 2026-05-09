"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function ConnectButton() {
  return (
    <div className="cb-wallet-btn">
      <WalletMultiButton />
      <style jsx global>{`
        .cb-wallet-btn .wallet-adapter-button {
          background: var(--bull-accent) !important;
          color: #1a1a00 !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          height: 38px !important;
          padding: 0 16px !important;
          border-radius: 8px !important;
        }
        .cb-wallet-btn .wallet-adapter-button:hover {
          background: var(--bull-accent-hi) !important;
        }
        .cb-wallet-btn .wallet-adapter-button:not([disabled]):hover {
          background: var(--bull-accent-hi) !important;
        }
        .cb-wallet-btn .wallet-adapter-button-trigger {
          background: var(--bull-accent) !important;
        }
      `}</style>
    </div>
  );
}
