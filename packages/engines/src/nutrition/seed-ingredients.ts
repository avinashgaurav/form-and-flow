/**
 * SEED INGREDIENTS.
 *
 * Sourced (status 'usda_sr_legacy', 43 of 45 rows): per-100 g energy (nutrient 1008, kcal), protein
 * (1003), total fat (1004), carbohydrate by difference (1005) and total dietary fibre (1079) are copied
 * unrounded from USDA FoodData Central SR Legacy, April 2018 release (public domain, CC0, claim T-10).
 * Each row names the SR Legacy fdc_id and its exact description. Reproduce the values with
 * scripts/usda_extract.py: pass the unzipped CSV folder and each row's id=fdc_id pair.
 *
 * Not sourced (status 'seed_unverified'): paneer and poha. SR Legacy has no paneer or flattened rice,
 * and no close enough food, so these keep their approximations written from general knowledge. Replace
 * them from another source (for example IFCT 2017) before the beta and never present them as verified.
 *
 * Still unverified everywhere: the household gram weights in `units` (dietitian review pending), and
 * the choice of SR Legacy food for a row. Notable choices: whole dry seeds for split dals (toor, moong,
 * urad), so fibre may read high for dehulled dal; defatted soy flour for soya chunks; ground mustard
 * seed for whole rai; carp for rohu; lemon juice for nimbu; 3.25 per cent whole cow milk.
 *
 * Recipe ingredients use raw or dry forms because recipe grams are raw grams; foods logged directly
 * (curd, milk, bread, fruit, tea) use the as-eaten form. A nutrient the source does not report is
 * null, never 0 (SR Legacy gives no fibre for raw shrimp). A 0 is a reported zero.
 */

import type { AllergenTag, DietTag, FoodUnit, Ingredient, NutritionSource, ServingUnit } from './catalogue';

export const SEED_SOURCE: NutritionSource = { name: 'USDA FoodData Central', status: 'seed_unverified' };

/** Plant foods most Jains eat. */
const PLANT: DietTag[] = ['vegan', 'veg', 'egg', 'non_veg', 'jain_ok'];
/** Roots, bulbs, sprouts and yeast-raised foods that Jain diets usually avoid. */
const PLANT_NOT_JAIN: DietTag[] = ['vegan', 'veg', 'egg', 'non_veg'];
const DAIRY: DietTag[] = ['veg', 'egg', 'non_veg', 'jain_ok'];
const EGG: DietTag[] = ['egg', 'non_veg'];
const MEAT: DietTag[] = ['non_veg'];

type N = [energyKcal: number, proteinG: number | null, fatG: number | null, carbG: number | null, fibreG: number | null];

/** Values and where they came from, kept together so no row has numbers without a source. */
interface Sourced {
  n: N;
  source: NutritionSource;
}

/** Values copied from one SR Legacy food. */
function sr(fdcId: number, description: string, n: N): Sourced {
  return { n, source: { name: 'USDA FoodData Central', status: 'usda_sr_legacy', release: 'SR Legacy, April 2018 (public domain)', fdcId, description } };
}

/** Approximation from general knowledge, not checked against a source. */
function seed(n: N): Sourced {
  return { n, source: SEED_SOURCE };
}

function ing(
  id: string,
  name: string,
  aliases: string[],
  data: Sourced,
  dietTags: DietTag[],
  opts: { allergens?: AllergenTag[]; units?: ServingUnit[]; defaultUnit?: FoodUnit } = {},
): Ingredient {
  const [energyKcal, proteinG, fatG, carbG, fibreG] = data.n;
  return {
    id,
    name,
    aliases,
    allergenTags: opts.allergens ?? [],
    dietTags,
    per100g: { energyKcal, proteinG, fatG, carbG, fibreG },
    units: opts.units ?? [],
    defaultUnit: opts.defaultUnit ?? 'g',
    source: data.source,
  };
}

