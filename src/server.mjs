import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { readState, writeState, hashPassword } from "./lib/storage.mjs";
import { evaluateAdPlacements } from "./lib/ad-engine.mjs";

const PORT = Number(process.env.PORT || 3040);
const activeSessions = new Map();

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getCanonicalUrl(settings, post) {
  const base = String(settings.publicUrl || "https://joltfeed.example.com").replace(/\/+$/, "");
  if (!post) return `${base}/`;
  return `${base}/posts/${encodeURIComponent(post.slug)}`;
}

function getPostOgMeta(settings, post) {
  const base = String(settings.publicUrl || "https://joltfeed.example.com").replace(/\/+$/, "");
  const url = getCanonicalUrl(settings, post);
  const title = (post.ogTitle && post.ogTitle.trim()) ? post.ogTitle.trim() : post.title;
  const description = (post.ogDescription && post.ogDescription.trim())
    ? post.ogDescription.trim()
    : (post.excerpt || post.title);
  let image = "";
  if (post.ogImage && post.ogImage.trim()) {
    image = post.ogImage.trim();
  } else if (post.featuredPublicUrl && post.featuredPublicUrl.trim()) {
    image = post.featuredPublicUrl.trim();
  } else if (post.featuredImage && post.featuredImage.trim()) {
    image = post.featuredImage.startsWith("http")
      ? post.featuredImage
      : `${base}${post.featuredImage}`;
  } else {
    image = settings.defaultOgImage || `${base}/uploads/joltfeed-default-og.jpg`;
  }
  return {
    title,
    description,
    type: "article",
    url,
    image,
    siteName: settings.siteName || "JoltFeed"
  };
}

function renderAdSlotServerHtml(cand) {
  if (!cand || !cand.ad) return "";
  return `<aside class="jolt-ad-slot my-6 rounded-2xl border border-[#d2d2d7] bg-white p-3.5" data-ad-id="${escapeHtml(cand.ad.id)}" data-boundary="${escapeHtml(cand.boundaryKey)}" data-label="${escapeHtml(cand.label)}">
    <div class="text-[10px] font-mono uppercase tracking-wider text-[#6e6e73] mb-1 flex justify-between">
      <span>${escapeHtml(cand.ad.name)}</span>
      <span>${escapeHtml(cand.label)}</span>
    </div>
    ${cand.ad.code}
  </aside>`;
}

