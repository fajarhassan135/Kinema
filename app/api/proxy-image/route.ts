import { NextRequest, NextResponse } from "next/server";

/** Only this host may be proxied. */
const ALLOWED_HOST = "image.tmdb.org";

/** TMDB's own size buckets; anything else is not a real poster path. */
const ALLOWED_SIZE = /^\/t\/p\/(original|w\d{2,4}|h\d{2,4})\/[A-Za-z0-9._-]+$/;

/** Posters top out well under this; the cap stops the route relaying huge files. */
const MAX_BYTES = 12 * 1024 * 1024;

const FETCH_TIMEOUT_MS = 8000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  // Parse and compare the host exactly. A prefix check on the raw string is easy
  // to get subtly wrong, and this endpoint fetches whatever it is given from the
  // server, so it must not become an open proxy.
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== ALLOWED_HOST) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  // Constrain the path too, so the route can only ever request image assets and
  // not arbitrary endpoints that happen to live on the same host.
  if (!ALLOWED_SIZE.test(parsed.pathname) || parsed.search || parsed.hash) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "error", // never follow a redirect off the allowed host
      headers: { Accept: "image/*" },
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
    }

    // Trust the bytes only if upstream says they are an image.
    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Unsupported content type" }, { status: 502 });
    }

    const declaredLength = Number(upstream.headers.get("content-length") || 0);
    if (declaredLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 502 });
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 502 });
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
