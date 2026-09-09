# Catalogue name audit — September 9, 2026

The audit processed all 3,007 cover images using Apple Vision text recognition in English and French. The initial review flagged 817 covers for placeholder names, multi-company archive headings, unusually long titles, or malformed text. A second pass checked the rest of the catalogue for issuer mismatches.

**1,241 names were corrected or normalized**, including all 40 `[Corporate reports]` entries and all 13 `Miscellaneous` entries. Of those changes, 399 are typographic normalization (punctuation, spacing, accents, and spelling). The remaining changes identify the issuer or replace collection-level headings with a readable company name.

Corrections use printed cover text, the source item's individual report filename, and comparison within the same issuer's report series. A subsidiary or product logo is not treated as the issuer when the report identifies a different parent company. The two Fraser reports that show the Noranda group logo therefore retain Fraser as their issuer.

Examples:

| Previous catalogue label | Corrected name | Report |
| --- | --- | --- |
| `[Corporate reports]` | O'Brien Gold Mines Limited | 1958 |
| `[Corporate reports]` | Hudson's Bay Company | 1985 |
| Multi-company Dayton/Target archive heading | Dayton Corporation | 1967 |
| Walgreens/WBA archive heading | Boots | 1987 source record |
| Marks & Spencer Group PLC | Marks & Spencer Canada Inc. | 1983 |
| Farm Credit Canada | Farm Credit Corporation | 1960 |
| Alaska Airlines | Alaska Air Group | 1988 |
| National Biscuit Company (Nabisco) | Nabisco Brands | 1987 |

The [correction log](catalog-name-corrections.json) records each affected ID, previous name, new name, evidence basis, cover URL, and original source URL. Report IDs, source URLs, years, and page mappings are unchanged. Search vectors were regenerated from the corrected catalogue, with a regression test checking every indexed document against the current report data.

## Scope and limits

This is a machine-assisted cover-text audit, not a claim that all 3,007 names were independently transcribed by a person. Nineteen covers yielded no readable OCR text. Their names remain based on the attributed source or report-series identity rather than invented text. Stylized wordmarks, library stamps, subsidiary logos, and some cover/source-year discrepancies require judgment; dates were not inferred or rewritten as part of this name audit.
