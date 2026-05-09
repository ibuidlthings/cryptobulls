// GET /api/metadata/[tier] - returns the Metaplex-style JSON metadata
// that the on-chain metadata account points at via its `uri` field.
// Phantom / Magic Eden / Tensor read this to display name, image, and traits.

import { NextRequest, NextResponse } from "next/server";
import { fetchBullAsset, getConnection } from "@/lib/chain";
import { selectTraits, deriveSeed } from "@/lib/renderer.mjs";
import { cacheWrap } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ tier: string }>;
}

const TRAIT_LABELS = {
  body: ["brown", "black", "white", "red", "golden", "cyan", "pink", "zombie", "holo"],
  horn: ["ivory", "dark", "gold", "crimson", "silver"],
  eye: ["normal", "golden", "void", "green", "closed", "angry", "crying", "ski_mask"],
  bg: ["pasture", "sand", "sunset", "chart", "void", "sky", "crimson"],
  acc: [
    "none", "nose_ring", "bell", "war_paint", "gold_chain", "cowboy_hat",
    "dubai_hat", "strawberry_hat", "apple", "crown", "halo", "devil_aura",
    "diamond_aura", "fire_aura", "beanie", "tinfoil", "headband", "mohawk",
    "top_hat", "sheriff_hat", "tiara", "halo_stars", "earring", "mole",
    "rosy_cheeks", "scar",
  ],
  eyewear: [
    "none", "mog", "sunglasses_classic", "clout_shades", "thug_life",
    "3d_glasses", "big_shades", "swag", "lasers",
  ],
  mouth: [
    "none", "cigarette", "cigar", "grill", "smug", "bubblegum", "smile",
    "frown", "tongue_out", "open_shout", "pacifier",
  ],
};

function getOrigin(req: NextRequest): string {
  // Prefer x-forwarded-host (set by Caddy reverse proxy on bulls box)
  const fwd = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = fwd || req.headers.get("host") || "cryptobulls.fun";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { tier: tierStr } = await ctx.params;
  const tier = parseInt(tierStr, 10);
  if (!Number.isInteger(tier) || tier < 1 || tier > 1000) {
    return NextResponse.json({ error: "invalid tier" }, { status: 400 });
  }

  // Cached chain read: same tier within 60s skips the RPC.
  const bull = await cacheWrap(
    "bull-asset",
    String(tier),
    60_000,
    async () => await fetchBullAsset(getConnection(), tier),
  );
  if (!bull) {
    return NextResponse.json(
      { error: `CryptoBulls #${tier} is not currently wrapped` },
      { status: 404 }
    );
  }

  const origin = getOrigin(req);
  const imageUrl = `${origin}/api/render/${tier}`;
  const externalUrl = `${origin}/bull/${tier}`;

  const seed: Buffer = deriveSeed(bull.nftMint.toBase58());
  const traits = selectTraits(seed) as Record<string, number>;

  const attributes = [
    { trait_type: "Tier", value: tier },
    { trait_type: "Body", value: TRAIT_LABELS.body[traits.body] },
    { trait_type: "Horn", value: TRAIT_LABELS.horn[traits.horn] },
    { trait_type: "Eye", value: TRAIT_LABELS.eye[traits.eye] },
    { trait_type: "Background", value: TRAIT_LABELS.bg[traits.bg] },
    { trait_type: "Accessory", value: TRAIT_LABELS.acc[traits.acc] },
    { trait_type: "Eyewear", value: TRAIT_LABELS.eyewear[traits.eyewear] },
    { trait_type: "Mouth", value: TRAIT_LABELS.mouth[traits.mouth] },
  ];

  const metadata = {
    name: `CryptoBulls #${tier}`,
    symbol: "BULLS",
    description:
      `CryptoBulls #${tier} - a hybrid token-NFT. Holds 1,000,000 $BULLS ` +
      `locked in a vault whose authority is derived from this NFT's mint ` +
      `address. Sell the NFT, the tokens go with it. Unwrap to redeem.`,
    image: imageUrl,
    external_url: externalUrl,
    attributes,
    properties: {
      category: "image",
      files: [{ uri: imageUrl, type: "image/png" }],
    },
  };

  return NextResponse.json(metadata, {
    headers: {
      // Metadata for a wrapped bull is immutable: traits are seeded from
      // nft_mint and the visual is locked at wrap time. Cache aggressively
      // so Magic Eden / Tensor crawlers don't hammer our RPC. After unwrap
      // the URL 404s — marketplaces re-crawl on burn anyway.
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
