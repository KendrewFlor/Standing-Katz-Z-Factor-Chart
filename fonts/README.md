# Fonts

The page uses its own copies of these fonts, so it loads nothing from other sites.

| File | Font | Used for |
|---|---|---|
| `texgyreheros-regular.woff`, `texgyreheros-bold.woff` | TeX Gyre Heros 2.004 | Body text and controls |
| `texgyreheroscn-bold.woff` | TeX Gyre Heros Condensed 2.004 | Headings and chart lettering |
| `lmroman10-regular.woff`, `lmroman10-italic.woff` | Latin Modern Roman 10, 2.004 | Equations in the worked solution |
| `lmmono10-regular.woff` | Latin Modern Mono 10, 2.004 | Numbers and tables |

Both families come from the GUST e-foundry (B. Jackowski and J. M. Nowacki, for the TeX users groups). They are free fonts under the GUST Font License, which is in [GUST-FONT-LICENSE.txt](GUST-FONT-LICENSE.txt).

The files were taken from the TeX Live / Debian packages `fonts-texgyre` and `fonts-lmodern` (OpenType) and repackaged as WOFF with fontTools. WOFF only compresses the font tables, so the glyphs, metrics and names are unchanged. The fonts were not subset or edited.

Characters these fonts don't have (such as Greek in Latin Modern, or subscript digits) fall back to the reader's system fonts.
