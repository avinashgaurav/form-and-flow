/**
 * SEED DISHES. NOT VERIFIED.
 *
 * Recipes, serving weights and oil levels are typical home-cooking assumptions written from general
 * knowledge. Nutrients are computed from the ingredients (seed-ingredients.ts: USDA SR Legacy except paneer and poha), never
 * typed in. Ingredient values must be replaced from USDA FoodData Central (public domain) and these
 * recipes and household weights reviewed by the dietitian before the beta.
 *
 * Ingredient grams are raw weights for the whole yield. servingGrams is the cooked weight of one serving.
 */

import type { DishRecipe, FoodUnit, OilLevel, RecipeItem, ServingUnit } from './catalogue';

const u = (unit: FoodUnit, grams: number): ServingUnit => ({ unit, grams });
const r = (ingredientId: string, grams: number, optional = false): RecipeItem => (optional ? { ingredientId, grams, optional } : { ingredientId, grams });
const fat = (ingredientId: string, light: number, normal: number, rich: number): DishRecipe['oil'] => ({
  ingredientId,
  levels: { light, normal, rich } satisfies Record<OilLevel, number>,
});

export const SEED_DISHES: DishRecipe[] = [
  // Breads and grains
  {
    id: 'roti', name: 'Roti', aliases: ['phulka', 'chapati', 'chapatti', 'chapathi', 'fulka', 'rotli', 'rotiyan'],
    yieldServings: 1, servingGrams: 40, ingredients: [r('atta', 30)], oil: fat('ghee', 0, 1, 4),
    units: [u('piece', 40)], defaultUnit: 'piece',
  },
  {
    id: 'plain_rice', name: 'Rice (plain, cooked)', aliases: ['rice', 'chawal', 'bhaat', 'plain rice', 'steamed rice', 'boiled rice', 'white rice'],
    yieldServings: 1, servingGrams: 150, ingredients: [r('rice', 50)], oil: null,
    units: [u('katori', 150), u('plate', 250), u('cup', 160), u('tbsp', 15)], defaultUnit: 'katori',
  },
  {
    id: 'khichdi', name: 'Khichdi', aliases: ['khichri', 'khichadi', 'dal khichdi', 'moong dal khichdi'],
    yieldServings: 2, servingGrams: 200, ingredients: [r('rice', 60), r('moong_dal', 40)], oil: fat('ghee', 2, 5, 10),
    units: [u('katori', 150), u('plate', 250)], defaultUnit: 'katori',
  },
  {
    id: 'kanda_poha', name: 'Poha', aliases: ['kanda poha', 'aloo poha', 'batata poha', 'pohe'],
    yieldServings: 1, servingGrams: 150,
    ingredients: [r('poha', 50), r('onion', 30), r('potato', 30, true), r('peanuts', 10, true), r('mustard_seeds', 1), r('green_chilli', 2), r('lemon', 5), r('coriander_leaves', 3, true)],
    oil: fat('oil', 3, 6, 10), units: [u('plate', 150), u('katori', 120)], defaultUnit: 'plate',
  },
  {
    id: 'upma', name: 'Upma', aliases: ['rava upma', 'suji upma', 'uppittu', 'uppuma'],
    yieldServings: 1, servingGrams: 180,
    ingredients: [r('suji', 50), r('onion', 30), r('green_peas', 15), r('carrot', 15, true), r('mustard_seeds', 1), r('cashew', 5, true), r('green_chilli', 2), r('ginger', 2)],
    oil: fat('oil', 3, 6, 10), units: [u('plate', 180), u('katori', 150)], defaultUnit: 'plate',
  },
  {
    id: 'idli', name: 'Idli', aliases: ['idly', 'iddli', 'rice idli'],
    yieldServings: 4, servingGrams: 40, ingredients: [r('rice', 60), r('urad_dal', 20)], oil: null,
    units: [u('piece', 40), u('plate', 80)], defaultUnit: 'piece',
  },
  {
    id: 'dosa', name: 'Dosa', aliases: ['plain dosa', 'sada dosa', 'dosai'],
    yieldServings: 1, servingGrams: 75, ingredients: [r('rice', 30), r('urad_dal', 10)], oil: fat('oil', 2, 5, 10),
    units: [u('piece', 75), u('plate', 75)], defaultUnit: 'piece',
  },
  {
    id: 'besan_chilla', name: 'Besan chilla', aliases: ['besan cheela', 'besan ka chilla', 'pudla', 'gram flour pancake'],
    yieldServings: 1, servingGrams: 90,
    ingredients: [r('besan', 40), r('onion', 20), r('tomato', 15), r('green_chilli', 2), r('coriander_leaves', 2, true)],
    oil: fat('oil', 2, 4, 8), units: [u('piece', 90)], defaultUnit: 'piece',
  },
  {
    id: 'moong_dal_chilla', name: 'Moong dal chilla', aliases: ['moong chilla', 'moong dal cheela', 'pesarattu'],
    yieldServings: 1, servingGrams: 90, ingredients: [r('moong_dal', 40), r('onion', 15), r('ginger', 2), r('green_chilli', 2)],
    oil: fat('oil', 2, 4, 8), units: [u('piece', 90)], defaultUnit: 'piece',
  },

  // Dals and curries
  {
    id: 'dal_tadka', name: 'Dal tadka', aliases: ['dal', 'daal', 'dal fry', 'yellow dal', 'tadka dal'],
    yieldServings: 4, servingGrams: 150,
    ingredients: [r('toor_dal', 120), r('onion', 40), r('tomato', 60), r('garlic', 8), r('green_chilli', 4), r('coriander_leaves', 4, true)],
    oil: fat('oil', 3, 6, 10), units: [u('katori', 150), u('cup', 240), u('tbsp', 15)], defaultUnit: 'katori',
  },
  {
    id: 'toor_dal_cooked', name: 'Toor dal', aliases: ['arhar dal', 'tuvar dal', 'tur dal', 'sada dal', 'plain dal'],
    yieldServings: 4, servingGrams: 150, ingredients: [r('toor_dal', 120), r('tomato', 40)], oil: fat('ghee', 1, 3, 6),
    units: [u('katori', 150), u('cup', 240)], defaultUnit: 'katori',
  },
  {
    id: 'moong_dal_cooked', name: 'Moong dal', aliases: ['yellow moong dal', 'moong ki dal', 'mung dal', 'dhuli moong dal'],
    yieldServings: 4, servingGrams: 150, ingredients: [r('moong_dal', 120), r('tomato', 60), r('onion', 30), r('garlic', 6)],
    oil: fat('oil', 3, 6, 10), units: [u('katori', 150), u('cup', 240)], defaultUnit: 'katori',
  },
  {
    id: 'sambar', name: 'Sambar', aliases: ['sambhar', 'saambar'],
    yieldServings: 4, servingGrams: 150,
    ingredients: [r('toor_dal', 60), r('tomato', 100), r('onion', 60), r('carrot', 60), r('tamarind', 10), r('mustard_seeds', 2)],
    oil: fat('oil', 2, 4, 8), units: [u('katori', 150), u('cup', 240)], defaultUnit: 'katori',
  },
  {
    id: 'rajma_masala', name: 'Rajma', aliases: ['rajma masala', 'rajma curry', 'kidney bean curry'],
    yieldServings: 4, servingGrams: 150, ingredients: [r('rajma', 140), r('onion', 80), r('tomato', 120), r('ginger', 8), r('garlic', 8)],
    oil: fat('oil', 4, 7, 12), units: [u('katori', 150), u('cup', 240)], defaultUnit: 'katori',
  },
  {
    id: 'chole', name: 'Chole', aliases: ['chhole', 'cholay', 'chana masala', 'chole masala', 'pindi chole', 'chickpea curry'],
    yieldServings: 4, servingGrams: 150,
    ingredients: [r('chana', 140), r('onion', 80), r('tomato', 120), r('ginger', 8), r('garlic', 8), r('green_chilli', 4)],
    oil: fat('oil', 4, 8, 14), units: [u('katori', 150), u('cup', 240), u('plate', 250)], defaultUnit: 'katori',
  },
  {
    id: 'soya_chunk_curry', name: 'Soya chunk curry', aliases: ['soya chunks curry', 'soya curry', 'meal maker curry', 'nutrela curry', 'soya badi'],
    yieldServings: 4, servingGrams: 150,
    ingredients: [r('soya_chunks', 100), r('onion', 100), r('tomato', 120), r('ginger', 8), r('garlic', 8), r('curd', 40, true)],
    oil: fat('oil', 4, 8, 12), units: [u('katori', 150)], defaultUnit: 'katori',
  },

  // Paneer and vegetables
  {
    id: 'paneer_bhurji', name: 'Paneer bhurji', aliases: ['paneer bhurjee', 'scrambled paneer'],
    yieldServings: 1, servingGrams: 150,
    ingredients: [r('paneer', 100), r('onion', 30), r('tomato', 40), r('green_chilli', 3), r('coriander_leaves', 3, true)],
    oil: fat('oil', 3, 6, 10), units: [u('katori', 150), u('plate', 200)], defaultUnit: 'katori',
  },
  {
    id: 'palak_paneer', name: 'Palak paneer', aliases: ['saag paneer', 'spinach paneer'],
    yieldServings: 4, servingGrams: 150,
    ingredients: [r('palak', 500), r('paneer', 200), r('onion', 80), r('tomato', 80), r('garlic', 8), r('ginger', 8)],
    oil: fat('oil', 4, 8, 14), units: [u('katori', 150), u('cup', 240)], defaultUnit: 'katori',
  },
  {
    id: 'aloo_gobi', name: 'Aloo gobi', aliases: ['aloo gobhi', 'gobi aloo', 'aloo phool gobi', 'potato cauliflower'],
    yieldServings: 4, servingGrams: 150, ingredients: [r('potato', 300), r('cauliflower', 400), r('onion', 60), r('tomato', 80), r('ginger', 8)],
    oil: fat('oil', 4, 8, 14), units: [u('katori', 150), u('plate', 200)], defaultUnit: 'katori',
  },
  {
    id: 'bhindi_sabzi', name: 'Bhindi sabzi', aliases: ['bhindi', 'bhindi fry', 'bhindi masala', 'bhindi ki sabzi', 'okra stir fry'],
    yieldServings: 4, servingGrams: 120, ingredients: [r('bhindi', 500), r('onion', 80), r('green_chilli', 4)],
    oil: fat('oil', 5, 9, 15), units: [u('katori', 120), u('plate', 200)], defaultUnit: 'katori',
  },
  {
    id: 'sprouts_salad', name: 'Sprouts salad', aliases: ['moong sprouts', 'sprout salad', 'sprouts chaat', 'ankurit moong'],
    yieldServings: 1, servingGrams: 170,
    ingredients: [r('moong_sprouts', 100), r('onion', 20), r('tomato', 20), r('cucumber', 23), r('lemon', 5), r('coriander_leaves', 2, true)],
    oil: null, units: [u('katori', 120), u('plate', 170)], defaultUnit: 'katori',
  },

  // Dairy
  {
    id: 'dahi', name: 'Curd (dahi)', aliases: ['dahi', 'yogurt', 'yoghurt', 'plain curd'],
    yieldServings: 1, servingGrams: 150, ingredients: [r('curd', 150)], oil: null,
    units: [u('katori', 150), u('cup', 245), u('tbsp', 15)], defaultUnit: 'katori',
  },
  {
    id: 'raita', name: 'Raita', aliases: ['cucumber raita', 'kheera raita'],
    yieldServings: 1, servingGrams: 150, ingredients: [r('curd', 110), r('cucumber', 30), r('onion', 10, true)], oil: null,
    units: [u('katori', 150)], defaultUnit: 'katori',
  },

  // Eggs, chicken, fish
  {
    id: 'boiled_egg', name: 'Egg (boiled)', aliases: ['boiled egg', 'anda', 'ubla anda', 'hard boiled egg'],
    yieldServings: 1, servingGrams: 50, ingredients: [r('egg', 50)], oil: null, units: [u('piece', 50)], defaultUnit: 'piece',
  },
  {
    id: 'egg_bhurji', name: 'Egg bhurji', aliases: ['anda bhurji', 'scrambled eggs', 'scrambled egg'],
    yieldServings: 1, servingGrams: 140, ingredients: [r('egg', 100), r('onion', 30), r('tomato', 30), r('green_chilli', 3)],
    oil: fat('oil', 3, 5, 9), units: [u('plate', 140), u('katori', 140)], defaultUnit: 'plate',
  },
  {
    id: 'omelette', name: 'Omelette', aliases: ['omelet', 'masala omelette', 'anda omelette', 'amlet', 'aamlet'],
    yieldServings: 1, servingGrams: 130,
    ingredients: [r('egg', 100), r('onion', 20), r('tomato', 20), r('green_chilli', 2), r('coriander_leaves', 2, true)],
    oil: fat('oil', 2, 5, 8), units: [u('piece', 130), u('plate', 130)], defaultUnit: 'piece',
  },
  {
    id: 'chicken_curry', name: 'Chicken curry', aliases: ['murgh curry', 'murga curry', 'chicken masala', 'chicken gravy'],
    yieldServings: 4, servingGrams: 200,
    ingredients: [r('chicken', 500), r('onion', 150), r('tomato', 150), r('curd', 60), r('ginger', 10), r('garlic', 10)],
    oil: fat('oil', 6, 10, 16), units: [u('katori', 150), u('plate', 300)], defaultUnit: 'katori',
  },
  {
    id: 'fish_curry', name: 'Fish curry', aliases: ['machli curry', 'machhli curry', 'macher jhol', 'meen curry', 'fish gravy'],
    yieldServings: 4, servingGrams: 180, ingredients: [r('fish', 500), r('onion', 100), r('tomato', 120), r('mustard_seeds', 4)],
    oil: fat('mustard_oil', 5, 9, 14), units: [u('katori', 150), u('plate', 250)], defaultUnit: 'katori',
  },

  // Drinks and fruit
  {
    id: 'masala_chai', name: 'Masala chai', aliases: ['chai', 'tea', 'cha', 'doodh chai', 'milk tea', 'adrak chai', 'cutting chai'],
    yieldServings: 1, servingGrams: 150, ingredients: [r('milk', 90), r('tea', 52), r('sugar', 6), r('ginger', 2)], oil: null,
    units: [u('cup', 150), u('glass', 250), u('ml', 1)], defaultUnit: 'cup',
  },
  {
    id: 'banana_whole', name: 'Banana', aliases: ['kela'],
    yieldServings: 1, servingGrams: 120, ingredients: [r('banana', 120)], oil: null, units: [u('piece', 120)], defaultUnit: 'piece',
  },
  {
    id: 'apple_whole', name: 'Apple', aliases: ['seb', 'saib'],
    yieldServings: 1, servingGrams: 180, ingredients: [r('apple', 180)], oil: null, units: [u('piece', 180)], defaultUnit: 'piece',
  },
];
