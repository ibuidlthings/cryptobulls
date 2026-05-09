// GET /api/metadata/collection - Metaplex JSON for the collection NFT itself.
// The on-chain metadata account for the Metaplex Certified Collection (MCC)
// parent points at this URI, so Magic Eden / Tensor / Phantom resolve the
// collection's display name, banner, and description from here.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getOrigin(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = fwd || req.headers.get("host") || "cryptobulls.fun";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const origin = getOrigin(req);
  // Use the existing mascot as the collection icon (256x256 pixel art bull).
  // The collection has no per-bull traits — bulls themselves carry the
  // attributes; this object describes the parent collection.
  const image = `${origin}/mascot.png`;

  const metadata = {
    name: "CryptoBulls",
    symbol: "BULLS",
    description:
      "CryptoBulls is a hybrid token-NFT layer for pump.fun-launched " +
      "memecoins. Each bull NFT locks 1,000,000 $BULLS in a vault PDA " +
      "whose authority is derived from the NFT's mint address — sell the " +
      "NFT, the tokens follow. Tradeable on Magic Eden and Tensor; " +
      "unwrap any time to redeem the underlying $BULLS.",
    image,
    external_url: origin,
    properties: {
      category: "image",
      files: [{ uri: image, type: "image/png" }],
    },
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
