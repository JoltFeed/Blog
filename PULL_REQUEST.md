# Pull Request: Build JoltFeed Mobile-First Publishing Platform & Ad Placement Manager

## Summary of Changes
- **Minimal Apple-Style Public Site**: Off-white (`#fbfbfd`) / pure white surfaces, near-black (`#1d1d1f`) typography, system font stack, restrained `#0066cc` accent, compact `52px` sticky header for instant headline visibility when arriving from Facebook on mobile, and `aspect-ratio: 16/9` reserved containers for zero Cumulative Layout Shift (CLS).
- **Unified `/admin` Panel**: Authentication (PBKDF2 hashed credentials, session cookies, password recovery, and `npm run create-admin` CLI), **Posts** block editor with draft autosave and mobile/desktop preview, **Media** library for persistent image/video uploads, **Ads** placement manager with live rule previewer, and **Site Settings**.
- **Deterministic Ad Placement Engine**: Implements all 9 placements (`before_title`, `after_title`, `before_first_paragraph`, `before_paragraph`, `after_paragraph`, `every_n_paragraphs`, `percentage`, `after_post`, and `manual`). Counts strictly nonempty top-level body paragraphs so headings, lists, quotes, photos, and videos never shift paragraph numbering.
- **Open Graph, Share Bar & Sitemap**: Server-rendered `og:title`, `og:description`, `og:type="article"`, `og:url`, `og:image`, `og:site_name`, and `twitter:card="summary_large_image"` with per-post overrides and sitewide fallback image, end-of-article share buttons (Facebook, WhatsApp, Copy link with confirmation, native Web Share API), and dynamic `/sitemap.xml`.

## Verification Performed
- Ran `npm run build` and `npm test` (`tests/verify-workflow.mjs`) plus headless Chromium verification on mobile (`390x844`) and desktop (`1280x900`).
- Verified the 8-paragraph test article (with heading, captioned photo, and uploaded MP4 video with poster) renders distinctive test ads above the title, before paragraph 3, at 50% word depth, and after the post, and maintains single-instance ad rendering across internal SPA navigation to a second article and back.
- Verified the 3-paragraph short article hides its featured image on the article view while keeping it on homepage cards and `og:image`, and skips the `After paragraph 5` rule with diagnostic `"Post has 3 paragraphs, rule requires 5"`.
- Verified the ads-disabled / no-featured-image article renders zero ads and falls back to the sitewide default `og:image`.
- Verified SQLite database persistence across a full server restart and confirmed production DNS/domains remain untouched.
