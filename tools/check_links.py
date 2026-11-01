"""Check that every official link in content.js (SOURCES) still opens, and is not a "page not found" page
(some sites answer a missing page with a normal status code, so the page text is checked too).
ottawa.ca shows automated tools only a bot-protection page, so its links cannot be checked this way: they are
listed as "check by hand" (open them in a normal browser) and do not fail the job.
Links marked noCheck (the registry itself, whose terms forbid automated access) are skipped.
Prints one line per link and exits with code 1 if any link is broken, so the weekly job can flag it."""
import re, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'app' if (ROOT / 'app').is_dir() else ROOT
UA = 'Mozilla/5.0 (KinderGuide Ottawa link check; SED3111 uOttawa student project)'
links = re.findall(r"(\w+): \{ label: '[^']*', url: '([^']+)' \}", (SITE / 'content.js').read_text())

NOT_FOUND = re.compile(r'page you are looking for cannot be found|<title>[^<]*(page not found|not found|404)[^<]*</title>|page introuvable', re.I)
broken, by_hand = [], []
for key, url in links:
    # curl uses the system certificates; GET (not HEAD), because some government sites refuse HEAD
    with tempfile.NamedTemporaryFile() as f:
        out = subprocess.run(['curl', '-s', '-L', '-o', f.name, '-m', '30', '-A', UA, '-w', '%{http_code}', url], capture_output=True, text=True).stdout
        body = open(f.name, 'rb').read(400000).decode('utf8', 'ignore')
    code = int(out or 0)
    soft404 = 'html' in body[:2000].lower() and bool(NOT_FOUND.search(body))
    shield = code == 200 and len(body) < 5000 and 'NOINDEX' in body and '<script' in body   # bot-protection page, not the real page
    ok = 200 <= code < 400 and not soft404 and not shield
    print(f"{'ok ' if ok else 'CHECK BY HAND' if shield else 'BROKEN'} {code}{' page-not-found' if soft404 else ''} {key}: {url}")
    if shield: by_hand.append(key)
    elif not ok: broken.append(key)
print(f"{len(links) - len(broken) - len(by_hand)} of {len(links)} links checked and working" + (f"; check by hand in a browser: {', '.join(by_hand)}" if by_hand else '') + (f"; BROKEN: {', '.join(broken)}" if broken else ''))
sys.exit(1 if broken else 0)