function renderArticleServerHtml(state, post, viewport = "desktop") {
  const { settings, ads, posts } = state;
  const og = getPostOgMeta(settings, post);
  const evalRes = evaluateAdPlacements(post, ads, settings, viewport);

  let pNum = 0;
  const bodyParts = [];
  for (let bIdx = 0; bIdx < (post.blocks || []).length; bIdx++) {
    const blk = post.blocks[bIdx];
    if (evalRes.boundaries[`before_block_${bIdx}`]) {
      bodyParts.push(renderAdSlotServerHtml(evalRes.boundaries[`before_block_${bIdx}`]));
    }
    if (blk.type === "paragraph" && String(blk.text || "").trim().length > 0) {
      pNum++;
      bodyParts.push(`<p data-paragraph-number="${pNum}">${escapeHtml(blk.text)}</p>`);
    } else if (blk.type === "heading") {
      const tag = blk.level === 3 ? "h3" : "h2";
      bodyParts.push(`<${tag}>${escapeHtml(blk.text)}</${tag}>`);
    } else if (blk.type === "quote") {
      bodyParts.push(`<blockquote>${escapeHtml(blk.text)}</blockquote>`);
    } else if (blk.type === "image") {
      bodyParts.push(`<figure class="my-8" style="aspect-ratio:16/9;"><img src="${escapeHtml(blk.url)}" alt="${escapeHtml(blk.alt || "")}" loading="lazy" />${blk.caption ? `<figcaption>${escapeHtml(blk.caption)}</figcaption>` : ""}</figure>`);
    } else if (blk.type === "video") {
      bodyParts.push(`<figure class="my-8" style="aspect-ratio:16/9;"><video controls preload="none" poster="${escapeHtml(blk.posterUrl || "")}" src="${escapeHtml(blk.url)}"></video>${blk.caption ? `<figcaption>${escapeHtml(blk.caption)}</figcaption>` : ""}</figure>`);
    } else if (blk.type === "embed") {
      bodyParts.push(`<figure class="my-8" style="aspect-ratio:16/9;"><iframe loading="lazy" src="${escapeHtml(blk.embedUrl || "")}"></iframe></figure>`);
    } else if (blk.type === "ad_slot") {
      if (evalRes.boundaries[`manual_block_${bIdx}`]) {
        bodyParts.push(renderAdSlotServerHtml(evalRes.boundaries[`manual_block_${bIdx}`]));
      }
    }
    if (evalRes.boundaries[`after_block_${bIdx}`]) {
      bodyParts.push(renderAdSlotServerHtml(evalRes.boundaries[`after_block_${bIdx}`]));
    }
  }

  const relatedLinks = posts
    .filter((p) => p.status === "published" && p.id !== post.id)
    .map((p) => `<a class="related-post-link" href="/posts/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a>`)
    .join(" | ");

  const featuredHtml = (post.featuredImage && !post.hideFeaturedOnArticle)
    ? `<figure id="article-featured-image" style="aspect-ratio:16/9;"><img src="${escapeHtml(post.featuredImage)}" alt="${escapeHtml(post.featuredCaption || post.title)}" fetchpriority="high" />${post.featuredCaption ? `<figcaption>${escapeHtml(post.featuredCaption)}</figcaption>` : ""}</figure>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(og.title)} — ${escapeHtml(og.siteName)}</title>
  <link rel="canonical" href="${escapeHtml(og.url)}" />
  <link rel="icon" href="${escapeHtml(settings.favicon)}" />
  <meta property="og:title" content="${escapeHtml(og.title)}" />
  <meta property="og:description" content="${escapeHtml(og.description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(og.url)}" />
  <meta property="og:image" content="${escapeHtml(og.image)}" />
  <meta property="og:site_name" content="${escapeHtml(og.siteName)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(og.title)}" />
  <meta name="twitter:description" content="${escapeHtml(og.description)}" />
  <meta name="twitter:image" content="${escapeHtml(og.image)}" />
  ${!post.disableAds ? (settings.bootstrapCode || "") : ""}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif; background: #fbfbfd; color: #1d1d1f; margin: 0; }
    header.site-header { height: 52px; border-bottom: 1px solid #d2d2d7; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; position: sticky; top: 0; background: rgba(251,251,253,0.92); backdrop-filter: blur(10px); }
    main.article-column { max-width: 700px; margin: 0 auto; padding: 24px 16px 64px; }
    h1 { font-size: 2.25rem; line-height: 1.15; margin: 8px 0 12px; letter-spacing: -0.02em; }
    .article-prose p { font-size: 1.125rem; line-height: 1.75; margin-bottom: 1.4rem; }
    .jolt-ad-slot { min-height: 88px; border: 1px solid #d2d2d7; border-radius: 14px; padding: 12px; margin: 20px 0; background: #fff; }
  </style>
</head>
<body>
  <header class="site-header">
    <a href="/" class="brand-name" style="font-weight:700;color:#1d1d1f;text-decoration:none;">${escapeHtml(settings.siteName)}</a>
    <nav><a href="/admin" style="color:#0066cc;text-decoration:none;font-size:13px;">/admin</a></nav>
  </header>
  <main class="article-column" data-post-slug="${escapeHtml(post.slug)}">
    <div id="slot-before-title">${evalRes.boundaries["before_title"] ? renderAdSlotServerHtml(evalRes.boundaries["before_title"]) : ""}</div>
    <div class="post-category" style="color:#0066cc;font-size:12px;font-weight:600;text-transform:uppercase;">${escapeHtml(post.category)}</div>
    <h1 id="post-headline">${escapeHtml(post.title)}</h1>
    ${post.excerpt ? `<p id="post-excerpt" style="color:#6e6e73;font-size:1.15rem;">${escapeHtml(post.excerpt)}</p>` : ""}
    <div class="post-meta" style="color:#6e6e73;font-size:13px;border-top:1px solid #d2d2d7;border-bottom:1px solid #d2d2d7;padding:10px 0;margin-bottom:20px;">
      <span>${escapeHtml(post.author)}</span> &middot; <time>${escapeHtml(post.publishedAt)}</time>
    </div>
    <div id="slot-after-title">${evalRes.boundaries["after_title"] ? renderAdSlotServerHtml(evalRes.boundaries["after_title"]) : ""}</div>
    ${featuredHtml}
    <div id="article-body" class="article-prose">
      ${bodyParts.join("\n")}
    </div>
    <div id="slot-after-post">${evalRes.boundaries["after_post"] ? renderAdSlotServerHtml(evalRes.boundaries["after_post"]) : ""}</div>
    <section class="share-actions" style="margin-top:32px;padding-top:20px;border-top:1px solid #d2d2d7;">
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(og.url)}" target="_blank" rel="noopener">Share on Facebook</a> |
      <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(og.title + " " + og.url)}" target="_blank" rel="noopener">Share on WhatsApp</a> |
      <button type="button" id="btn-copy-canonical" data-canonical="${escapeHtml(og.url)}">Copy Link</button>
    </section>
    <section class="related-stories" style="margin-top:28px;">
      <h3>Related Stories</h3>
      <div>${relatedLinks}</div>
    </section>
  </main>
</body>
</html>`;
}

