"""Check that every official link in content.js (SOURCES) still opens.
Prints one line per link and exits with code 1 if any link is broken, so the weekly job can flag it."""
import re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'app' if (ROOT / 'app').is_dir() else ROOT
UA = 'Mozilla/5.0 (KinderGuide Ottawa link check; SED3111 uOttawa student project)'
links = re.findall(r"(\w+): \{ label: '[^']*', url: '([^']+)' \}", (SITE / 'content.js').read_text())

broken = []
for key, url in links:
    # curl uses the system certificates; GET (not HEAD), because some government sites refuse HEAD
    out = subprocess.run(['curl', '-s', '-L', '-o', '/dev/null', '-m', '30', '-A', UA, '-w', '%{http_code}', url], capture_output=True, text=True).stdout
    code = int(out or 0)
    ok = 200 <= code < 400
    print(f"{'ok ' if ok else 'BROKEN'} {code} {key}: {url}")
    if not ok: broken.append(key)
print(f"{len(links) - len(broken)} of {len(links)} links work" + (f"; broken: {', '.join(broken)}" if broken else ''))
sys.exit(1 if broken else 0)
