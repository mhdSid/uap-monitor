# Deploy Guide — UAP Monitor

## Architecture Overview

UAP Monitor runs on **Cloudflare Pages** with zero server infrastructure:

- **Frontend:** Static Vite build → Cloudflare Pages CDN
- **Submissions API:** Cloudflare Pages Functions (serverless, `/api/submit`)
- **Storage:** Cloudflare Workers KV (key-value store, free tier)
- **Domain:** `uapmonitor.org` → Cloudflare DNS

## Prerequisites

- Node.js 18+
- Yarn
- Cloudflare account (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/): `npm install -g wrangler`

## 1. Initial Setup

```bash
# Clone and install
git clone <repo-url>
cd uap-monitor
yarn install

# Login to Cloudflare
wrangler login
```

## 2. Create KV Namespace

The submission form stores reports in Cloudflare Workers KV.

```bash
# Create production namespace
wrangler kv namespace create uap-monitor

# Create preview namespace (for local dev)
wrangler kv namespace create uap-monitor --preview
```

Both commands output namespace IDs. Copy them into `wrangler.toml`:

```toml
name = "uap-monitor"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "UAP_SUBMISSIONS"
id = "<production-id-from-step-above>"
preview_id = "<preview-id-from-step-above>"
```

## 3. Configure in Cloudflare Dashboard

If deploying via the Cloudflare Pages dashboard (Git integration):

1. Go to **Workers & Pages** → your project → **Settings** → **Functions**
2. Under **KV namespace bindings**, add:
   - Variable name: `UAP_SUBMISSIONS`
   - KV namespace: select the one you created
3. Save

This is required because Pages Functions deployed via Git don't read `wrangler.toml` for bindings — they use the dashboard config.

## 4. Build & Deploy

```bash
# Build static site
yarn build

# Deploy to Cloudflare Pages
wrangler pages deploy dist

# Or if using Git integration, just push:
git push origin main
```

The `functions/api/submit.ts` file is automatically detected by Cloudflare Pages Functions and deployed as a serverless endpoint at `/api/submit`.

## 5. Local Development

```bash
# Dev server with Pages Functions support
yarn dev

# Or with wrangler (includes KV bindings):
wrangler pages dev dist --kv UAP_SUBMISSIONS
```

## 6. Data Pipeline

### Sighting data (run periodically):
```bash
# Process all source data
yarn process:data:pipeline:all

# Generate nuclear facilities dataset
yarn fetch:nuclear
```

### News feeds (run daily/weekly):
```bash
# All news sources
yarn fetch:gdelt
GNEWS_API_KEY=xxx yarn fetch:gnews
TWITTER_BEARER_TOKEN=xxx yarn fetch:twitter
```

### Fetch all at once:
```bash
yarn fetch:all
```

## 7. Reading Submissions from KV

```bash
# List all submissions
wrangler kv:key list --namespace-id=<your-namespace-id>

# Read a specific submission
wrangler kv:key get --namespace-id=<your-namespace-id> "sub:xxxxx:yyyyy"

# Bulk export (all keys → JSON)
wrangler kv:key list --namespace-id=<your-namespace-id> --prefix="sub:" | \
  jq -r '.[].name' | \
  while read key; do
    wrangler kv:key get --namespace-id=<your-namespace-id> "$key"
  done
```

## 8. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TWITTER_BEARER_TOKEN` | For Twitter fetch | Twitter API v2 bearer token |
| `GNEWS_API_KEY` | For GNews fetch | GNews.io API key |

These are only needed for the fetch scripts, not for the deployed site.

## Cost

Everything runs on Cloudflare's free tier:

| Resource | Free Tier Limit | UAP Monitor Usage |
|----------|----------------|-------------------|
| Pages | Unlimited sites, 500 builds/month | 1 site |
| Functions | 100K requests/day | ~100-500/day |
| KV reads | 100K/day | Minimal |
| KV writes | 1K/day | ~0-50/day |
| KV storage | 1 GB | < 10 MB |
| Bandwidth | Unlimited | Unlimited |

## File Structure

```
functions/
  api/
    submit.ts          ← POST /api/submit (Pages Function)
wrangler.toml          ← KV binding config
public/
  data/                ← Static JSON datasets
src/
  components/
    submit-form/       ← Form UI component
  composables/         ← Reactive state + data loaders
  data/
    strings.ts         ← All UI strings (single source of truth)
  enums/               ← Shape, source, tag enums
  types/               ← TypeScript interfaces
  utils/
    dom.ts             ← DOM abstraction layer
```
