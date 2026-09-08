"""
Process raw electoral data from Alegeri Locale 2024 CSV files
into structured JSON files for the implicarecivica.ro web app.

Only processes: Primari (P), Consiliu Local (CL), Președinte CJ (PCJ).
"""
import csv
import json
import os
from collections import defaultdict

BASE = r'd:\alegeri locale 2024\Alegeri_locale_2024'
DATA_DIR = os.path.join(BASE, 'Alegeri locale 2024')
OUT_DIR = r'd:\544\app\public\data\alegeri-2024'
os.makedirs(OUT_DIR, exist_ok=True)

# ── Party abbreviations & colors ─────────────────────────────────
PARTY_ABBREV = {
    "PARTIDUL SOCIAL DEMOCRAT": "PSD",
    "PARTIDUL NAȚIONAL LIBERAL": "PNL",
    "ALIANȚA PENTRU UNIREA ROMÂNILOR": "AUR",
    "UNIUNEA SALVAȚI ROMÂNIA": "USR",
    "UNIUNEA DEMOCRATĂ MAGHIARĂ DIN ROMÂNIA": "UDMR",
    "ALIANȚA DREAPTA UNITĂ USR - PMP - FORȚA DREPTEI": "ADU",
    "ALIANȚA DREAPTA UNITĂ USR - PMP": "ADU",
    "ALIANȚA DREAPTA UNITĂ USR - FORȚA DREPTEI": "ADU",
    "PARTIDUL MIȘCAREA POPULARĂ": "PMP",
    "FORȚA DREPTEI": "FD",
    "ALIANȚA PMP - FORȚA DREPTEI": "PMP-FD",
    "PARTIDUL S.O.S. ROMÂNIA": "SOS",
    "PARTIDUL UMANIST SOCIAL LIBERAL": "PUSL",
    "PARTIDUL PRO ROMÂNIA": "PRO",
    "PARTIDUL VERDE": "PV",
    "PARTIDUL ECOLOGIST ROMÂN": "PER",
    "PARTIDUL NAȚIONALCONSERVATOR ROMÂN": "PNCR",
    "PARTIDUL NAȚIONAL CONSERVATOR ROMÂN": "PNCR",
    "ALIANȚA ELECTORALĂ PSD PNL": "PSD-PNL",
    "ALIANȚA ELECTORALĂ PSD PRO ROMÂNIA": "PSD-PRO",
    "ALIANȚA ELECTORALĂ PNL - PRO ROMÂNIA": "PNL-PRO",
    "ALIANȚA ELECTORALĂ PSD-PUSL": "PSD-PUSL",
    "ALIANȚA ELECTORALĂ PNL - PUSL": "PNL-PUSL",
    "FORUMUL DEMOCRAT AL GERMANILOR DIN ROMÂNIA": "FDGR",
    "ALIANȚA MAGHIARĂ DIN TRANSILVANIA - ERDÉLYI MAGYAR SZÖVETSÉG": "AMT",
    "PARTIDUL OAMENILOR TINERI": "POT",
    "PARTIDUL ALTERNATIVA DREAPTĂ": "PAD",
    "PARTIDUL ROMÂNIA MARE": "PRM",
}

PARTY_COLORS = {
    "PSD": "#dc2626",
    "PNL": "#eab308",
    "AUR": "#d97706",
    "USR": "#2563eb",
    "UDMR": "#16a34a",
    "ADU": "#3b82f6",
    "PMP": "#7c3aed",
    "FD": "#6366f1",
    "PMP-FD": "#7c3aed",
    "SOS": "#991b1b",
    "PUSL": "#ea580c",
    "PRO": "#0d9488",
    "PV": "#22c55e",
    "PER": "#4ade80",
    "PNCR": "#78716c",
    "PSD-PNL": "#dc2626",
    "FDGR": "#1e40af",
    "AMT": "#059669",
    "CI": "#6b7280",
}

