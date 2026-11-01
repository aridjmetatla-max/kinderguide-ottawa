"""Add map coordinates to each provider using OpenStreetMap Nominatim.
Follows the Nominatim usage policy: 1 request per second, identifying User-Agent, results cached.
Output: app/data/geocode_cache.json  {id: {lat, lon, how}}"""
import json, subprocess, time, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'app' if (ROOT / 'app').is_dir() else ROOT   # this project folder, or the published repo (tools/ next to the site)
RAW = SITE / 'data' / 'providers_raw.json'
CACHE = SITE / 'data' / 'geocode_cache.json'
UA = 'SED3111-uOttawa-student-project/1.0 (child care map prototype)'
VIEWBOX = '-76.36,45.54,-75.24,44.96'   # City of Ottawa area

def ask(params):
    params.update({'format': 'json', 'limit': 1, 'countrycodes': 'ca', 'viewbox': VIEWBOX, 'bounded': 1})
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(params)
    # curl uses the system certificates (this Mac's Python does not have them installed)
    out = subprocess.run(['curl', '-s', '-m', '30', '-A', UA, url], capture_output=True, text=True, check=True).stdout
    res = json.loads(out)
    time.sleep(1.1)
    return res[0] if res else None

def clean_street(a):
    # "7-1650 Queensdale Avenue" -> "1650 Queensdale Avenue"; drop unit/box notes
    a = a.split(',')[0]
    if '-' in a.split(' ')[0]:
        a = a.split('-', 1)[1]
    return a.strip()

providers = json.loads(RAW.read_text())
cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
for i, p in enumerate(providers):
    if p['id'] in cache:
        continue
    hit, how = None, None
    try:
        hit = ask({'street': clean_street(p['address']), 'city': p['city'], 'state': 'Ontario', 'country': 'Canada'}); how = 'address'
        if not hit:
            hit = ask({'q': f"{clean_street(p['address'])}, Ottawa, Ontario"}); how = 'address-ottawa'
        if not hit and p['postal']:
            hit = ask({'postalcode': p['postal'], 'country': 'Canada'}); how = 'postal'
    except Exception as e:
        print('error', p['id'], e, flush=True); time.sleep(5); continue
    cache[p['id']] = {'lat': float(hit['lat']), 'lon': float(hit['lon']), 'how': how} if hit else None
    CACHE.write_text(json.dumps(cache, indent=0))
    print(i + 1, '/', len(providers), p['name'][:40], '->', how if hit else 'NOT FOUND', flush=True)
found = sum(1 for v in cache.values() if v)
print('done:', found, 'of', len(providers), 'located')
