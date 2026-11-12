# Bundled libraries for the line drawing tool

`build.py` inlines these into `dist/Line-Drawing-Tool.html` so it works offline.
They are only started when the browser can't open a photo by itself.

| File | Version | Licence | Used for |
|---|---|---|---|
| `heic2any.min.js` | heic2any 0.0.4 (Alex Corvi) | MIT | iPhone HEIC/HEIF photos |
| `UTIF.js` | utif 3.1.0 (Photopea) | MIT | TIFF files |
| `pako_inflate.min.js` | pako 1.0.11 | MIT | compressed TIFF files (needed by UTIF) |