# ── Size categories ──────────────────────────────────────────────
SIZE_CATS = [
    ("Sate și comune mici",       "COMUNA",    0,      1500),
    ("Comune medii",              "COMUNA",    1500,   3000),
    ("Comune mari",               "COMUNA",    3000,   5000),
    ("Comune foarte mari",        "COMUNA",    5000,   999999),
    ("Orașe mici",                "ORAS",      0,      8000),
    ("Orașe medii",               "ORAS",      8000,   20000),
    ("Orașe mari",                "ORAS",      20000,  999999),
    ("Municipii mici",            "MUNICIPIU", 0,      50000),
    ("Municipii medii",           "MUNICIPIU", 50000,  100000),
    ("Municipii mari",            "MUNICIPIU", 100000, 9999999),
]

ADAPTIVE_THRESHOLDS = {
    "Sate și comune mici":    [10, 30, 60, 100],
    "Comune medii":           [20, 70, 100, 200],
    "Comune mari":            [40, 100, 200, 400],
    "Comune foarte mari":     [100, 400, 700, 1000],
    "Orașe mici":             [50, 200, 300, 500],
    "Orașe medii":            [100, 300, 600, 1000],
    "Orașe mari":             [300, 900, 1000, 3000],
    "Municipii mici":         [200, 700, 1000, 2000],
    "Municipii medii":        [700, 2000, 4000, 7000],
    "Municipii mari":         [2000, 6000, 10000, 20000],
}

ADAPTIVE_LABELS = ["Extrem de strâns", "Foarte strâns", "Strâns", "Confortabil"]

GLOBAL_THRESHOLDS = [1, 2, 3, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000]

FUNNEL_ANALOGIES = {
    5:    "O singură familie",
    10:   "Vecinii de pe o uliță",
    50:   "O clasă de elevi",
    100:  "Enoriașii de la o slujbă",
    500:  "Un sat mic",
    1000: "Participanții la un târg comunal",
}


def classify_uat(name):
    if name.startswith("MUNICIPIUL"):
        return "MUNICIPIU"
    elif name.startswith("ORAŞ") or name.startswith("ORAS"):
        return "ORAS"
    return "COMUNA"


def get_size_cat(loc_type, eligible):
    for cat_name, lt, lo, hi in SIZE_CATS:
        if lt == loc_type and lo <= eligible < hi:
            return cat_name
    return "Necunoscut"


# ── Collect party names from CL/CJ ──────────────────────────────
print("Pass 1: Collecting party names...", flush=True)
known_parties = set()
f = open(os.path.join(DATA_DIR, 'bd_sectii_09.06.2024+07.07.2024.csv'), 'r', encoding='utf-8-sig')
reader = csv.DictReader(f, delimiter=';')
for row in reader:
    if row['tip_alegeri'] in ('CL', 'CJ', 'CGMB'):
        comp = row['Competitor']
        if comp.startswith('g-'):
            comp = comp[2:]
        # Skip independent candidates in CL/CJ (they have --CI suffix)
        if not comp.endswith('--CI'):
            known_parties.add(comp)
f.close()
print(f"  Found {len(known_parties)} party names", flush=True)

# Sort by length descending for greedy matching
sorted_parties = sorted(known_parties, key=len, reverse=True)


def split_candidate_party(comp_raw):
    """Split 'CANDIDAT NAME-PARTY NAME' into (candidate, party, abbrev)"""
    comp = comp_raw
    if comp.startswith('g-'):
        comp = comp[2:]

    # Independent candidates: ends with --CI
    if comp.endswith('--CI'):
        cand = comp[:-4]  # Remove --CI
        return cand, "Candidat Independent", "CI"

    # Try matching known parties from the end
    for party in sorted_parties:
        suffix = '-' + party
        if comp.endswith(suffix):
            cand = comp[:len(comp) - len(suffix)]
            abbrev = PARTY_ABBREV.get(party, party[:6])
            return cand, party, abbrev

    # Fallback: return as-is
    return comp, "", ""


def get_party_color(abbrev):
    return PARTY_COLORS.get(abbrev, "#6b7280")


