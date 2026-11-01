"""Download the latest open data used by KinderGuide (run by the weekly GitHub job, or by hand).
1. City of Ottawa, Licensed Child Care Providers (xlsx) and the portal's "last updated" date
2. OpenStreetMap bus stops and O-Train stations (one Overpass query) -> tools/sources/osm_transit.json
Writes KG_XLSX, KG_DOWNLOADED and KG_CITY_UPDATED to $GITHUB_ENV when it exists, for the next steps."""
import datetime as dt, json, os, subprocess, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEM = 'https://www.arcgis.com/sharing/rest/content/items/388a593a328b4f548bf97b129fb198e0'   # City of Ottawa open data item
XLSX = ROOT / "Children's_Services_Agencies_List.xlsx"
UA = 'SED3111-uOttawa-student-project/1.0 (KinderGuide Ottawa weekly data update)'
BBOX = '44.96,-76.36,45.54,-75.24'   # City of Ottawa area
QUERY = (f'[out:json][timeout:90];(node["highway"="bus_stop"]({BBOX});nwr["railway"="station"]({BBOX});'
         f'nwr["public_transport"="station"]({BBOX}););out center tags;')
KEEP = ('name', 'highway', 'railway', 'public_transport', 'station', 'network', 'operator', 'opening_date', 'start_date',
        'construction:railway', 'proposed:railway', 'ref', 'disused', 'bus')

def curl(*args):
    return subprocess.run(['curl', '-s', '-L', '-f', '-m', '180', '-A', UA, *args], capture_output=True, check=True).stdout

today = dt.date.today().isoformat()
item = json.loads(curl(ITEM + '?f=json'))
city_updated = dt.datetime.fromtimestamp(item['modified'] / 1000, dt.timezone.utc).date().isoformat()
XLSX.write_bytes(curl(ITEM + '/data'))
print(f'City file: {item.get("name")} (portal date {city_updated}), {XLSX.stat().st_size} bytes')

els = json.loads(curl('--data-urlencode', 'data=' + QUERY, 'https://overpass-api.de/api/interpreter'))['elements']
keep = []
for e in els:
    lat, lon = e.get('lat') or e.get('center', {}).get('lat'), e.get('lon') or e.get('center', {}).get('lon')
    if lat is not None:
        keep.append({'t': e['type'], 'id': e['id'], 'lat': lat, 'lon': lon, 'tags': {k: v for k, v in e['tags'].items() if k in KEEP}})
if len(keep) < 3000:   # a partial answer from Overpass: keep last week's file instead
    raise SystemExit(f'Overpass returned only {len(keep)} elements; keeping the previous transit file')
(ROOT / 'tools/sources/osm_transit.json').write_text(json.dumps(
    {'source': 'OpenStreetMap contributors, Overpass API', 'downloaded': today, 'licence': 'ODbL 1.0', 'elements': keep}, ensure_ascii=False))
print(f'OpenStreetMap: {len(keep)} stops and stations')

if os.environ.get('GITHUB_ENV'):
    with open(os.environ['GITHUB_ENV'], 'a') as f:
        f.write(f'KG_XLSX={XLSX}\nKG_DOWNLOADED={today}\nKG_CITY_UPDATED={city_updated}\n')
