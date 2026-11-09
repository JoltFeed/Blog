import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const DATA_DIR = path.resolve(process.cwd(), "data");
const SQLITE_DB_PATH = process.env.SQLITE_DATA_PATH
  ? path.resolve(process.cwd(), process.env.SQLITE_DATA_PATH)
  : path.join(DATA_DIR, "joltfeed.sqlite");

export function hashPassword(password, salt = "joltfeed-salt-2026") {
  return crypto.pbkdf2Sync(String(password), salt, 10000, 64, "sha512").toString("hex");
}

const DEFAULT_SEED = {
  settings: {
    siteName: process.env.SITE_NAME || "JoltFeed",
    logoText: "J",
    publicUrl: process.env.PUBLIC_SITE_URL || "https://joltfeed.example.com",
    favicon: "https://joltfeed.example.com/favicon.ico",
    defaultOgImage: "https://joltfeed.example.com/uploads/joltfeed-default-og.jpg",
    maxAdsPerArticle: 6,
    bootstrapCode: "<!-- JoltFeed AdBootstrap v1: window.joltAdProvider = window.joltAdProvider || { initialized: true }; -->"
  },
  users: [
    {
      id: "admin-1",
      email: process.env.ADMIN_EMAIL || "admin@joltfeed.com",
      passwordHash: hashPassword(process.env.ADMIN_PASSWORD || "JoltFeedAdmin2026!"),
      role: "admin"
    }
  ],
  media: [
    {
      id: "media-1",
      title: "Sunlit Industrial Design Studio",
      type: "image",
      url: "/uploads/studio-hero.jpg",
      publicPath: "https://joltfeed.example.com/uploads/studio-hero.jpg",
      alt: "Minimalist architectural studio with an anodized aluminum laptop and ceramic cup on an oak desk",
      caption: "Natural morning light across the primary editorial desk in Cupertino."
    },
    {
      id: "media-2",
      title: "Precision Milled Titanium & Acoustic Glass",
      type: "image",
      url: "/uploads/titanium-detail.jpg",
      publicPath: "https://joltfeed.example.com/uploads/titanium-detail.jpg",
      alt: "Macro detail of brushed titanium chassis meeting laminated acoustic glass",
      caption: "Figure 1: Sub-millimeter chamfer tolerances eliminate visual distraction around the display perimeter."
    },
    {
      id: "media-3",
      title: "Nordic Timber & Glass Coastal Pavilion",
      type: "image",
      url: "/uploads/coastal-pavilion.jpg",
      publicPath: "https://joltfeed.example.com/uploads/coastal-pavilion.jpg",
      alt: "Minimalist timber and glass pavilion overlooking calm twilight ocean waters",
      caption: "Designed for uninterrupted long-form reading and acoustic isolation by the sea."
    },
    {
      id: "media-4",
      title: "60fps Layout Stability Motion Test (Video)",
      type: "video",
      url: "/uploads/layout-stability-demo.mp4",
      posterUrl: "/uploads/studio-hero.jpg",
      publicPath: "https://joltfeed.example.com/uploads/layout-stability-demo.mp4",
      alt: "Recorded scroll benchmark comparing zero-CLS reserved containers against legacy ad injection",
      caption: "Video 1: Reserved 16:9 media containers and deterministic ad boundaries prevent viewport jump on mobile."
    }
  ],
  ads: [
    {
      id: "ad-above-title",
      name: "Top Sponsor Banner (Before Title)",
      placement: "before_title",
      paramN: 1,
      interval: 3,
      maxRepeats: 1,
      percentage: 50,
      minWords: 40,
      device: "all",
      priority: 20,
      enabled: true,
      code: `<div class="ad-unit-banner" data-test-ad="before_title"><strong>Sponsored · Before Title Unit</strong> — Linear Studio Display 5K</div>`
    },
    {
      id: "ad-before-p3",
      name: "Inline Display Unit (Before Paragraph 3)",
      placement: "before_paragraph",
      paramN: 3,
      interval: 3,
      maxRepeats: 1,
      percentage: 50,
      minWords: 80,
      device: "all",
      priority: 30,
      enabled: true,
      code: `<div class="ad-unit-banner" data-test-ad="before_paragraph_3"><strong>Ad Placement · Before Paragraph 3</strong> — Meridian Grade 5 Titanium Watch</div>`
    },
    {
      id: "ad-50-pct",
      name: "Mid-Story Reader Unit (50% of Article Words)",
      placement: "percentage",
      paramN: 4,
      interval: 3,
      maxRepeats: 1,
      percentage: 50,
      minWords: 100,
      device: "all",
      priority: 25,
      enabled: true,
      code: `<div class="ad-unit-banner" data-test-ad="percentage_50"><strong>Ad Placement · 50% Article Depth</strong> — Kono Acoustic Felt Panels</div>`
    },
    {
      id: "ad-after-post",
      name: "Footer End-of-Story Unit (After Post)",
      placement: "after_post",
      paramN: 1,
      interval: 3,
      maxRepeats: 1,
      percentage: 50,
      minWords: 40,
      device: "all",
      priority: 15,
      enabled: true,
      code: `<div class="ad-unit-banner" data-test-ad="after_post"><strong>Ad Placement · After Post Unit</strong> — Subscribe to JoltFeed Pro</div>`
    },
    {
      id: "ad-after-p5-skip-demo",
      name: "Deep Read Unit (After Paragraph 5)",
      placement: "after_paragraph",
      paramN: 5,
      interval: 3,
      maxRepeats: 1,
      percentage: 50,
      minWords: 40,
      device: "all",
      priority: 12,
      enabled: true,
      code: `<div class="ad-unit-banner" data-test-ad="after_paragraph_5"><strong>Ad Placement · After Paragraph 5</strong> — Veloce Carbon Reference Monitor</div>`
    },
    {
      id: "ad-low-priority-p3",
      name: "Backup P3 Unit (Lower Priority Conflict Demo)",
      placement: "before_paragraph",
      paramN: 3,
      interval: 3,
      maxRepeats: 1,
      percentage: 50,
      minWords: 50,
      device: "all",
      priority: 5,
      enabled: true,
      code: `<div class="ad-unit-banner" data-test-ad="backup_p3">Backup P3 Ad (Superseded by Priority 30 Rule)</div>`
    }
  ],
  posts: [
    {
      id: "post-1",
      title: "The Quiet Architecture of Instant Publishing",
      slug: "quiet-architecture-of-instant-publishing",
      excerpt: "How disciplined typography, zero-shift media containers, and deterministic ad boundaries make mobile journalism feel effortless for readers arriving from social feeds.",
      author: "Elena Rostova",
      category: "Design",
      status: "published",
      publishedAt: "2026-11-09T14:30:00Z",
      featuredImage: "/uploads/studio-hero.jpg",
      featuredPublicUrl: "https://joltfeed.example.com/uploads/studio-hero.jpg",
      featuredCaption: "Natural morning light across the primary editorial desk in Cupertino.",
      hideFeaturedOnArticle: false,
      disableAds: false,
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
      blocks: [
        {
          id: "b1",
          type: "paragraph",
          text: "When a reader taps a shared story link inside Facebook on a mobile phone, the first eight hundred milliseconds determine whether they stay or bounce. A calm publication respects that arrival by rendering the headline immediately, keeping navigation compact, and eliminating the jarring layout shifts that plague legacy content management systems."
        },
        {
          id: "b2",
          type: "paragraph",
          text: "Visual restraint is not merely an aesthetic preference; it is an engineering discipline. By pairing a high-contrast system font stack with generous line spacing and a 700-pixel reading column, long-form reporting becomes effortless to scan on both a commuter train and a twenty-seven-inch studio display."
        },
        {
          id: "b3-heading",
          type: "heading",
          level: 2,
          text: "Precision Boundaries Between Editorial and Sponsorship"
        },
        {
          id: "b4",
          type: "paragraph",
          text: "In many publishing workflows, ad injection scripts count raw DOM nodes and accidentally split captions, blockquotes, or embedded videos in half. JoltFeed solves this by counting strictly nonempty, top-level body paragraphs while ignoring headings, lists, photos, and video embeds during paragraph numbering."
        },
        {
          id: "b5-image",
          type: "image",
          url: "/uploads/titanium-detail.jpg",
          alt: "Macro detail of brushed titanium chassis meeting laminated acoustic glass",
          caption: "Figure 1: Sub-millimeter chamfer tolerances eliminate visual distraction around the display perimeter."
        },
        {
          id: "b6",
          type: "paragraph",
          text: "Photography and video carry the emotional weight of a feature story. Every image and video container reserves its exact sixteen-by-nine aspect ratio before a single byte of media arrives over cellular networks, ensuring that paragraphs never jump underneath the reader's thumb."
        },
        {
          id: "b7",
          type: "paragraph",
          text: "Notice how this fifth paragraph crosses the fifty-percent word threshold of our eight-paragraph test article. Because the placement engine evaluates cumulative word count across top-level paragraphs, the fifty-percent ad rule inserts cleanly right after this paragraph without interrupting a sentence."
        },
        {
          id: "b8-video",
          type: "video",
          url: "/uploads/layout-stability-demo.mp4",
          posterUrl: "/uploads/studio-hero.jpg",
          caption: "Video 1: Reserved 16:9 media containers and deterministic ad boundaries prevent viewport jump on mobile."
        },
        {
          id: "b9",
          type: "paragraph",
          text: "Editors also need transparency before a campaign goes live. Inside the Admin Ads screen, selecting any published or draft story reveals labeled placement placeholders alongside clear diagnostics explaining why any rule was skipped or superseded by a higher-priority unit."
        },
        {
          id: "b10",
          type: "paragraph",
          text: "When readers navigate from one story to another through internal links and return to the original article, the placement lifecycle cleans up and re-evaluates deterministically so ad slots render exactly once at their designated locations."
        },
        {
          id: "b11",
          type: "paragraph",
          text: "From server-rendered Open Graph tags to instant sitemap regeneration on publish, every piece of the workflow is designed so a writer can focus entirely on the craft of the story."
        }
      ]
    },
    {
      id: "post-2",
      title: "Designing Coastal Spaces for Deep Focus",
      slug: "designing-coastal-spaces-for-deep-focus",
      excerpt: "Inside a minimalist timber and acoustic glass pavilion engineered for distraction-free writing along the northern coast.",
      author: "Marcus Vance",
      category: "Design",
      status: "published",
      publishedAt: "2026-11-08T11:15:00Z",
      featuredImage: "/uploads/coastal-pavilion.jpg",
      featuredPublicUrl: "https://joltfeed.example.com/uploads/coastal-pavilion.jpg",
      featuredCaption: "Designed for uninterrupted long-form reading and acoustic isolation by the sea.",
      hideFeaturedOnArticle: false,
      disableAds: false,
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
      blocks: [
        {
          id: "p2-b1",
          type: "paragraph",
          text: "Perched forty meters above the tide line, the North Point studio replaces drywall and synthetic insulation with untreated cedar, triple-pane acoustic glazing, and brushed aluminum hardware that weathers naturally in salt air."
        },
        {
          id: "p2-b2",
          type: "paragraph",
          text: "Every sightline inside the six-meter room directs attention toward the horizon. Worktables are milled from solid white oak with concealed cable channels so not a single power brick or adapter interrupts the surface."
        },
        {
          id: "p2-b3",
          type: "paragraph",
          text: "Acoustic engineers measured ambient wind noise across winter storms before specifying a floating timber floor that decouples footsteps from the structural frame."
        },
        {
          id: "p2-b4",
          type: "paragraph",
          text: "During afternoon hours, motorized exterior louvers track solar angles automatically, eliminating screen glare without dimming the natural warmth of the room."
        },
        {
          id: "p2-b5",
          type: "paragraph",
          text: "Writers visiting the studio consistently report completing long-form essays in half their usual time when freed from visual and auditory clutter."
        },
        {
          id: "p2-b6",
          type: "paragraph",
          text: "Use the Continue Reading link below to return to our primary eight-paragraph test article and verify that client-side navigation re-renders every ad unit cleanly once."
        }
      ]
    },
    {
      id: "post-3",
      title: "Field Notes: Milled Aluminum Tolerances",
      slug: "field-notes-milled-aluminum-tolerances",
      excerpt: "A short three-paragraph dispatch testing hidden featured images on the article view and automatic skipping of deep-paragraph ad rules.",
      author: "Elena Rostova",
      category: "Engineering",
      status: "published",
      publishedAt: "2026-11-07T09:00:00Z",
      featuredImage: "/uploads/titanium-detail.jpg",
      featuredPublicUrl: "https://joltfeed.example.com/uploads/titanium-detail.jpg",
      featuredCaption: "Precision CNC chamfer inspection.",
      hideFeaturedOnArticle: true,
      disableAds: false,
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
      blocks: [
        {
          id: "p3-b1",
          type: "paragraph",
          text: "This short dispatch contains exactly three top-level body paragraphs and has its featured image hidden on the article page while keeping the image active on homepage cards and Open Graph tags."
        },
        {
          id: "p3-b2",
          type: "paragraph",
          text: "Because the story has only three paragraphs, any ad rule targeting After Paragraph 5 is automatically skipped with a clear diagnostic message in the admin previewer."
        },
        {
          id: "p3-b3",
          type: "paragraph",
          text: "Single-piece CNC machining from recycled billet aluminum ensures uniform structural rigidity across every enclosure without internal plastic ribs."
        }
      ]
    },
    {
      id: "post-4",
      title: "Editorial Standards and Reader Trust",
      slug: "editorial-standards-and-reader-trust",
      excerpt: "Our policy on independent hardware testing, per-post ad suppression, and fallback social metadata when no featured image is set.",
      author: "JoltFeed Editorial Board",
      category: "Editorial",
      status: "published",
      publishedAt: "2026-11-05T16:45:00Z",
      featuredImage: "",
      featuredPublicUrl: "",
      featuredCaption: "",
      hideFeaturedOnArticle: false,
      disableAds: true,
      ogTitle: "JoltFeed Editorial Standards & Independence",
      ogDescription: "How we test products independently with per-article ad suppression enabled.",
      ogImage: "",
      blocks: [
        {
          id: "p4-b1",
          type: "paragraph",
          text: "Every review and policy statement on JoltFeed is produced independently by our editorial staff. On sensitive institutional articles like this one, the per-post Disable Ads toggle suppresses all automatic and manual ad units."
        },
        {
          id: "p4-b2",
          type: "paragraph",
          text: "In addition, this post intentionally has no featured image assigned so you can verify how the homepage card renders a clean typographic surface and how Open Graph tags automatically fall back to the sitewide default social image."
        },
        {
          id: "p4-b3",
          type: "paragraph",
          text: "Review units are purchased at retail or returned immediately after benchmarking. Advertising teams never preview editorial copy prior to publication."
        },
        {
          id: "p4-b4",
          type: "paragraph",
          text: "Corrections of factual errors are logged transparently at the bottom of the article with an exact timestamp."
        }
      ]
    }
  ]
};

