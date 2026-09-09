# Annual Archive

A spatial archive of 3,002 annual reports, inspired by [annualreport.gallery](https://annualreport.gallery/). Built with Astro, TypeScript, StyleX, and Three.js.

## Run

Requires Node.js 22.12 or later.

```sh
npm install
npm run dev
```

Open http://localhost:3000.

```sh
npm test
npm run build
npm start
```

Production listens on `PORT` (default 3000). Deploy as a Node service with build command `npm ci && npm run build` and start command `npm start`. The Node server is required for the source API; this is not a static-only application.

## Explore

- Drag in any direction or scroll to wander through the infinite archive.
- Pinch or use the dock to zoom. Arrow keys pan a focused canvas.
- Switch to Grid for a conventional, keyboard-accessible catalogue. Covers animate between layouts, and returning to Canvas preserves your position.
- Search with `⌘K` (`Ctrl+K` on Windows/Linux) or `/`; combine company, year, designer, or descriptions with decade, industry, and color filters.
- Save reports to a collection stored locally in your browser.
- Open a report directly into its WebGL page grid. Switch to Scroll for horizontal browsing, or click any page for focused reading. Left and right arrow keys turn pages in reading mode.
- Report links preserve the selected report in the URL.

## Sources and availability

The catalogue and cover images originate from Phil Hedayatnia's [Annual Report Archive](https://annualreport.gallery/). Each entry retains its original collection and source link. Report imagery and catalogue descriptions remain the property of their respective rights holders; inclusion here does not grant a new license to those materials.

The reader retrieves public Internet Archive scan manifests and displays actual page images. UW CONTENTdm downloads, Texas History IIIF manifests, Paul Rand image galleries, and direct PDF sources open inline. A verified cache contains 315 Washington PDFs plus 81 scanned galleries with 2,356 images. UW record 4039 has a broken upstream child; SVA and AIGA/Wayback records remain external. PDFs render through PDF.js. Records from collections without publicly available page scans show an attributed cover and a link to the source instead of invented pages. Source availability and loading speed depend on the external collections.

The server proxies only cover paths and PDF URLs belonging to known catalogue records. Arbitrary remote URLs are not accepted. No account, API key, database, or analytics service is required.

## Implementation

- Virtualized, undistorted Three.js image planes with eased panning, cursor-centered zoom, and bounded texture caching.
- DOM buttons provide semantic, keyboard-operable equivalents and cover-image fallback if WebGL is unavailable.
- Native dialogs manage focus and Escape dismissal; reduced-motion preferences disable spatial transitions and easing.
- Scan manifests preserve original leaf identifiers and exclude pages marked inaccessible.
- PDF.js loads separately from the initial gallery bundle.

## Verification

`npm test` covers catalogue integrity, source identity resolution, scan pagination, and inaccessible leaves. The gallery and reader are also exercised manually in Chromium at desktop and mobile sizes.

## Semantic search

All 3,002 catalogue descriptions, designers, industries, and colors are embedded with BGE-small-en-v1.5 (384 dimensions, quantized ONNX encoder). Search combines cosine similarity with lexical matches. These are text embeddings of the existing descriptions, not visual embeddings of the original page images. Query inference runs on the Node server; the model downloads on first use and is cached in `MODEL_CACHE_DIR` (default `work/models`). No API key is required.

Regenerate after catalogue changes with `npx tsx scripts/embed-catalog.ts`. Run the retrieval benchmark with `npx tsx scripts/benchmark-search.ts`.

## Visual page search

The Pages & design search scope uses CLIP image/text embeddings from actual page scans. Each indexed page receives suggested role, layout, typography, imagery, palette, and style tags. Similarity scores are not calibrated confidence values. Tags are suggestions, visible in the report information panel and searchable by clicking them.

`npm run index:pages` indexes the verified scan manifests, checkpointing every 20 pages. It resumes from the committed index. `INCLUDE_PDFS=1 REPORT_IDS=uw43767 npm run index:pages` also downloads and renders PDF pages; this offline job requires Poppler (`pdftoppm`) on PATH. `REPORT_IDS` and `PAGE_LIMIT` optionally bound a batch. Query inference runs on the Node server; bulk indexing is a separate background process. Cloud deployment of indexing is not configured.

The visual index covers successfully processed pages only; the search interface reports the current count. It does not imply that every page of every catalogue record has been indexed.

## Search checks and evaluations

- `npm test`: deterministic ranking, filters, stale-request guards, index integrity, taxonomy, and source-adapter tests.
- `TEST_URL=http://localhost:3000 npm test`: adds live search, PDF resolution, and page API tests.
- `npm run test:browser`: runs Chromium smoke checks through the installed agent-browser CLI against a running local server.
- `npm run eval:search`: 20 editorial known-item queries across the whole catalogue, split into ten development queries and ten held-out queries; compares hybrid retrieval against keyword search.
- `npm run eval:pages`: ten independently inspected visual queries within the 24-page Cummins 1966 report.
- `npm run eval:check`: fails below the recorded retrieval floors (held-out text MRR@10 0.65, Recall@10 0.8; visual MRR@10 0.65, Recall@5 0.7).

Machine-readable results and fixed held-out queries live in `benchmarks/`. These small editorial evaluations are regression checks, not a comprehensive human relevance or style-classification study. Warm query timings exclude initial model loading. The full text benchmark still contains difficult misses; overall hybrid and lexical MRR are approximately equal, while hybrid improves the held-out split.

The initial splash and report loader have a tokenized 800 ms minimum and reveal only after visible images settle. Reduced motion skips spatial animation. The reader keeps thumbnails visible while higher-resolution images load.
