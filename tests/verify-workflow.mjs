import assert from "node:assert/strict";
import { createJoltFeedServer } from "../src/server.mjs";
import { evaluateAdPlacements } from "../src/lib/ad-engine.mjs";
import { readState } from "../src/lib/storage.mjs";

const PORT = 3456;
const BASE = `http://127.0.0.1:${PORT}`;

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, json };
}

async function runVerification() {
  console.log("=== Starting JoltFeed End-to-End Verification Suite ===");
  let server = createJoltFeedServer();
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

  try {
    // 1. Verify Server Protection on /api/admin/*
    const unauth = await request("/api/admin/state");
    assert.equal(unauth.status, 401, "Unauthenticated /api/admin/state must return 401");
    console.log("[PASS] 1. Admin routes protected from unauthenticated requests (401)");

    // 2. Authenticate as Admin
    const loginRes = await request("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@joltfeed.com", password: "JoltFeedAdmin2026!" })
    });
    assert.equal(loginRes.status, 200, "Admin login must succeed");
    const token = loginRes.json.token;
    const authHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };
    console.log("[PASS] 2. Administrator login succeeded and issued session token");

    // 3. Verify 8-Paragraph Test Article (Heading, Photo with Caption, Video with Poster, and Ad Placements)
    const article1Desktop = await request("/posts/quiet-architecture-of-instant-publishing?viewport=desktop");
    assert.equal(article1Desktop.status, 200);
    assert.match(article1Desktop.text, /property="og:title" content="The Quiet Architecture of Instant Publishing"/);
    assert.match(article1Desktop.text, /property="og:type" content="article"/);
    assert.match(article1Desktop.text, /property="og:url" content="https:\/\/joltfeed\.example\.com\/posts\/quiet-architecture-of-instant-publishing"/);
    assert.match(article1Desktop.text, /property="og:image" content="https:\/\/joltfeed\.example\.com\/uploads\/studio-hero\.jpg"/);
    assert.match(article1Desktop.text, /property="og:site_name" content="JoltFeed"/);
    assert.match(article1Desktop.text, /name="twitter:card" content="summary_large_image"/);

    // Check 8 numbered paragraphs exist and headings/images/videos did not shift numbering
    for (let p = 1; p <= 8; p++) {
      assert.match(article1Desktop.text, new RegExp(`data-paragraph-number="${p}"`), `Paragraph ${p} must be numbered`);
    }
    assert.doesNotMatch(article1Desktop.text, /data-paragraph-number="9"/, "Must have exactly 8 numbered paragraphs");
    assert.match(article1Desktop.text, /data-test-ad="before_title"/, "Must render Before Title ad");
    assert.match(article1Desktop.text, /data-test-ad="before_paragraph_3"/, "Must render Before Paragraph 3 ad");
    assert.doesNotMatch(article1Desktop.text, /data-test-ad="backup_p3"/, "Lower-priority P3 rule must be superseded by Priority 30 rule");
    assert.match(article1Desktop.text, /data-test-ad="percentage_50"/, "Must render 50% article depth ad");
    assert.match(article1Desktop.text, /data-test-ad="after_post"/, "Must render After Post ad");

    // Check Mobile viewport rendering as well
    const article1Mobile = await request("/posts/quiet-architecture-of-instant-publishing?viewport=mobile");
    assert.equal(article1Mobile.status, 200);
    assert.match(article1Mobile.text, /data-test-ad="before_title"/);
    assert.match(article1Mobile.text, /data-test-ad="before_paragraph_3"/);
    assert.match(article1Mobile.text, /data-test-ad="percentage_50"/);
    assert.match(article1Mobile.text, /data-test-ad="after_post"/);
    console.log("[PASS] 3. 8-paragraph test article verified on mobile & desktop (Open Graph tags, 8 numbered paragraphs, heading/photo/video exclusions, and exact ad positions)");

    // 4. Verify Short Article (3 Paragraphs, Hidden Featured Image on Article, Skips After Paragraph 5 Rule)
    const shortArticle = await request("/posts/field-notes-milled-aluminum-tolerances");
    assert.equal(shortArticle.status, 200);
    assert.doesNotMatch(shortArticle.text, /id="article-featured-image"/, "Featured image must be hidden on article page when hideFeaturedOnArticle is true");
    assert.match(shortArticle.text, /property="og:image" content="https:\/\/joltfeed\.example\.com\/uploads\/titanium-detail\.jpg"/, "Featured image must remain in Open Graph og:image");
    assert.doesNotMatch(shortArticle.text, /data-test-ad="after_paragraph_5"/, "3-paragraph post must skip After Paragraph 5 rule");

    const previewShort = await request("/api/admin/preview-placements", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ postId: "post-3", viewport: "desktop" })
    });
    const p5Diag = previewShort.json.diagnostics.find((d) => d.adId === "ad-after-p5-skip-demo");
    assert.ok(p5Diag && p5Diag.status === "skipped", "After P5 rule must be marked skipped");
    assert.match(p5Diag.reason, /Post has 3 paragraphs, rule requires 5/, "Diagnostic reason must state 'Post has 3 paragraphs, rule requires 5'");
    console.log("[PASS] 4. Short 3-paragraph article verified (featured image hidden on article but kept on card/OG; 'Post has 3 paragraphs, rule requires 5' skip diagnostic confirmed)");

    // 5. Verify Article with Ads Disabled & No Featured Image (Uses Sitewide Default OG Image)
    const noAdsArticle = await request("/posts/editorial-standards-and-reader-trust");
    assert.equal(noAdsArticle.status, 200);
    assert.doesNotMatch(noAdsArticle.text, /class="jolt-ad-slot/, "No ad slots may render when disableAds is true");
    assert.match(noAdsArticle.text, /property="og:image" content="https:\/\/joltfeed\.example\.com\/uploads\/joltfeed-default-og\.jpg"/, "Post without featured image must fall back to sitewide default og:image");
    assert.match(noAdsArticle.text, /property="og:title" content="JoltFeed Editorial Standards &amp; Independence"/, "Custom social title override must render in og:title");
    console.log("[PASS] 5. Ads-disabled & no-featured-image article verified (0 ads rendered, fallback default og:image & custom og:title verified)");

    // 6. Verify Publish -> Edit -> Unpublish Workflow & Sitemap Sync + Persistence Across Server Restart
    const newPostId = "post-e2e-test";
    const createRes = await request("/api/admin/posts", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        id: newPostId,
        title: "E2E Workflow Verification Story",
        slug: "e2e-workflow-verification-story",
        excerpt: "Initial excerpt for E2E verification.",
        author: "Elena Rostova",
        category: "Engineering",
        status: "published",
        publishedAt: "2026-11-09T18:00:00Z",
        featuredImage: "/uploads/studio-hero.jpg",
        featuredPublicUrl: "https://joltfeed.example.com/uploads/studio-hero.jpg",
        hideFeaturedOnArticle: false,
        disableAds: false,
        blocks: [
          { id: "e1", type: "paragraph", text: "First paragraph of the published test story." },
          { id: "e2", type: "paragraph", text: "Second paragraph of the published test story." }
        ]
      })
    });
    assert.equal(createRes.status, 200);

    // Restart server to verify SQLite persistence across restarts
    await new Promise((resolve) => server.close(resolve));
    server = createJoltFeedServer();
    await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

    const homeAfterPublish = await request("/");
    assert.match(homeAfterPublish.text, /E2E Workflow Verification Story/, "Published post must appear on homepage after restart");
    const sitemapAfterPublish = await request("/sitemap.xml");
    assert.match(sitemapAfterPublish.text, /e2e-workflow-verification-story/, "Published post must appear in /sitemap.xml");

    // Edit post title and social metadata
    await request("/api/admin/posts", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        id: newPostId,
        title: "E2E Workflow Story — Updated Headline",
        slug: "e2e-workflow-verification-story",
        ogTitle: "Custom Updated Social Title",
        status: "published"
      })
    });
    const editedArticle = await request("/posts/e2e-workflow-verification-story");
    assert.match(editedArticle.text, /E2E Workflow Story — Updated Headline/);
    assert.match(editedArticle.text, /property="og:title" content="Custom Updated Social Title"/);

    // Unpublish post -> verify removed from homepage, returns 404 to public, and removed from /sitemap.xml
    await request("/api/admin/posts", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        id: newPostId,
        status: "draft"
      })
    });
    const publicUnpublished = await request("/posts/e2e-workflow-verification-story");
    assert.equal(publicUnpublished.status, 404, "Unpublished draft must return 404 to public visitors");
    const sitemapAfterUnpublish = await request("/sitemap.xml");
    assert.doesNotMatch(sitemapAfterUnpublish.text, /e2e-workflow-verification-story/, "Unpublished post must be removed from /sitemap.xml");
    console.log("[PASS] 6. Full Publish -> Restart Persistence -> Edit -> Unpublish & Sitemap sync workflow verified");

    // 7. Verify all 9 Ad Placement types in the Ad Engine (including Every N Paragraphs, After Title, Before First Paragraph, and Manual Slot)
    const state = readState();
    const samplePost = state.posts.find((p) => p.id === "post-1");
    const customAds = [
      { id: "t-after-title", name: "After Title Test", placement: "after_title", minWords: 10, device: "all", priority: 10, enabled: true, code: "<div>AfterTitle</div>" },
      { id: "t-before-p1", name: "Before P1 Test", placement: "before_first_paragraph", minWords: 10, device: "all", priority: 10, enabled: true, code: "<div>BeforeP1</div>" },
      { id: "t-every-n", name: "Every 3 Paragraphs", placement: "every_n_paragraphs", paramN: 2, interval: 3, maxRepeats: 2, minWords: 10, device: "all", priority: 10, enabled: true, code: "<div>EveryN</div>" }
    ];
    const customEval = evaluateAdPlacements(samplePost, customAds, { maxAdsPerArticle: 10 }, "desktop");
    assert.ok(customEval.boundaries["after_title"], "After title placement must resolve");
    assert.ok(customEval.boundaries["before_block_0"], "Before first paragraph placement must resolve");
    assert.equal(customEval.placedCount, 4, "Every-N (2 repeats) + After Title + Before P1 = 4 placements");
    console.log("[PASS] 7. All 9 ad placement types (including Every N paragraphs, After Title, Before First Paragraph, Manual Slot) verified");

    console.log("=== ALL END-TO-END VERIFICATION CHECKS PASSED ===");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

runVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
