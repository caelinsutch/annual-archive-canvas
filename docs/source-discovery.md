# Annual report source discovery

Verified September 9, 2026. Discovery focuses on original corporate annual reports from the 1950s–1980s. A PDF is accepted only after downloading it, checking its page count, and visually matching its cover and printed year. Catalogue dates alone are insufficient. University covers may have library stickers or scan margins while depicting the same edition.

## Recovered complete IBM reports

Five Paul Rand records formerly exposed only one gallery image. Exact full originals were found in McGill's public digitization archive. These are now PDF manifests, with the original gallery URL retained as `source` and the actual document URL in `pdf`.

| Record | Verified PDF | Pages | Cover match |
| --- | --- | ---: | --- |
| `paulrand-ibm-1979` | [McGill 634063](https://public-content.library.mcgill.ca/digitization/634063.pdf) | 44 | Multicolor dotted curves on black; vertical 1979 title |
| `paulrand-ibm-1980` | [McGill 634062](https://public-content.library.mcgill.ca/digitization/634062.pdf) | 48 | Green and gold concentric conductor photograph; vertical 1980 title |
| `paulrand-ibm-1985` | [McGill 634061](https://public-content.library.mcgill.ca/digitization/634061.pdf) | 52 | Technician diagnosing a car using a computer |
| `paulrand-ibm-1986` | [McGill 634060](https://public-content.library.mcgill.ca/digitization/634060.pdf) | 48 | Multicolor semiconductor wafer photograph |
| `paulrand-ibm-1989` | [McGill 634059](https://public-content.library.mcgill.ca/digitization/634059.pdf) | 52 | Louvre pyramid illuminated at night |

Total: 244 document pages. Exact year/record guards prevent using one edition for another company or year. Downloaded evidence, original gallery images, and rendered PDF covers are preserved locally under `work/source-discovery/`; source URLs/manifests and generated search thumbnails are production data. All 244 PDF pages are visually indexed.

## Existing source coverage

- **University of Washington CONTENTdm:** all 316 parent records answered the metadata audit. There are 158 direct PDF records and 158 compound records. Of the compound records, 157 have accessible PDF children. Thus 315 PDF originals are verified at metadata level. The remaining [record 4039](https://digitalcollections.lib.washington.edu/digital/collection/reports/id/4039) points to missing child 44892; both its child metadata and IIIF manifest returned 404.
- **Critical CONTENTdm behavior:** a PDF report may publish a one-canvas IIIF manifest representing its cover. The resolver must prioritize `contentType: application/pdf` and the real `downloadUri`, then follow single PDF children for compound records. Metadata `/api/...` download URIs are relative to `/digital`.
- **User's UW example:** [Ketchikan Pulp Company 1961, record 43767](https://digitalcollections.lib.washington.edu/digital/collection/reports/id/43767) downloaded as a valid **13-page PDF**, despite its one-canvas IIIF manifest. Its actual [download endpoint](https://digitalcollections.lib.washington.edu/digital/api/collection/reports/id/43767/download) is saved in the manifest.
- **Texas History / UNT:** all 21 report IIIF manifests returned successfully, providing **944 scan pages** with original image resources and dimensions.
- **Paul Rand archive:** all 60 catalogue records have published report/year image links. The original gallery audit found 1,412 image links. WebP headers were fetched to preserve each image's actual aspect ratio. Five one-image records have since been replaced by the complete IBM PDFs above.
- **Dayton 1967:** the Internet Archive original scandata and live local reader API both expose **40 pages**. Two distinct interior images were fetched successfully through the live proxy. Its previously observed cover-only display was not missing source data.

The initial external-source cache contains 396 manifests. After the five IBM replacements it comprises 320 PDF manifests and 76 scan manifests. PDF manifests have empty `pages` because PDF.js obtains the actual page list; an empty `pages` array must not be interpreted as unavailable content.

## Five verified additions from Columbia

[Columbia University Libraries Corporate Reports](https://archive.org/details/culcorporatereports) contains bound volumes. Five individual annual reports were isolated from [New York Airways volume `ldpd_6283902_000`](https://archive.org/details/ldpd_6283902_000), using OCR plus visual cover, title, back-cover, and next-report boundary checks.

| Added record | Year | Original leaves, inclusive | Pages |
| --- | ---: | --- | ---: |
| `columbia-new-york-airways-1954` | 1954 | 0–15 | 16 |
| `columbia-new-york-airways-1955` | 1955 | 16–31 | 16 |
| `columbia-new-york-airways-1956` | 1956 | 32–47 | 16 |
| `columbia-new-york-airways-1957` | 1957 | 48–63 | 16 |
| `columbia-new-york-airways-1958` | 1958 | 64–83 | 20 |

Total: **84 pages**, with 21 successful evidence-image downloads including an interior page from every report. These five records are integrated in `public/catalog.json`, with bounded manifests in `public/source-manifests/`, local covers in `public/covers/`, and committed provenance in `docs/columbia-provenance.json`. All 84 pages are visually indexed. These cached subset manifests must precede the generic Internet Archive resolver, which otherwise resolves the entire bound volume. No complete-volume PDF is advertised as the PDF for one isolated annual report.

Columbia metadata may describe a catalogue/volume rather than every contained year. For example, `ldpd_in00034167488_000` carries 1953 metadata but the inspected material covers 1937–1945. Never assign report years solely from volume metadata.

## Additional verified candidates

Two neighboring McGill originals were downloaded and their printed cover years inspected, but are not automatically added by the source adapter:

- [International Forest Products Limited, 1987](https://public-content.library.mcgill.ca/digitization/634058.pdf): **40 pages**, cream cover, blue typography and pine-branch image.
- [Montreal Transportation Commission, 1952](https://public-content.library.mcgill.ca/digitization/634064.pdf): **92 pages**, dark blue cover with gold lettering stating annual report as at November 30, 1952.

Both are distinct companies, not interchangeable IBM substitutes.

## Missing originals after external searches

**21 catalogue records remain single-image galleries:**

- IBM: 1960, 1962, 1968, 1969, 1970, 1972, 1973, 1976, 1978, 1981, 1982, 1983, 1984, 1987, 1988, 1990, 1992.
- US Westinghouse Electric: 1970, 1971, 1978, 1979.

The [Paul Rand IBM gallery](https://paulrand.design/work/IBM.html) and [Westinghouse gallery](https://paulrand.design/work/Westinghouse.html) publish a single image for these editions and no corresponding PDF links. Exact substitutes were sought beyond the application catalogue. No verified accessible complete edition was found for these 21; this is a search result, not a claim that no copy exists anywhere.

Useful holdings and search evidence:

- [Alabama Bruno Library IBM holdings](https://www.lib.ua.edu/libraries/bruno/annual-reports/historical-annual-reports-collection/historical-annual-reports-i/), code I3, 1922–1981 except 1958/1980, are physical holdings.
- [Alabama Westinghouse holdings](https://www.lib.ua.edu/libraries/bruno/annual-reports/historical-annual-reports-collection/historical-annual-reports-w-x-y-z/), code W37, 1921–1980 except 1932, are physical holdings and include all four missing Westinghouse target years.
- [Purdue CBS/Westinghouse holdings](https://apps.lib.purdue.edu/arsweball/view.php?ID=2624) identify original holdings, not an accessible PDF.
- [Yale Paul Rand finding aid](https://ead-pdfs-new.library.yale.edu/322.pdf), page 27, describes Westinghouse 1970–1979 **cover designs**; it does not establish complete digitized reports.
- [Google Books Michigan scan](https://books.google.com/books?vid=UOM%3A39015085518317) is snippet-only. Its 1970 publication metadata accompanies financial statements for 1969, so it was not substituted for the fiscal 1970 cover.
- Internet Archive's direct title search returned Canadian Westinghouse reports and Paul Rand cover objects, not the target US company's full editions. Canadian Westinghouse was excluded as a different entity. UW search yielded no Westinghouse reports.
- McGill's public browse/search and uncatalogued indexes, IBM's current financial-reporting archive, general web searches, and an IBM historical-data dashboard were inspected. The latter publishes extracted text/provenance but its referenced original PDF path returned 404; extracted text is insufficient for this visual archive.
- SVA and AIGA/Wayback sources outside these exact replacements still require source-specific work; no invented image or document URLs are used for them.

## HP archive requires human verification

The [HP Computer Museum annual-report index](https://www.hpmuseum.net/exhibit.php?content=Annual+Reports) lists 33 candidates for 1957–1989. Its sampled download endpoints present explicit human-verification challenges, and direct automated requests receive an automated-harvesting restriction. Those controls were not bypassed.

The candidate inventory in `work/source-discovery/hp/` records 1,111 pages claimed by filenames, **not verified page counts**. Zero HP PDFs or covers were validated, so none is integration-ready. Completion requires permitted, user-assisted downloads or archive permission. Inferred endpoint patterns in that scratch inventory are explicitly unverified and must not become production manifests.

## Validation

Twelve source-adapter tests pass, covering UW PDF and compound resolution, IIIF v2/v3, report/year filtering, actual WebP dimensions, unknown-source fallback, and all five exact IBM PDF replacements. Source discovery scripts, response metadata, downloaded evidence and visual contact sheets are retained in `work/source-discovery/` for reproduction.

## September 10 expansion: downloaded reading pages

A round-robin batch across issuers downloaded **100 additional University of Washington PDF reports**, producing **2,259 real page scans**. Two transient download failures were retried successfully; the second original was a 238 MB, 28-page PDF. No report was replaced with a cover-only approximation.

Each original was checked for a PDF signature and parsed with `pdfinfo`. Poppler rendered every page, and the rendered file count had to match the PDF's page count before its manifest was updated. The original page aspect ratio is retained in 1,600-pixel reading images and 600-pixel thumbnails. First/last-page geometry and every asset path are covered by automated integrity checks; selected interior scans were also inspected visually.

The reader serves cached pages from `public/report-pages/` through the existing report-bound page endpoint. The manifest keeps the original PDF URL, SHA-256 checksum, byte size, page count, and download date. Original PDFs remain in ignored `work/pdf-cache/`; deployable page images and manifests are committed. The acquisition log is [page-cache-expansion.json](page-cache-expansion.json).

Run `npm run expand:pages` to acquire another diverse batch of unindexed PDF reports, resume embeddings, run search evaluations and asset checks, and refresh the README count. Use `-- --all` for all remaining verified PDFs, `-- --limit 25` for smaller batches, or `-- --ids uw43767` for a specific source. `-- --dry-run` previews eligibility without writing files. An eight-query known-page retrieval set across eight of these reports supplements the original Cummins evaluation; it is intentionally scoped within each report and does not measure global relevance or taxonomy accuracy.


## September 10 continuation: all remaining verified PDFs

The next pass processed all **214 previously unindexed verified PDF reports**, adding **5,709 pages**. Four transient failures were retried successfully. The largest retry was Todd Shipyards' 1987 report: a 518 MB PDF with 89 pages. All 214 reports now have complete cached reading images, thumbnails, provenance, and page embeddings.

The cumulative download cache contains **7,968 pages from 314 reports**. Combined with the earlier scan sources, visual search contains **10,660 pages across 401 reports**. This completes the previously unindexed verified PDF backlog; it does not mean that all 3,007 catalogue reports have accessible or indexed full pages. Six already-indexed PDF sources continue using their existing readers.

The final retry ran through the new `npm run expand:pages` workflow, including all three search evaluation suites, complete cached-page integrity checks, and the README coverage update. The expanded eight-page retrieval fixture retains a financial-table miss (rank 20 within its report); it scores MRR@10 0.6125 and Hit@10 0.875. This small, report-scoped fixture remains an acquisition regression check, not a claim of global style-search accuracy.
