"""Turn the City's xlsx (Licensed Child Care Providers) into app/data/providers_raw.json.
Reads the xlsx directly (it is a zip of XML), so no extra Python packages are needed."""
import json, os, re, sys, zipfile, xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'app' if (ROOT / 'app').is_dir() else ROOT   # this project folder, or the published repo (tools/ next to the site)
SRC = Path(os.environ.get('KG_XLSX', ROOT / "Children's_Services_Agencies_List.xlsx"))
OUT = SITE / 'data' / 'providers_raw.json'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def sheets(path):
    z = zipfile.ZipFile(path)
    shared = [''.join(t.text or '' for t in si.iter('{%s}t' % NS['m']))
              for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
    out = []
    for i in (1, 2):
        rows = []
        for r in ET.fromstring(z.read(f'xl/worksheets/sheet{i}.xml')).find('m:sheetData', NS):
            cells = {}
            for c in r:
                col = re.match(r'[A-Z]+', c.get('r')).group()
                v = c.find('m:v', NS)
                val = '' if v is None else (shared[int(v.text)] if c.get('t') == 's' else v.text)
                cells[col] = val.strip()
            rows.append(cells)
        out.append(rows)
    return out

def col_values(row, n):
    cols = [chr(65 + i) for i in range(n)]
    return [row.get(c, '') for c in cols]

def tidy_city(c):
    c = c.strip().title()
    return {'Orleans': 'Orléans'}.get(c, c)

def num(x):
    try: return int(float(x))
    except ValueError: return 0

centres, homes = sheets(SRC)
providers = []
# Stable ids: a program keeps its id when the City publishes a new file (shortlists, shared links and
# inspection matches use these ids). New programs get the next free number.
def previous():   # last run's file; in the published repo only providers.js is kept (it hides private licensees' names)
    if OUT.exists(): return json.loads(OUT.read_text())
    js = SITE / 'data' / 'providers.js'
    return json.loads(re.search(r'const PROVIDERS = (\[.*\]);', js.read_text()).group(1)) if js.exists() else []
prev = {(q['kind'], q['name'].lower(), q['address'].lower()): q['id'] for q in previous()}
taken = set(prev.values())
def new_id(kind, name, address):
    key = (kind, name.lower(), re.sub(r'\s+', ' ', address).lower())
    if key in prev: return prev[key]
    n = 1 + max([int(i[1:]) for i in taken] + [0])
    taken.add(f'{kind[0]}{n}'); return f'{kind[0]}{n}'
for row in centres[1:]:
    v = col_values(row, 16)
    if not v[1]:
        continue
    providers.append({
        'id': new_id('centre', v[1], v[10]), 'kind': 'centre',
        'name': v[1], 'operator': v[0],
        'spaces': {'infant': num(v[2]), 'toddler': num(v[3]), 'preschool': num(v[4]), 'kindergarten': num(v[5]),
                   'schoolAge': num(v[6]) + num(v[7])},
        'capacity': num(v[9]),
        'address': re.sub(r'\s+', ' ', v[10]), 'city': tidy_city(v[11]), 'postal': v[13].upper().strip(),
        'french': bool(v[14]), 'indigenous': bool(v[15]),
    })
for row in homes[2:]:   # first two rows are titles/headers
    v = col_values(row, 11)
    if not v[1]:
        continue
    providers.append({
        'id': new_id('home', v[1], ' '.join(x for x in v[3:6] if x)), 'kind': 'home',
        'name': v[1], 'operator': v[0], 'type': v[2],
        'address': ' '.join(x for x in v[3:6] if x), 'city': tidy_city(v[6]), 'postal': v[8].upper().strip(),
        'french': bool(v[9]), 'indigenous': bool(v[10]),
    })
OUT.write_text(json.dumps(providers, ensure_ascii=False, indent=1))
print(len(providers), 'providers ->', OUT)
print('centres', sum(p['kind'] == 'centre' for p in providers), 'homes', sum(p['kind'] == 'home' for p in providers))
