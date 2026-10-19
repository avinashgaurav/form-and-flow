"""Print USDA FoodData Central SR Legacy per-100 g values for Form & Flow ingredients.

Usage: python3 -I scripts/usda_extract.py DATA_DIR ingredient_id=fdc_id [ingredient_id=fdc_id ...]

DATA_DIR is the unzipped FoodData_Central_sr_legacy_food_csv_2018-04 folder (public domain, CC0).
Prints one tab-separated row per ingredient: id, fdc_id, description, kcal, protein, fat, carb, fibre.
Energy is nutrient 1008 (kcal), protein 1003, total fat 1004, carbohydrate by difference 1005 and
total dietary fibre 1079. A nutrient with no row in food_nutrient.csv prints as null, never 0.
"""

import csv
import sys
from pathlib import Path

NUTRIENTS = {'1008': ('kcal', 'KCAL'), '1003': ('protein_g', 'G'), '1004': ('fat_g', 'G'), '1005': ('carb_g', 'G'), '1079': ('fibre_g', 'G')}


def rows(path):
    with open(path, newline='', encoding='utf-8') as f:
        yield from csv.DictReader(f)


def main(argv):
    if len(argv) < 2 or not all('=' in a for a in argv[1:]):
        sys.exit(__doc__)
    data = Path(argv[0])
    mapping = [tuple(a.split('=', 1)) for a in argv[1:]]
    wanted = {fdc for _, fdc in mapping}

    units = {r['id']: r['unit_name'] for r in rows(data / 'nutrient.csv')}
    for nid, (_, unit) in NUTRIENTS.items():
        if units.get(nid) != unit:
            sys.exit(f'nutrient {nid} has unit {units.get(nid)}, expected {unit}')

    desc = {r['fdc_id']: r['description'] for r in rows(data / 'food.csv') if r['fdc_id'] in wanted and r['data_type'] == 'sr_legacy_food'}
    if wanted - desc.keys():
        sys.exit(f'not SR Legacy foods: {sorted(wanted - desc.keys())}')

    values = {fdc: {} for fdc in wanted}
    for r in rows(data / 'food_nutrient.csv'):
        if r['fdc_id'] in wanted and r['nutrient_id'] in NUTRIENTS:
            got = values[r['fdc_id']]
            if r['nutrient_id'] in got:
                sys.exit(f"duplicate nutrient {r['nutrient_id']} for {r['fdc_id']}")
            got[r['nutrient_id']] = float(r['amount'])

    print('\t'.join(['id', 'fdc_id', 'description', *(name for name, _ in NUTRIENTS.values())]))
    for ing, fdc in mapping:
        v = values[fdc]
        print('\t'.join([ing, fdc, desc[fdc], *(f'{v[n]:g}' if n in v else 'null' for n in NUTRIENTS)]))


if __name__ == '__main__':
    main(sys.argv[1:])
