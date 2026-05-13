// Launch-state helpers. Server-readable env vars that control whether the
// site shows live on-chain data or the pre-launch teaser state.
//
// Set via systemd Environment= in /etc/systemd/system/cryptobulls-web.service.
//
// NEXT_PUBLIC_LAUNCH_STATE:
//   "pre-launch"  - hide live stats, feed, herd; show "launching soon" CTAs
//   "live"        - show full functionality (default)
//
// NEXT_PUBLIC_TOKEN_MINT:
//   Pump.fun $BULLS mint address (base58). When set, displayed publicly
//   so visitors can verify the contract. Blank until the user launches
//   on pump.fun.

export type LaunchState = "pre-launch" | "live";

export function getLaunchState(): LaunchState {
  const v = process.env.NEXT_PUBLIC_LAUNCH_STATE;
  return v === "pre-launch" ? "pre-launch" : "live";
}

export function isPreLaunch(): boolean {
  return getLaunchState() === "pre-launch";
}

export function getTokenMint(): string | null {
  const v = (process.env.NEXT_PUBLIC_TOKEN_MINT || "").trim();
  if (!v) return null;
  // Sanity: 32-44 char base58
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return null;
  return v;
}
