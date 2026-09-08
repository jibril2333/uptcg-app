const officialOrigin = "https://www.unionarena-tcg.com";
const officialCardPath = "/jp/images/cardlist/card/";

function invalidImageRequest() {
  return Response.json({ error: "invalid_image_url" }, { status: 400 });
}

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("url");
  if (!source) return invalidImageRequest();

  let imageUrl: URL;
  try {
    imageUrl = new URL(source);
  } catch {
    return invalidImageRequest();
  }

  if (imageUrl.origin !== officialOrigin || !imageUrl.pathname.startsWith(officialCardPath)) {
    return invalidImageRequest();
  }

  try {
    const upstream = await fetch(imageUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/*",
        "User-Agent": "UPTCG-deck-export/1.0",
      },
      redirect: "error",
    });
    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.startsWith("image/")) {
      return Response.json({ error: "image_unavailable" }, { status: 502 });
    }

    const headers = new Headers({
      "cache-control": "no-store",
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    });
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("content-length", contentLength);
    return new Response(upstream.body, { headers });
  } catch {
    return Response.json({ error: "image_unavailable" }, { status: 502 });
  }
}