# ── Pass 2: Read main CSV ───────────────────────────────────────
print("Pass 2: Reading main CSV file...", flush=True)
f = open(os.path.join(DATA_DIR, 'bd_sectii_09.06.2024+07.07.2024.csv'), 'r', encoding='utf-8-sig')
reader = csv.DictReader(f, delimiter=';')

# Only process P, CL, PCJ
WANTED_TYPES = {'P', 'CL', 'PCJ'}
agg = {}
sections_seen = {}

for row in reader:
    tip = row['tip_alegeri']
    if tip not in WANTED_TYPES:
        continue

    judet = row['Judet']
    uat = row['UAT']
    comp = row['Competitor']
    vve = int(row['VVE']) if row['VVE'] else 0
    nr_sv = row['nr_sv']
    key = (judet, uat)
    section_key = (judet, uat, nr_sv)

    if tip not in agg:
        agg[tip] = {}
        sections_seen[tip] = {}
    if key not in agg[tip]:
        agg[tip][key] = {'votes': defaultdict(int), 'a': 0, 'b': 0, 'c': 0, 'd': 0}
        sections_seen[tip][key] = set()

    agg[tip][key]['votes'][comp] += vve

    if section_key not in sections_seen[tip][key]:
        sections_seen[tip][key].add(section_key)
        agg[tip][key]['a'] += int(row['a']) if row['a'] else 0
        agg[tip][key]['b'] += int(row['b']) if row['b'] else 0
        agg[tip][key]['c'] += int(row['c']) if row['c'] else 0
        agg[tip][key]['d'] += int(row['d']) if row['d'] else 0

f.close()
print("CSV read complete.", flush=True)


# ── Build results ────────────────────────────────────────────────
def build_results(tip_data, tip):
    results = []
    for key, d in tip_data.items():
        sorted_c = sorted(d['votes'].items(), key=lambda x: -x[1])
        if len(sorted_c) < 2:
            continue

        margin = sorted_c[0][1] - sorted_c[1][1]
        a = d['a']; b = d['b']; c = d['c']
        non_voters = a - b
        loc_type = classify_uat(key[1])
        size_cat = get_size_cat(loc_type, a)

        if tip == 'P':
            first_cand, first_party, first_abbrev = split_candidate_party(sorted_c[0][0])
            second_cand, second_party, second_abbrev = split_candidate_party(sorted_c[1][0])
        else:
            # CL/CJ: competitor IS the party
            raw1 = sorted_c[0][0]
            if raw1.startswith('g-'):
                raw1 = raw1[2:]
            raw2 = sorted_c[1][0]
            if raw2.startswith('g-'):
                raw2 = raw2[2:]
            first_cand = ""
            first_party = raw1
            first_abbrev = PARTY_ABBREV.get(raw1, raw1[:6])
            second_cand = ""
            second_party = raw2
            second_abbrev = PARTY_ABBREV.get(raw2, raw2[:6])

        results.append({
            "judet": key[0],
            "uat": key[1],
            "locType": loc_type,
            "sizeCat": size_cat,
            "margin": margin,
            "marginPctElig": round(margin / a * 100, 2) if a > 0 else 0,
            "marginPctNonVoters": round(margin / non_voters * 100, 2) if non_voters > 0 else 0,
            "firstCand": first_cand,
            "firstParty": first_party,
            "firstAbbrev": first_abbrev,
            "firstColor": get_party_color(first_abbrev),
            "firstVotes": sorted_c[0][1],
            "secondCand": second_cand,
            "secondParty": second_party,
            "secondAbbrev": second_abbrev,
            "secondColor": get_party_color(second_abbrev),
            "secondVotes": sorted_c[1][1],
            "numCandidates": len(sorted_c),
            "eligible": a,
            "voted": b,
            "validVotes": c,
            "nullVotes": d['d'],
            "nonVoters": non_voters,
            "prezenta": round(b / a * 100, 1) if a > 0 else 0,
        })

    results.sort(key=lambda x: x['margin'])
    return results


