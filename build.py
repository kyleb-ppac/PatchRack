"""Bundle src/ into one self-contained file.

The version number lives in the VERSION file. Bump it (and add a CHANGELOG.md
entry) for every update that gets handed out.

dist/PatchRack-v<version>.html - standalone page you can double-click on a Mac
dist/patchrack.html            - page body only (used for the hosted preview)
dist/Line-Drawing-Tool.html    - separate tool: photo -> squared-up line drawing for gear photos
"""
from pathlib import Path

root = Path(__file__).parent
src = root / 'src'
dist = root / 'dist'
dist.mkdir(exist_ok=True)
version = (root / 'VERSION').read_text().strip()

page = (src / 'index.html').read_text()
css = (src / 'styles.css').read_text()
js = '\n'.join((src / f).read_text() for f in ['library.js', 'app.js', 'github.js', 'main.js'])

body = (page.replace('/*@@STYLES@@*/', css)
            .replace('/*@@SCRIPTS@@*/', f"const APP_VERSION = '{version}';\n" + js)
            .replace('@@VERSION@@', version))
(dist / 'patchrack.html').write_text(body)

standalone = (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<style>[hidden]{display:none!important} body{margin:0}</style>\n'
    '</head>\n<body>\n' + body + '\n</body>\n</html>\n'
)
out = dist / f'PatchRack-v{version}.html'
# keep only the current version in dist/ (older ones stay in GitHub history)
for old in dist.glob('PatchRack-v*.html'):
    if old != out:
        old.unlink()
out.write_text(standalone)
print('built', out.name, len(body) // 1024, 'KB')

tool = (src / 'tools' / 'line-drawing.html').read_text().replace('@@VERSION@@', version)
(dist / 'Line-Drawing-Tool.html').write_text(tool)
print('built Line-Drawing-Tool.html', len(tool) // 1024, 'KB')