/** Raw ingredients carry ", raw" or similar so a cooked dish with the same headword ranks first in search. */
export const SEED_INGREDIENTS: Ingredient[] = [
  // Grains and flours
  ing('atta', 'Whole wheat flour (atta)', ['atta', 'gehun ka atta', 'chakki atta'],
    sr(168893, "Wheat flour, whole-grain (Includes foods for USDA's Food Distribution Program)", [340, 13.21, 2.5, 71.97, 10.7]), PLANT, { allergens: ['gluten'] }),
  ing('rice', 'Rice, white, raw', ['raw rice', 'uncooked rice'], sr(169756, 'Rice, white, long-grain, regular, raw, unenriched', [365, 7.13, 0.66, 79.95, 1.3]), PLANT),
  ing('poha', 'Poha, raw (flattened rice)', ['flattened rice', 'beaten rice', 'aval'], seed([350, 6.6, 1.2, 77.3, null]), PLANT),
  ing('suji', 'Suji (semolina)', ['sooji', 'rava', 'semolina'], sr(168933, 'Semolina, unenriched', [360, 12.68, 1.05, 72.83, 3.9]), PLANT, { allergens: ['gluten'] }),
  ing('besan', 'Besan (gram flour)', ['gram flour', 'chickpea flour'], sr(174288, 'Chickpea flour (besan)', [387, 22.39, 6.69, 57.82, 10.8]), PLANT),
  ing('bread', 'Bread (white)', ['bread slice', 'double roti', 'sandwich bread'],
    sr(174924, 'Bread, white, commercially prepared (includes soft bread crumbs)', [266, 8.85, 3.33, 49.42, 2.7]), PLANT_NOT_JAIN, {
      allergens: ['gluten'],
      units: [{ unit: 'piece', grams: 25 }],
      defaultUnit: 'piece',
    }),

  // Pulses (whole dry seeds: SR Legacy has no split, dehulled dal)
  ing('toor_dal', 'Toor dal, raw (pigeon pea)', ['arhar dal raw', 'tuvar dal raw', 'pigeon pea'],
    sr(172436, 'Pigeon peas (red gram), mature seeds, raw', [343, 21.7, 1.49, 62.78, 15]), PLANT),
  ing('moong_dal', 'Moong dal, raw (split mung bean)', ['green gram', 'split moong raw'], sr(174256, 'Mung beans, mature seeds, raw', [347, 23.86, 1.15, 62.62, 16.3]), PLANT),
  ing('urad_dal', 'Urad dal, raw (black gram)', ['black gram', 'urad'], sr(174259, 'Mungo beans, mature seeds, raw', [341, 25.21, 1.64, 58.99, 18.3]), PLANT),
  ing('chana', 'Chickpeas, raw (kabuli chana)', ['kabuli chana', 'safed chana', 'chickpeas'],
    sr(173756, 'Chickpeas (garbanzo beans, bengal gram), mature seeds, raw', [378, 20.47, 6.04, 62.95, 12.2]), PLANT),
  ing('rajma', 'Kidney beans, raw (rajma)', ['red kidney beans'], sr(173744, 'Beans, kidney, red, mature seeds, raw', [337, 22.53, 1.06, 61.29, 15.2]), PLANT),
  ing('soya_chunks', 'Soya chunks, dry', ['nutrela', 'meal maker', 'soy chunks'], sr(174275, 'Soy flour, defatted', [327, 51.46, 1.22, 33.92, 17.5]), PLANT, {
    allergens: ['soy'],
  }),
  ing('moong_sprouts', 'Mung bean sprouts, raw', ['sprouted moong', 'moong sprouts raw'],
    sr(169957, 'Mung beans, mature seeds, sprouted, raw', [30, 3.04, 0.18, 5.94, 1.8]), PLANT_NOT_JAIN),

  // Dairy and fats
  ing('paneer', 'Paneer', ['cottage cheese', 'chhena'], seed([296, 18.3, 22.5, 3.6, 0]), DAIRY, { allergens: ['milk'] }),
  ing('curd', 'Curd, whole milk', ['dahi', 'plain yogurt'], sr(171284, 'Yogurt, plain, whole milk', [61, 3.47, 3.25, 4.66, 0]), DAIRY, {
    allergens: ['milk'],
    units: [{ unit: 'katori', grams: 150 }, { unit: 'cup', grams: 245 }, { unit: 'tbsp', grams: 15 }],
    defaultUnit: 'katori',
  }),
  ing('milk', 'Milk (whole)', ['doodh', 'full cream milk', 'cow milk'], sr(171265, 'Milk, whole, 3.25% milkfat, with added vitamin D', [61, 3.15, 3.25, 4.8, 0]), DAIRY, {
    allergens: ['milk'],
    units: [{ unit: 'glass', grams: 250 }, { unit: 'cup', grams: 240 }, { unit: 'ml', grams: 1.03 }],
    defaultUnit: 'glass',
  }),
  ing('ghee', 'Ghee', ['desi ghee', 'clarified butter'], sr(171314, 'Butter, Clarified butter (ghee)', [900, 0, 100, 0, 0]), DAIRY, {
    allergens: ['milk'],
    units: [{ unit: 'tsp', grams: 5 }, { unit: 'tbsp', grams: 14 }],
    defaultUnit: 'tsp',
  }),
  ing('oil', 'Cooking oil (vegetable)', ['oil', 'tel', 'refined oil', 'sunflower oil', 'vegetable oil'],
    sr(171025, 'Oil, sunflower, linoleic, (approx. 65%)', [884, 0, 100, 0, 0]), PLANT, {
      units: [{ unit: 'tsp', grams: 4.5 }, { unit: 'tbsp', grams: 13.5 }, { unit: 'ml', grams: 0.92 }],
      defaultUnit: 'tsp',
    }),
  ing('mustard_oil', 'Mustard oil', ['sarson ka tel', 'kachi ghani oil'], sr(172337, 'Oil, mustard', [884, 0, 100, 0, 0]), PLANT, {
    allergens: ['mustard'],
    units: [{ unit: 'tsp', grams: 4.5 }, { unit: 'tbsp', grams: 13.5 }],
    defaultUnit: 'tsp',
  }),

  // Vegetables and herbs
  ing('onion', 'Onion', ['pyaz', 'pyaaz', 'kanda'], sr(170000, 'Onions, raw', [40, 1.1, 0.1, 9.34, 1.7]), PLANT_NOT_JAIN),
  ing('tomato', 'Tomato', ['tamatar'], sr(170457, 'Tomatoes, red, ripe, raw, year round average', [18, 0.88, 0.2, 3.89, 1.2]), PLANT),
  ing('potato', 'Potato', ['aloo', 'alu', 'batata'], sr(170026, 'Potatoes, flesh and skin, raw', [77, 2.05, 0.09, 17.49, 2.1]), PLANT_NOT_JAIN),
  ing('bhindi', 'Okra (bhindi), raw', ['lady finger', 'ladies finger', 'bhendi'], sr(169260, 'Okra, raw', [33, 1.93, 0.19, 7.45, 3.2]), PLANT),
  ing('palak', 'Spinach (palak), raw', ['spinach'], sr(168462, 'Spinach, raw', [23, 2.86, 0.39, 3.63, 2.2]), PLANT),
  ing('cauliflower', 'Cauliflower (gobi), raw', ['gobi', 'gobhi', 'phool gobi'], sr(169986, 'Cauliflower, raw', [25, 1.92, 0.28, 4.97, 2]), PLANT),
  ing('green_peas', 'Green peas', ['matar', 'mutter'], sr(170419, 'Peas, green, raw', [81, 5.42, 0.4, 14.45, 5.7]), PLANT),
  ing('carrot', 'Carrot', ['gajar'], sr(170393, 'Carrots, raw', [41, 0.93, 0.24, 9.58, 2.8]), PLANT_NOT_JAIN),
  ing('cucumber', 'Cucumber', ['kheera', 'khira', 'kakdi'], sr(168409, 'Cucumber, with peel, raw', [15, 0.65, 0.11, 3.63, 0.5]), PLANT),
  ing('ginger', 'Ginger', ['adrak'], sr(169231, 'Ginger root, raw', [80, 1.82, 0.75, 17.77, 2]), PLANT_NOT_JAIN),
  ing('garlic', 'Garlic', ['lehsun', 'lahsun', 'lasun'], sr(169230, 'Garlic, raw', [149, 6.36, 0.5, 33.06, 2.1]), PLANT_NOT_JAIN),
  ing('green_chilli', 'Green chilli', ['hari mirch', 'mirchi'], sr(170497, 'Peppers, hot chili, green, raw', [40, 2, 0.2, 9.46, 1.5]), PLANT),
  ing('coriander_leaves', 'Coriander leaves', ['dhaniya', 'dhania', 'hara dhaniya', 'kothmir', 'kothimbir', 'cilantro'],
    sr(169997, 'Coriander (cilantro) leaves, raw', [23, 2.13, 0.52, 3.67, 2.8]), PLANT),
  ing('lemon', 'Lemon juice', ['nimbu', 'nimbu ras', 'lime juice'], sr(167747, 'Lemon juice, raw', [22, 0.35, 0.24, 6.9, 0.3]), PLANT, {
    units: [{ unit: 'tsp', grams: 5 }, { unit: 'tbsp', grams: 15 }],
  }),
  ing('tamarind', 'Tamarind pulp', ['imli'], sr(167763, 'Tamarinds, raw', [239, 2.8, 0.6, 62.5, 5.1]), PLANT),

  // Seeds and nuts
  ing('mustard_seeds', 'Mustard seeds', ['rai', 'sarson', 'sarson ke beej', 'mohri'],
    sr(170929, 'Spices, mustard seed, ground', [508, 26.08, 36.24, 28.09, 12.2]), PLANT, { allergens: ['mustard'] }),
  ing('cashew', 'Cashew nuts', ['kaju', 'cashew'], sr(170162, 'Nuts, cashew nuts, raw', [553, 18.22, 43.85, 30.19, 3.3]), PLANT, { allergens: ['tree_nut'] }),
  ing('peanuts', 'Peanuts', ['moongphali', 'mungfali', 'groundnut', 'shengdana'], sr(172430, 'Peanuts, all types, raw', [567, 25.8, 49.24, 16.13, 8.5]), PLANT, {
    allergens: ['peanut'],
    units: [{ unit: 'tbsp', grams: 9 }],
  }),

  // Eggs, meat, fish
  ing('egg', 'Egg, whole, raw', ['raw egg'], sr(171287, 'Egg, whole, raw, fresh', [143, 12.56, 9.51, 0.72, 0]), EGG, {
    allergens: ['egg'],
    units: [{ unit: 'piece', grams: 50 }],
    defaultUnit: 'piece',
  }),
  ing('chicken', 'Chicken, raw (boneless)', ['raw chicken', 'chicken breast'],
    sr(171077, 'Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw', [120, 22.5, 2.62, 0, 0]), MEAT),
  ing('fish', 'Fish, raw (rohu or carp)', ['rohu', 'machli', 'machhli', 'carp'], sr(171952, 'Fish, carp, raw', [127, 17.83, 5.6, 0, 0]), MEAT, { allergens: ['fish'] }),
  ing('prawns', 'Prawns, raw', ['jhinga', 'shrimp', 'prawn'], sr(175179, 'Crustaceans, shrimp, raw', [85, 20.1, 0.51, 0, null]), MEAT, { allergens: ['shellfish'] }),

  // Fruit, sugar, drinks
  ing('banana', 'Banana, fresh', ['kela fresh'], sr(173944, 'Bananas, raw', [89, 1.09, 0.33, 22.84, 2.6]), PLANT, { units: [{ unit: 'piece', grams: 120 }] }),
  ing('apple', 'Apple, fresh', ['seb fresh'],
    sr(171688, "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)", [52, 0.26, 0.17, 13.81, 2.4]), PLANT, { units: [{ unit: 'piece', grams: 180 }] }),
  ing('sugar', 'Sugar', ['cheeni', 'chini', 'shakkar'], sr(169655, 'Sugars, granulated', [387, 0, 0, 99.98, 0]), PLANT, {
    units: [{ unit: 'tsp', grams: 4 }, { unit: 'tbsp', grams: 12.5 }],
    defaultUnit: 'tsp',
  }),
  ing('tea', 'Brewed tea (no milk)', ['black tea', 'kali chai', 'tea liquor'], sr(173227, 'Beverages, tea, black, brewed, prepared with tap water', [1, 0, 0, 0.3, 0]), PLANT, {
    units: [{ unit: 'cup', grams: 150 }, { unit: 'ml', grams: 1 }],
    defaultUnit: 'cup',
  }),
];