function renderHomepageServerHtml(state) {
  const { settings, posts } = state;
  const published = posts.filter((p) => p.status === "published");
  const lead = published[0];
  const rest = published.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(settings.siteName)} — Minimalist Publishing</title>
  <link rel="canonical" href="${escapeHtml(getCanonicalUrl(settings, null))}" />
  <meta property="og:title" content="${escapeHtml(settings.siteName)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(getCanonicalUrl(settings, null))}" />
  <meta property="og:image" content="${escapeHtml(settings.defaultOgImage)}" />
  <meta property="og:site_name" content="${escapeHtml(settings.siteName)}" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',system-ui,sans-serif;background:#fbfbfd;color:#1d1d1f;margin:0;">
  <header style="height:52px;border-bottom:1px solid #d2d2d7;display:flex;align-items:center;justify-content:space-between;padding:0 24px;">
    <a href="/" style="font-weight:700;font-size:1.2rem;color:#1d1d1f;text-decoration:none;">${escapeHtml(settings.siteName)}</a>
    <a href="/admin" style="color:#0066cc;text-decoration:none;font-size:13px;">/admin</a>
  </header>
  <main style="max-width:1080px;margin:0 auto;padding:32px 20px;">
    ${lead ? `<section class="featured-hero" style="margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid #d2d2d7;">
      <a href="/posts/${encodeURIComponent(lead.slug)}" style="text-decoration:none;color:inherit;">
        ${lead.featuredImage ? `<div style="aspect-ratio:16/9;overflow:hidden;border-radius:16px;margin-bottom:16px;"><img src="${escapeHtml(lead.featuredImage)}" alt="${escapeHtml(lead.title)}" style="width:100%;height:100%;object-fit:cover;" /></div>` : ""}
        <span style="color:#0066cc;font-size:12px;font-weight:600;text-transform:uppercase;">Featured · ${escapeHtml(lead.category)}</span>
        <h1 style="font-size:2.2rem;margin:8px 0;">${escapeHtml(lead.title)}</h1>
        <p style="color:#6e6e73;">${escapeHtml(lead.excerpt || "")}</p>
      </a>
    </section>` : ""}
    <section class="recent-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px;">
      ${rest.map((p) => `<article class="post-card">
        <a href="/posts/${encodeURIComponent(p.slug)}" style="text-decoration:none;color:inherit;">
          ${p.featuredImage ? `<div style="aspect-ratio:16/9;overflow:hidden;border-radius:12px;margin-bottom:10px;"><img src="${escapeHtml(p.featuredImage)}" alt="${escapeHtml(p.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" /></div>` : `<div style="aspect-ratio:16/9;border:1px solid #d2d2d7;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;"><span>${escapeHtml(settings.siteName)}</span></div>`}
          <h2 style="font-size:1.2rem;margin:6px 0;">${escapeHtml(p.title)}</h2>
          <time style="font-size:12px;color:#6e6e73;">${escapeHtml(p.publishedAt)}</time>
        </a>
      </article>`).join("\n")}
    </section>
  </main>
