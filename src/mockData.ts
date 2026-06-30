import { FoodAnalysisResult } from "./types";
import { calculateHealthScoreAndGrade } from "./healthAlgorithm";

export const OFFLINE_MOCK_FOODS: Record<string, FoodAnalysisResult> = {
  "8906088705047": {
    barcode: "8906088705047",
    productName: "Christopher Cocoa Double Chocolate Hot Cocoa Mix",
    detectedFromImage: "barcode",
    healthScore: 35,
    grade: "D",
    summary: "A sweet chocolate beverage mix with added sugars and thickeners, though cocoa provides natural antioxidant flavonoids.",
    positives: ["Contains cocoa rich in flavonoids", "Portion-controlled sachet design"],
    negatives: ["High added sugars lead to high glycemic response", "Very low protein and fiber density per serving"],
    nutritionFacts: {
      calories: "130 kcal",
      totalFat: "2g",
      saturatedFat: "1.2g",
      sugar: "18g",
      sodium: "90mg",
      protein: "2g",
      fiber: "1g"
    },
    isHealthy: "unhealthy",
    alternatives: [
      { name: "Sugar-Free Pure Dark Cocoa Powder with Stevia", reason: "Rich cocoa flavor and beneficial antioxidants without any added sugars." },
      { name: "Hot Almond Milk with Unsweetened Cocoa & Cinnamon", reason: "An eye-safe alternative providing healthy fats, warm spice, and zero sugar." }
    ],
    ingredients: "Sugar, Cocoa Powder, Milk Solids, Thickener (E415), Salt, Permitted Flavoring Substances (Chocolate, Vanilla)."
  },
  "012000000133": {
    barcode: "012000000133",
    productName: "Pepsi Cola Soda (Offline Cache)",
    detectedFromImage: "barcode",
    healthScore: 12,
    grade: "E",
    summary: "High added sugars and carbonation-related acids. Rapidly raises blood sugar levels with zero nutritional fibers or essential vitamins. Highly ultra-processed choice.",
    positives: ["Sodium content is relatively low", "Provides rapid energy/hydration in extreme fatigue"],
    negatives: ["Extremely high in added simple sugars (41g per can)", "Contains phosphoric acid, which could negatively impact bone mineral retention", "Highly refined formulation with zero protein, healthy fats, or fibers"],
    nutritionFacts: {
      calories: "150 kcal",
      totalFat: "0g",
      saturatedFat: "0g",
      sugar: "41g",
      sodium: "30mg",
      protein: "0g",
      fiber: "0g"
    },
    isHealthy: "unhealthy",
    alternatives: [
      { name: "Sparkling Water with Squeezed Lemon", reason: "Satisfies the craving for carbonation and citrus with 0g sugar." },
      { name: "Unsweetened Hibiscus Iced Tea", reason: "Naturally tart, delicious, and rich in heart-healthy flavonoids." }
    ],
    ingredients: "Carbonated Water, High Fructose Corn Syrup, Caramel Color, Sugar, Phosphoric Acid, Caffeine, Citric Acid, Natural Flavor."
  },
  "028400070560": {
    barcode: "028400070560",
    productName: "Lay's Classic Potato Chips (Offline Cache)",
    detectedFromImage: "barcode",
    healthScore: 34,
    grade: "D",
    summary: "Fried at high heat in refined vegetable oils. Contains high amounts of starch and sodium, offering low nutritional density.",
    positives: ["Simple ingredient profile with no artificial flavor enhancers", "Naturally gluten-free"],
    negatives: ["Cooked in highly refined seed oils (corn/canola oil)", "High sodium density (170mg per serving) causing water retention", "Low satiety value leads to easy overeating of calorie-dense starches"],
    nutritionFacts: {
      calories: "160 kcal",
      totalFat: "10g",
      saturatedFat: "1.5g",
      sugar: "0g",
      sodium: "170mg",
      protein: "2g",
      fiber: "1g"
    },
    isHealthy: "unhealthy",
    alternatives: [
      { name: "Air-Popped Salted Popcorn", reason: "100% whole grain fiber source, containing up to 70% less fat per serving." },
      { name: "Baked Sweet Potato Wedges", reason: "Rich in vitamin A, fiber, and baked with heart-healthy cold-pressed olive oil." }
    ],
    ingredients: "Potatoes, Vegetable Oil (Canola, Corn, Soybean, and/or Sunflower Oil), Salt."
  },
  "030000010202": {
    barcode: "030000010202",
    productName: "Quaker Old Fashioned Oats (Offline Cache)",
    detectedFromImage: "barcode",
    healthScore: 94,
    grade: "A",
    summary: "An exceptional, minimally processed, single-ingredient whole grain. High in beta-glucan soluble fiber, which actively supports healthy cardiovascular function and steady glucose response.",
    positives: ["100% whole grain single-ingredient product", "Contains 4g of heart-healthy soluble beta-glucan fiber", "Offers stable, slow-release complex carbohydrates for extended satiety"],
    negatives: ["Non-organic oats may contain trace pesticide residues; rinse or buy organic when possible"],
    nutritionFacts: {
      calories: "150 kcal",
      totalFat: "3g",
      saturatedFat: "0.5g",
      sugar: "1g",
      sodium: "0mg",
      protein: "5g",
      fiber: "4g"
    },
    isHealthy: "healthy",
    alternatives: [
      { name: "Organic Sprouted Steel-Cut Oats", reason: "Sprouting unlocks even more digestible iron, zinc, and crucial micronutrients." },
      { name: "Whole hulled buckwheat groats", reason: "A gluten-free pseudocereal providing complete essential amino acid profiles." }
    ],
    ingredients: "100% Whole Grain Rolled Oats."
  },
  "8850125078512": {
    barcode: "8850125078512",
    productName: "Mama Instant Pork Noodles (Offline Cache)",
    detectedFromImage: "barcode",
    healthScore: 28,
    grade: "D",
    summary: "Highly refined flour instant noodles deep-fried in palm oil. Contains a massive dose of sodium and synthetic flavor enhancers.",
    positives: ["Highly affordable, convenient, and quick to prepare", "Good source of basic calories for emergency energy"],
    negatives: ["Extremely high sodium (1280mg per serving, over 50% of daily limit)", "Uses palm oil, which raises saturated fat and LDL levels", "Contains Monosodium Glutamate (MSG) and artificial preservatives"],
    nutritionFacts: {
      calories: "260 kcal",
      totalFat: "11g",
      saturatedFat: "5g",
      sugar: "2g",
      sodium: "1280mg",
      protein: "5g",
      fiber: "1g"
    },
    isHealthy: "unhealthy",
    alternatives: [
      { name: "Buckwheat Soba Noodles in Low-Sodium Tamari & Miso", reason: "Non-fried gluten-free noodles with natural fermented probiotics." },
      { name: "Brown Rice Air-Dried Ramen", reason: "Baked/air-dried instead of oil-fried, yielding up to 80% less saturated fat." }
    ],
    ingredients: "Wheat Flour, Palm Oil, Salt, Sugar, Monosodium Glutamate, Garlic Powder, Soy Sauce, Artificial Pork Flavor, Dried Spring Onion, Spices."
  }
};