# ── Build summary statistics ─────────────────────────────────────
def build_summary(results, label):
    total = len(results)
    if total == 0:
        return {}

    # Global threshold counts
    global_abs = []
    for t in GLOBAL_THRESHOLDS:
        count = sum(1 for r in results if r['margin'] < t)
        if count > 0:
            global_abs.append({
                "threshold": t,
                "count": count,
                "pct": round(count / total * 100, 1),
                "analogy": FUNNEL_ANALOGIES.get(t, ""),
            })

    pct_thresholds = [0.1, 0.5, 1, 2, 5, 10, 20, 50]
    global_pct_elig = []
    for t in pct_thresholds:
        count = sum(1 for r in results if r['marginPctElig'] < t)
        if count > 0:
            global_pct_elig.append({"threshold": t, "count": count, "pct": round(count / total * 100, 1)})

    global_pct_nonvot = []
    for t in pct_thresholds:
        count = sum(1 for r in results if r['marginPctNonVoters'] < t)
        if count > 0:
            global_pct_nonvot.append({"threshold": t, "count": count, "pct": round(count / total * 100, 1)})

    # Median margin
    sorted_all = sorted(results, key=lambda x: x['margin'])
    median_margin = sorted_all[total // 2]['margin']

    # Per size category
    cats_summary = []
    for cat_name, lt, lo, hi in SIZE_CATS:
        cat = [r for r in results if r['sizeCat'] == cat_name]
        if not cat:
            continue
        n = len(cat)
        avg_elig = sum(r['eligible'] for r in cat) / n
        avg_voted = sum(r['voted'] for r in cat) / n
        avg_nonvot = sum(r['nonVoters'] for r in cat) / n
        avg_prez = sum(r['prezenta'] for r in cat) / n
        avg_margin = sum(r['margin'] for r in cat) / n
        sorted_cat = sorted(cat, key=lambda x: x['margin'])
        med_margin = sorted_cat[n // 2]['margin']
        min_margin = sorted_cat[0]['margin']

        adaptive = ADAPTIVE_THRESHOLDS.get(cat_name, [100, 500, 1000, 2000])
        adaptive_counts = []
        for i, t in enumerate(adaptive):
            c = sum(1 for r in cat if r['margin'] < t)
            adaptive_counts.append({
                "threshold": t,
                "count": c,
                "pct": round(c / n * 100, 1),
                "label": ADAPTIVE_LABELS[i] if i < len(ADAPTIVE_LABELS) else "",
            })

        cats_summary.append({
            "name": cat_name,
            "locType": lt,
            "count": n,
            "avgEligible": round(avg_elig),
            "avgVoted": round(avg_voted),
            "avgNonVoters": round(avg_nonvot),
            "avgPrezenta": round(avg_prez, 1),
            "avgMargin": round(avg_margin),
            "medianMargin": med_margin,
            "minMargin": min_margin,
            "adaptiveThresholds": adaptive_counts,
            "top5": sorted_cat[:5],
        })

    # Histogram bins
    bins = [0, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 999999]
    hist = []
    for i in range(len(bins) - 1):
        lo_b, hi_b = bins[i], bins[i + 1]
        count = sum(1 for r in results if lo_b <= r['margin'] < hi_b)
        label_str = f"{lo_b}–{hi_b}" if hi_b < 999999 else f"{lo_b}+"
        hist.append({"lo": lo_b, "hi": hi_b, "label": label_str, "count": count})

    return {
        "label": label,
        "total": total,
        "medianMargin": median_margin,
        "globalAbsolute": global_abs,
        "globalPctElig": global_pct_elig,
        "globalPctNonVoters": global_pct_nonvot,
        "categories": cats_summary,
        "histogram": hist,
    }


# ── Process Primari ──────────────────────────────────────────────
print("Processing Primari...", flush=True)
p_results = build_results(agg.get('P', {}), 'P')
p_summary = build_summary(p_results, "Primari")

# ── Process Consiliu Local ───────────────────────────────────────
print("Processing Consiliu Local...", flush=True)
cl_results = build_results(agg.get('CL', {}), 'CL')
cl_summary = build_summary(cl_results, "Consiliu Local")

# ── Process Președinte CJ (aggregate per county) ─────────────────
print("Processing Președinte CJ...", flush=True)
pcj_county = {}
for key, d in agg.get('PCJ', {}).items():
    judet = key[0]
    if judet not in pcj_county:
        pcj_county[judet] = {'votes': defaultdict(int), 'a': 0, 'b': 0, 'c': 0, 'd': 0}
    for comp, votes in d['votes'].items():
        pcj_county[judet]['votes'][comp] += votes
    pcj_county[judet]['a'] += d['a']
    pcj_county[judet]['b'] += d['b']
    pcj_county[judet]['c'] += d['c']
    pcj_county[judet]['d'] += d['d']

pcj_results = []
for judet, d in pcj_county.items():
    sorted_c = sorted(d['votes'].items(), key=lambda x: -x[1])
    if len(sorted_c) < 2:
        continue
    margin = sorted_c[0][1] - sorted_c[1][1]
    a = d['a']; b = d['b']; c = d['c']
    non_voters = a - b

    raw1 = sorted_c[0][0]
    if raw1.startswith('g-'):
        raw1 = raw1[2:]
    raw2 = sorted_c[1][0]
    if raw2.startswith('g-'):
        raw2 = raw2[2:]

    # PCJ competitors are candidate-party format
    first_cand, first_party, first_abbrev = split_candidate_party(sorted_c[0][0])
    second_cand, second_party, second_abbrev = split_candidate_party(sorted_c[1][0])

    pcj_results.append({
        "judet": judet,
        "margin": margin,
        "marginPctElig": round(margin / a * 100, 2) if a > 0 else 0,
        "marginPctNonVoters": round(margin / non_voters * 100, 2) if non_voters > 0 else 0,
        "firstCand": first_cand,
        "firstParty": first_party,
        "firstAbbrev": first_abbrev,
        "firstColor": get_party_color(first_abbrev),
        "firstVotes": sorted_c[0][1],
        "secondCand": second_cand,
        "secondParty": second_party,
        "secondAbbrev": second_abbrev,
        "secondColor": get_party_color(second_abbrev),
        "secondVotes": sorted_c[1][1],
        "numCandidates": len(sorted_c),
        "eligible": a,
        "voted": b,
        "validVotes": c,
        "nonVoters": non_voters,
        "prezenta": round(b / a * 100, 1) if a > 0 else 0,
    })

pcj_results.sort(key=lambda x: x['margin'])

# ── Write JSON files ─────────────────────────────────────────────
print("Writing JSON files...", flush=True)

all_judete = sorted(set(r['judet'] for r in p_results))

with open(os.path.join(OUT_DIR, 'primari.json'), 'w', encoding='utf-8') as f:
    json.dump(p_results, f, ensure_ascii=False)

with open(os.path.join(OUT_DIR, 'consiliu_local.json'), 'w', encoding='utf-8') as f:
    json.dump(cl_results, f, ensure_ascii=False)

with open(os.path.join(OUT_DIR, 'presedinte_cj.json'), 'w', encoding='utf-8') as f:
    json.dump(pcj_results, f, ensure_ascii=False)

with open(os.path.join(OUT_DIR, 'summary.json'), 'w', encoding='utf-8') as f:
    json.dump({
        "primari": p_summary,
        "consiliuLocal": cl_summary,
        "presedinteCJ": {
            "total": len(pcj_results),
            "results": pcj_results,
        },
        "judete": all_judete,
        "sizeCategories": [c[0] for c in SIZE_CATS],
        "adaptiveThresholds": ADAPTIVE_THRESHOLDS,
        "partyColors": PARTY_COLORS,
    }, f, ensure_ascii=False, indent=2)

print(f"Done! Files written to {OUT_DIR}")
print(f"  primari.json:        {len(p_results)} entries")
print(f"  consiliu_local.json: {len(cl_results)} entries")
print(f"  presedinte_cj.json:  {len(pcj_results)} entries")
print(f"  summary.json:        comprehensive stats")
