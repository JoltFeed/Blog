# JoltFeed — Fast, Mobile-First Publishing Platform & Ad Placement Manager

JoltFeed is an Apple-style minimalist digital publication and CMS featuring a unified `/admin` workspace, persistent SQLite/PostgreSQL storage, deterministic ad placement management across 9 placement strategies, server-rendered Open Graph metadata, and dynamic `/sitemap.xml` generation.

## Quick Start & Setup Instructions

1. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and set your secrets (keep `.env` out of Git):
   ```bash
   cp .env.example .env
   ```

2. **Create or Reset Your First Administrator Account**:
   Run the included CLI bootstrap script with your chosen email and password:
   ```bash
   npm run create-admin -- admin@joltfeed.com "YourStrongPassword2026!"
   ```

3. **Run the Production Build & Verification Suite**:
   ```bash
   npm run build
   npm test
   ```

4. **Start the Application Server**:
   ```bash
   npm start
   ```
   - **Public Website**: `http://localhost:3040/`
   - **Admin Panel**: `http://localhost:3040/admin`
   - **Dynamic Sitemap**: `http://localhost:3040/sitemap.xml`

## Required Environment Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | HTTP server listening port | `3040` |
| `PUBLIC_SITE_URL` | Canonical base URL for Open Graph & `/sitemap.xml` | `https://joltfeed.example.com` |
| `SITE_NAME` | Initial publication title (editable in `/admin`) | `JoltFeed` |
| `SQLITE_DATA_PATH` | Persistent SQLite database file path | `./data/joltfeed.sqlite` |
| `DATABASE_URL` | Optional PostgreSQL connection string for managed cloud DB | `postgresql://user:pass@host:5432/joltfeed` |
| `UPLOADS_DIR` | Persistent directory for uploaded photos and videos | `./public/uploads` |
| `ADMIN_EMAIL` | Bootstrap administrator email | `admin@joltfeed.com` |
| `ADMIN_PASSWORD` | Bootstrap administrator password | *(Set in `.env`)* |
| `SESSION_SECRET` | Random 64-character hex secret for signing sessions | *(Set in `.env`)* |

## Exact Steps to Publish Your First Post

1. Open `/admin` and sign in with your administrator email and password.
2. In the left sidebar, select **Posts** and click **+ Write New Story**.
3. Enter your **Headline / Title**, verify or customize the **Editable URL Slug**, and add an optional **Excerpt**, **Author**, and **Category**.
4. Click **Choose Media** under **Featured Image** (or upload a photo in **Media**) and optionally toggle **Hide featured image on article page** if you only want the image shown on homepage cards and social previews.
5. Use the **Article Body Blocks** toolbar (`+ Paragraph`, `+ Heading`, `+ Image`, `+ Video`, `+ YouTube/Vimeo`, `+ Quote`, `+ List`, `+ Manual Ad Slot`) to compose your story. Drafts autosave automatically.
6. Click **Mobile Preview** or **Desktop Preview** to verify layout and ad boundaries, then click **Publish / Update** to make the story live on the homepage and `/sitemap.xml`.

## Exact Steps to Add and Preview Your First Ad

1. In `/admin`, open **Ads** in the left sidebar.
2. (Optional) Paste your ad network's header/init script into **Sitewide Provider Bootstrap Code** and set **Sitewide Max Ads Per Article**, then click **Save Global**.
3. Click **+ Create Named Ad Unit**, enter a descriptive **Ad Name**, and select one of the 9 placements (`Before title`, `After title`, `Before first paragraph`, `Before paragraph number`, `After paragraph number`, `Every N paragraphs`, `By percentage of article length`, `After post`, or `Manual position`).
4. Set the **Minimum Article Length (Words)**, **Device Target** (`All Devices`, `Mobile Only`, or `Desktop Only`), and numeric **Priority** (higher priority wins when two rules target the exact same boundary).
5. Paste your provider's `<script>`, HTML snippet, or `<iframe>` code into **Provider Ad Code**, ensure **Enable this ad rule immediately** is checked, and click **Save Ad Unit**.
6. Scroll down to **Preview Placements on a Real Story**, choose any post and viewport (`Desktop` or `Mobile`), and inspect the labeled placement placeholders and skip diagnostics before connecting a live ad account.