export function generateGenericMockResult(barcodeOrName: string): FoodAnalysisResult {
  let hash = 0;
  const str = barcodeOrName || "Unknown Product";
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const rawClean = str.replace(/[^a-zA-Z0-9\s]/g, "");
  const pName = rawClean.length > 25 ? rawClean.substring(0, 25) + "..." : rawClean;

  // Determine nutritional profile algorithmically based on hash
  const calories = 80 + (hash % 280); // 80 - 360 kcal
  const totalFat = hash % 20; // 0 - 19g
  const saturatedFat = (hash % 80) / 10; // 0 - 7.9g
  const sugar = hash % 50; // 0 - 49g
  const sodium = hash % 950; // 0 - 949mg
  const protein = hash % 15; // 0 - 14g
  const fiber = hash % 9; // 0 - 8g

  // Determine ingredients list algorithmically
  const redOptions = ["high fructose corn syrup", "palm oil", "yellow 5", "sodium benzoate", "soy lecithin", "monosodium glutamate", "caramel color", "aspartame"];
  const greenOptions = ["whole grain oats", "chia seeds", "almonds", "blueberries", "extra virgin olive oil", "quinoa", "sprouted wheat"];
  const generalOptions = ["purified water", "sea salt", "natural flavors", "organic cane sugar", "citric acid", "yeast", "wheat flour"];

  const chosenReds = redOptions.filter((_, idx) => (hash + idx) % 5 === 0);
  const chosenGreens = greenOptions.filter((_, idx) => (hash + idx) % 4 === 0);
  const chosenGenerals = generalOptions.filter((_, idx) => (hash + idx) % 3 === 0);

  const ingredientsList = [...chosenGreens, ...chosenGenerals, ...chosenReds].join(", ");

  const result = calculateHealthScoreAndGrade({
    productName: pName,
    calories,
    totalFat,
    saturatedFat,
    sugar,
    sodium,
    protein,
    fiber,
    ingredients: ingredientsList || "purified water, natural flavor, salt"
  });

  if (barcodeOrName.match(/^\d+$/)) {
    result.barcode = barcodeOrName;
  }
  result.detectedFromImage = "manual";

  return result;
}
