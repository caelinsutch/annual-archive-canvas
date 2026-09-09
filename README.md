# Annual Archive

A spatial archive of 3,002 annual reports, inspired by [annualreport.gallery](https://annualreport.gallery/). Built with Vite, Three.js, and a small Node server.

## Run

Requires Node.js 22 or later.

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
- Switch to Grid for a conventional, keyboard-accessible catalogue.
- Search with `/`; combine company, year, designer, or descriptions with decade, industry, and color filters.
- Save reports to a collection stored locally in your browser.
- Open a report directly into its WebGL page grid. Switch to Scroll for horizontal browsing, or click any page for focused reading. Left and right arrow keys turn pages in reading mode.
- Report links preserve the selected report in the URL.

## Sources and availability

The catalogue and cover images originate from Phil Hedayatnia's [Annual Report Archive](https://annualreport.gallery/). Each entry retains its original collection and source link. Report imagery and catalogue descriptions remain the property of their respective rights holders; inclusion here does not grant a new license to those materials.

The reader retrieves public Internet Archive scan manifests and displays actual page images. Direct PDF sources render through PDF.js. Records from collections without publicly available page scans show an attributed cover and a link to the source instead of invented pages. Source availability and loading speed depend on the external collections.

The server proxies only cover paths and PDF URLs belonging to known catalogue records. Arbitrary remote URLs are not accepted. No account, API key, database, or analytics service is required.

## Implementation

- Virtualized Three.js plane meshes with velocity-driven vertex distortion, eased movement, and bounded texture caching.
- DOM buttons provide semantic, keyboard-operable equivalents and cover-image fallback if WebGL is unavailable.
- Native dialogs manage focus and Escape dismissal; reduced-motion preferences disable animated deformation and easing.
- Scan manifests preserve original leaf identifiers and exclude pages marked inaccessible.
- PDF.js loads separately from the initial gallery bundle.

## Verification

`npm test` covers catalogue integrity, source identity resolution, scan pagination, and inaccessible leaves. The gallery and reader are also exercised manually in Chromium at desktop and mobile sizes.
