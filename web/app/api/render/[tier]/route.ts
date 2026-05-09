// GET /api/render/[tier] - returns the deterministic bull image.
// Default format: PNG (768x768) - Phantom and most wallets prefer raster.
// ?format=svg returns the vector SVG instead.
//
// Caching: rendered bytes are stored in-memory keyed by (tier, format) for
// 60s. Repeated hits skip both the chain RPC and the SVG/PNG pipeline.

import { NextRequest, NextResponse } from "next/server";
import { fetchBullAsset, getConnection } from "@/lib/chain";
import { renderBullSvg, deriveSeed } from "@/lib/renderer.mjs";
import { svgToPixels, encodePng } from "@/lib/svg_to_png.mjs";
import { cacheWrap } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ tier: string }>;
}

const PNG_PIXEL_SCALE = 32; // 24 * 32 = 768x768
const TTL_MS = 60_000;

interface RenderedAsset {
  svg: string;
  png: Buffer;
}

async function loadRendered(tier: number): Promise<RenderedAsset | null> {
  const conn = getConnection();
  const bull = await fetchBullAsset(conn, tier);
  if (!bull) return null;
  const seed: Buffer = deriveSeed(bull.nftMint.toBase58());
  const { svg } = renderBullSvg(seed, 24);
  const { width, height, rgb } = svgToPixels(svg, PNG_PIXEL_SCALE);
  const png = encodePng(width, height, rgb) as Buffer;
  return { svg, png };
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { tier: tierStr } = await ctx.params;
  const tier = parseInt(tierStr, 10);
  if (!Number.isInteger(tier) || tier < 1 || tier > 1000) {
    return new NextResponse("invalid tier", { status: 400 });
  }

  const asset = await cacheWrap(
    "render",
    String(tier),
    TTL_MS,
    () => loadRendered(tier),
  );
  if (!asset) {
    return new NextResponse(
      `CryptoBulls #${tier} is not currently wrapped`,
      { status: 404 }
    );
  }

  const format = new URL(req.url).searchParams.get("format");

  if (format === "svg") {
    return new NextResponse(asset.svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        // Visual is deterministic from nft_mint and locked at wrap time.
        // Cache aggressively (1 day) so marketplace crawlers don't trigger
        // a re-render every batch.
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
        "Access-Control-Allow-Origin": "*",
        "X-Cache-Source": "in-process",
      },
    });
  }

  // Default: PNG - wallets (Phantom in particular) render raster more reliably.
  return new NextResponse(new Blob([new Uint8Array(asset.png)], { type: "image/png" }), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      "Access-Control-Allow-Origin": "*",
      "X-Cache-Source": "in-process",
    },
  });
}
