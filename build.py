"""Bundle src/ into one self-contained file.

dist/patchrack.html  - the page body (used for the hosted preview)
dist/PatchRack.html  - a full standalone page you can double-click on a Mac
"""
from pathlib import Path

root = Path(__file__).parent
src = root / 'src'
dist = root / 'dist'
dist.mkdir(exist_ok=True)

page = (src / 'index.html').read_text()
css = (src / 'styles.css').read_text()
js = '\n'.join((src / f).read_text() for f in ['library.js', 'app.js'])

body = page.replace('/*@@STYLES@@*/', css).replace('/*@@SCRIPTS@@*/', js)
(dist / 'patchrack.html').write_text(body)

standalone = (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<style>[hidden]{display:none!important} body{margin:0}</style>\n'
    '</head>\n<body>\n' + body + '\n</body>\n</html>\n'
)
(dist / 'PatchRack.html').write_text(standalone)
print('built', len(body) // 1024, 'KB')