</body>
</html>`;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function isAuthorized(req) {
  const authHeader = req.headers["authorization"] || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (activeSessions.has(token)) return true;
  }
  const cookie = req.headers["cookie"] || "";
  const match = cookie.match(/jolt_session=([a-f0-9]+)/);
  if (match && activeSessions.has(match[1])) return true;
  return false;
}

export function createJoltFeedServer() {
  return http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const pathname = urlObj.pathname;
      const viewport = urlObj.searchParams.get("viewport") || "desktop";
      const state = readState();

      // Static uploads
      if (pathname.startsWith("/uploads/")) {
        const filePath = path.join(process.cwd(), "public", pathname);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mime = ext === ".mp4" ? "video/mp4" : "image/jpeg";
          res.writeHead(200, { "Content-Type": mime, "Cache-Control": "public, max-age=31536000, immutable" });
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }

      // Dynamic /sitemap.xml
      if (pathname === "/sitemap.xml" && req.method === "GET") {
        const base = String(state.settings.publicUrl || "https://joltfeed.example.com").replace(/\/+$/, "");
        const published = state.posts.filter((p) => p.status === "published");
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          `  <url><loc>${base}/</loc></url>`,
          ...published.map((p) => `  <url><loc>${getCanonicalUrl(state.settings, p)}</loc><lastmod>${p.publishedAt}</lastmod></url>`),
          `</urlset>`
        ].join("\n");
        res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
        res.end(xml);
        return;
      }

      // Public Homepage
      if (pathname === "/" && req.method === "GET") {
        const html = renderHomepageServerHtml(state);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" });
        res.end(html);
        return;
      }

      // Public Article Route
      if (pathname.startsWith("/posts/") && req.method === "GET") {
        const slug = decodeURIComponent(pathname.slice("/posts/".length));
        const post = state.posts.find((p) => p.slug === slug);
        const allowPreview = urlObj.searchParams.get("preview") === "1" && isAuthorized(req);
        if (!post || (post.status !== "published" && !allowPreview)) {
          res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h1>404 — Article Not Found or Private Draft</h1>");
          return;
        }
        const html = renderArticleServerHtml(state, post, viewport);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": post.status === "published" ? "public, s-maxage=60, stale-while-revalidate=300" : "private, no-store" });
        res.end(html);
        return;
      }

      // /admin SPA Shell
      if (pathname === "/admin" && req.method === "GET") {
        const uiPath = path.resolve(process.cwd(), "..", "..", "output", "joltfeed.html");
        if (fs.existsSync(uiPath)) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          fs.createReadStream(uiPath).pipe(res);
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>JoltFeed /admin Panel</h1>");
        return;
      }

      // API: Admin Login
      if (pathname === "/api/admin/login" && req.method === "POST") {
        const body = await parseJsonBody(req);
        const user = state.users.find((u) => u.email === body.email);
        if (!user || user.passwordHash !== hashPassword(body.password)) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid credentials" }));
          return;
        }
        const token = crypto.randomBytes(24).toString("hex");
        activeSessions.set(token, { userId: user.id, email: user.email });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Set-Cookie": `jolt_session=${token}; HttpOnly; Path=/; SameSite=Lax`
        });
        res.end(JSON.stringify({ ok: true, token, email: user.email }));
        return;
      }

      // Protect all /api/admin/* routes below
      if (pathname.startsWith("/api/admin/")) {
        if (!isAuthorized(req)) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized — Admin authentication required" }));
          return;
        }

        if (pathname === "/api/admin/state" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ settings: state.settings, posts: state.posts, ads: state.ads, media: state.media }));
          return;
        }

        if (pathname === "/api/admin/posts" && req.method === "POST") {
          const body = await parseJsonBody(req);
          const existingIdx = state.posts.findIndex((p) => p.id === body.id);
          if (existingIdx !== -1) {
            state.posts[existingIdx] = { ...state.posts[existingIdx], ...body };
          } else {
            state.posts.unshift(body);
          }
          writeState(state);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, post: body }));
          return;
        }

        if (pathname === "/api/admin/ads" && req.method === "POST") {
          const body = await parseJsonBody(req);
          const existingIdx = state.ads.findIndex((a) => a.id === body.id);
          if (existingIdx !== -1) {
            state.ads[existingIdx] = { ...state.ads[existingIdx], ...body };
          } else {
            state.ads.push(body);
          }
          writeState(state);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, ad: body }));
          return;
        }

        if (pathname === "/api/admin/settings" && req.method === "POST") {
          const body = await parseJsonBody(req);
          state.settings = { ...state.settings, ...body };
          writeState(state);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, settings: state.settings }));
          return;
        }

        if (pathname === "/api/admin/preview-placements" && req.method === "POST") {
          const body = await parseJsonBody(req);
          const post = state.posts.find((p) => p.id === body.postId) || state.posts[0];
          const evaluation = evaluateAdPlacements(post, state.ads, state.settings, body.viewport || "desktop");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(evaluation));
          return;
        }
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err.message || err) }));
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const srv = createJoltFeedServer();
  srv.listen(PORT, () => {
    console.log(`JoltFeed server listening on http://localhost:${PORT}`);
  });
}