function runSqliteQuery(pyScript, inputJson = "") {
  return execFileSync("python3", ["-c", pyScript, SQLITE_DB_PATH, inputJson], {
    encoding: "utf-8"
  });
}

export function initDatabase() {
  fs.mkdirSync(path.dirname(SQLITE_DB_PATH), { recursive: true });
  const pyInit = `
import sqlite3, sys, json
db_path = sys.argv[1]
seed = json.loads(sys.argv[2])
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
c.execute("SELECT COUNT(*) FROM kv_store WHERE key = 'state'")
if c.fetchone()[0] == 0:
    c.execute("INSERT INTO kv_store (key, value) VALUES ('state', ?)", (json.dumps(seed),))
    conn.commit()
conn.close()
`;
  runSqliteQuery(pyInit, JSON.stringify(DEFAULT_SEED));
}

export function readState() {
  initDatabase();
  const pyRead = `
import sqlite3, sys
conn = sqlite3.connect(sys.argv[1])
c = conn.cursor()
c.execute("SELECT value FROM kv_store WHERE key = 'state'")
row = c.fetchone()
conn.close()
print(row[0] if row else "{}")
`;
  const raw = runSqliteQuery(pyRead);
  return JSON.parse(raw);
}

export function writeState(newState) {
  initDatabase();
  const pyWrite = `
import sqlite3, sys
conn = sqlite3.connect(sys.argv[1])
c = conn.cursor()
c.execute("INSERT OR REPLACE INTO kv_store (key, value) VALUES ('state', ?)", (sys.argv[2],))
conn.commit()
conn.close()
`;
  runSqliteQuery(pyWrite, JSON.stringify(newState));
  return newState;
}
