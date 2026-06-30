import { FoodAnalysisResult } from "./types";

function parseNumber(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const match = val.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

const RED_FLAGS: { key: string; warning: string }[] = [
  { key: "high fructose corn syrup", warning: "Contains High Fructose Corn Syrup (HFCS) which causes rapid insulin spikes and liver fat accumulation" },
  { key: "hfcs", warning: "Contains High Fructose Corn Syrup (HFCS) which leads to high glycemic stress" },
  { key: "palm oil", warning: "Contains Refined Palm Oil which has high saturated fat density and high environmental impact" },
  { key: "palm kernel oil", warning: "Contains Refined Palm Kernel Oil which increases bad LDL cholesterol" },
  { key: "sodium benzoate", warning: "Contains Sodium Benzoate (preservative) which can form benzene under acidic conditions" },
  { key: "potassium sorbate", warning: "Contains Potassium Sorbate (preservative) used to artificially extend shelf life" },
  { key: "monosodium glutamate", warning: "Contains Monosodium Glutamate (MSG) which is an excitotoxin and synthetic flavor enhancer" },
  { key: "msg", warning: "Contains Monosodium Glutamate (MSG) flavor enhancer" },
  { key: "yeast extract", warning: "Contains Yeast Extract which mimics MSG flavor to artificially enhance savory response" },
  { key: "soy lecithin", warning: "Contains Soy Lecithin (emulsifier) indicating a highly processed manufacturing process" },
  { key: "bha", warning: "Contains BHA (synthetic preservative) which is a suspected endocrine disruptor" },
  { key: "bht", warning: "Contains BHT (synthetic preservative) used as an antioxidant to delay oil rancidity" },
  { key: "caramel color", warning: "Contains Caramel Color (treated with ammonia) which can contain trace carcinogens" },
  { key: "titanium dioxide", warning: "Contains Titanium Dioxide (whitening agent) banned in Europe for genetic toxicity concerns" },
  { key: "hydrogenated", warning: "Contains Hydrogenated / Partially Hydrogenated Oils which contain dangerous trans fats" }
];

const GREEN_FLAGS: { key: string; benefit: string }[] = [
  { key: "oats", benefit: "Contains 100% Whole Oats providing heart-healthy beta-glucan soluble fibers" },
  { key: "oatmeal", benefit: "Contains Whole Grain Oatmeal supporting long-lasting energy" },
  { key: "whole grain", benefit: "Contains Whole Grains retaining natural bran, germ, and key B vitamins" },
  { key: "whole wheat", benefit: "Contains Whole Wheat Flour supplying complex slow-release carbohydrates" },
  { key: "buckwheat", benefit: "Contains Buckwheat, a gluten-free pseudocereal with complete amino acids" },
  { key: "quinoa", benefit: "Contains Quinoa containing all nine essential amino acids" },
  { key: "brown rice", benefit: "Contains Brown Rice providing intact dietary fibers and minerals" },
  { key: "sprouted", benefit: "Contains Sprouted Grains which unlock bioavailable vitamins and minerals" },
  { key: "chia", benefit: "Contains Chia Seeds rich in anti-inflammatory omega-3 alpha-linolenic fatty acids" },
  { key: "flax", benefit: "Contains Flaxseeds offering dietary lignans and plant-based fibers" },
  { key: "sunflower seed", benefit: "Contains Sunflower Seeds supplying vitamin E and healthy lipids" },
  { key: "pumpkin seed", benefit: "Contains Pumpkin Seeds rich in zinc, magnesium, and plant proteins" },
  { key: "almond", benefit: "Contains Whole Almonds packed with clean monounsaturated fats and vitamin E" },
  { key: "walnut", benefit: "Contains Walnuts rich in neuroprotective omega-3 lipids" },
  { key: "blueberry", benefit: "Contains Blueberries rich in anthocyanin cell-protecting antioxidants" },
  { key: "strawberry", benefit: "Contains Strawberries supplying natural vitamin C" },
  { key: "cranberry", benefit: "Contains Cranberries containing natural immune support compounds" },
  { key: "ginger", benefit: "Contains Ginger which has powerful anti-inflammatory and digestive benefits" },
  { key: "turmeric", benefit: "Contains Turmeric containing active curcuminoids for inflammatory support" },
  { key: "probiotics", benefit: "Contains Live Active Probiotics supporting healthy gut flora" },
  { key: "yogurt culture", benefit: "Contains Live Yogurt Cultures which aid natural digestion" },
  { key: "olive oil", benefit: "Contains Extra Virgin Olive Oil rich in oleic acid for cardiovascular health" },
  { key: "avocado oil", benefit: "Contains Avocado Oil rich in heart-healthy monounsaturated fats" }
];

export function calculateHealthScoreAndGrade(params: {
  productName: string;
  calories: string | number;
  totalFat: string | number;
  saturatedFat: string | number;
  sugar: string | number;
  sodium: string | number;
  protein: string | number;
  fiber: string | number;
  ingredients: string;
}): FoodAnalysisResult {
  const pName = params.productName.trim() || "Analyzed Product";
  const calVal = parseNumber(params.calories);
  const fatVal = parseNumber(params.totalFat);
  const satFatVal = parseNumber(params.saturatedFat);
  const sugVal = parseNumber(params.sugar);
  const sodVal = parseNumber(params.sodium);
  const protVal = parseNumber(params.protein);
  const fibVal = parseNumber(params.fiber);
  const ingStr = (params.ingredients || "").toLowerCase();

  // --- 1. Compute Nutri-Score inspired Points ---
  // A Points (Negative factors): Energy, Saturated Fat, Sugars, Sodium
  let aPoints = 0;
  
  // Energy (from calories: 1 kcal = 4.184 kJ)
  // Max 10 points
  const energyKj = calVal * 4.184;
  if (energyKj > 3350) aPoints += 10;
  else if (energyKj > 3015) aPoints += 9;
  else if (energyKj > 2680) aPoints += 8;
  else if (energyKj > 2345) aPoints += 7;
  else if (energyKj > 2010) aPoints += 6;
  else if (energyKj > 1675) aPoints += 5;
  else if (energyKj > 1340) aPoints += 4;
  else if (energyKj > 1005) aPoints += 3;
  else if (energyKj > 670) aPoints += 2;
  else if (energyKj > 335) aPoints += 1;

  // Saturated Fat (g)
  // Max 10 points
  if (satFatVal > 10) aPoints += 10;
  else if (satFatVal > 9) aPoints += 9;
  else if (satFatVal > 8) aPoints += 8;
  else if (satFatVal > 7) aPoints += 7;
  else if (satFatVal > 6) aPoints += 6;
  else if (satFatVal > 5) aPoints += 5;
  else if (satFatVal > 4) aPoints += 4;
  else if (satFatVal > 3) aPoints += 3;
  else if (satFatVal > 2) aPoints += 2;
  else if (satFatVal > 1) aPoints += 1;

  // Sugars (g)
  // Max 10 points
  if (sugVal > 45) aPoints += 10;
  else if (sugVal > 40) aPoints += 9;
  else if (sugVal > 36) aPoints += 8;
  else if (sugVal > 31) aPoints += 7;
  else if (sugVal > 27) aPoints += 6;
  else if (sugVal > 22.5) aPoints += 5;
  else if (sugVal > 18) aPoints += 4;
  else if (sugVal > 13.5) aPoints += 3;
  else if (sugVal > 9) aPoints += 2;
  else if (sugVal > 4.5) aPoints += 1;

  // Sodium (mg)
  // Max 10 points
  if (sodVal > 900) aPoints += 10;
  else if (sodVal > 810) aPoints += 9;
  else if (sodVal > 720) aPoints += 8;
  else if (sodVal > 630) aPoints += 7;
  else if (sodVal > 540) aPoints += 6;
  else if (sodVal > 450) aPoints += 5;
  else if (sodVal > 360) aPoints += 4;
  else if (sodVal > 270) aPoints += 3;
  else if (sodVal > 180) aPoints += 2;
  else if (sodVal > 90) aPoints += 1;

  // C Points (Positive factors): Fiber, Protein
  let cPoints = 0;

  // Fiber (g)
  // Max 5 points
  if (fibVal > 4.7) cPoints += 5;
  else if (fibVal > 3.7) cPoints += 4;
  else if (fibVal > 2.8) cPoints += 3;
  else if (fibVal > 1.9) cPoints += 2;
  else if (fibVal > 0.9) cPoints += 1;

  // Protein (g)
  // Max 5 points
  if (protVal > 8.0) cPoints += 5;
  else if (protVal > 6.4) cPoints += 4;
  else if (protVal > 4.8) cPoints += 3;
  else if (protVal > 3.2) cPoints += 2;
  else if (protVal > 1.6) cPoints += 1;

  // Nutri-Score calculation
  // Raw Score = negative points - positive points (Range: -10 to 40)
  const rawScore = aPoints - cPoints;

  // Map raw score to base health score out of 100
  // rawScore -10 -> 100 points
  // rawScore 40 -> 0 points
  let healthScore = Math.round(100 - ((rawScore + 10) / 50) * 100);
  healthScore = Math.max(0, Math.min(100, healthScore));

  // --- 2. Scan Ingredients for Flags ---
  const positives: string[] = [];
  const negatives: string[] = [];

  // Nutrition fact based warnings
  if (sugVal > 22.5) {
    negatives.push(`High in total sugars (${sugVal}g per serving) causing glycemic spikes.`);
  } else if (sugVal > 5 && sugVal <= 22.5) {
    positives.push(`Moderate sugar content (${sugVal}g per serving).`);
  } else {
    positives.push(`Low sugar food (${sugVal}g per serving).`);
  }

  if (sodVal > 480) {
    negatives.push(`High sodium density (${sodVal}mg per serving) contributing to blood pressure stress.`);
  } else if (sodVal <= 140 && sodVal > 0) {
    positives.push(`Very low sodium (${sodVal}mg per serving).`);
  }

  if (satFatVal > 4) {
    negatives.push(`High saturated lipid content (${satFatVal}g per serving).`);
  }

  if (fibVal >= 3) {
    positives.push(`Good source of dietary fiber (${fibVal}g) to support slow digestion.`);
  }
  if (protVal >= 6) {
    positives.push(`Excellent protein content (${protVal}g) supporting lean muscle mass.`);
  }

  // Scan ingredients list
  let redFlagCount = 0;
  let greenFlagCount = 0;

  // Static RED_FLAGS scan
  RED_FLAGS.forEach((flag) => {
    if (ingStr.includes(flag.key)) {
      negatives.push(flag.warning);
      redFlagCount++;
    }
  });

  // Dynamic Artificial Colors & Numbers scan
  const colorMatches: string[] = [];
  const usDyeRegex = /\b(red|yellow|blue|green|orange|purple|lake)\s*(?:no\.?\s*|#\s*)?(\d+)\b/gi;
  let match;
  while ((match = usDyeRegex.exec(ingStr)) !== null) {
    const color = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const num = match[2];
    colorMatches.push(`${color} ${num}`);
  }

  const eNumberRegex = /\b(e\s*\d{3,4})\b/gi;
  while ((match = eNumberRegex.exec(ingStr)) !== null) {
    colorMatches.push(match[1].toUpperCase().replace(/\s+/g, ""));
  }

  if (ingStr.includes("artificial color") || ingStr.includes("color added") || ingStr.includes("artificial colouring") || ingStr.includes("artificial coloring")) {
    if (colorMatches.length === 0) {
      colorMatches.push("unspecified artificial dye");
    }
  }

  if (colorMatches.length > 0) {
    const uniqueColors = Array.from(new Set(colorMatches));
    uniqueColors.forEach((color) => {
      let detail = `Flagged Artificial Color [${color}]: `;
      const colLower = color.toLowerCase();
      if (colLower.includes("red 40") || colLower.includes("e129")) {
        detail += "Red 40 (Allura Red) is a synthetic azo coal-tar dye linked to DNA damage concerns, childhood ADHD, and hypersensitivity reactions.";
      } else if (colLower.includes("yellow 5") || colLower.includes("e102")) {
        detail += "Yellow 5 (Tartrazine) is a highly synthetic pyrazolone dye known to trigger severe asthma, hives, and adverse neurobehavioral symptoms in children.";
      } else if (colLower.includes("yellow 6") || colLower.includes("e110")) {
        detail += "Yellow 6 (Sunset Yellow) contains carcinogenic contaminants like benzidine and is restricted or banned in multiple European nations.";
      } else if (colLower.includes("blue 1") || colLower.includes("e133")) {
        detail += "Blue 1 (Brilliant Blue) is a synthetic triphenylmethane compound capable of crossing the blood-brain barrier and causing mitochondrial stress.";
      } else if (colLower.includes("blue 2") || colLower.includes("e132")) {
        detail += "Blue 2 (Indigo Carmine) is linked to chromosomal and cellular mutation risks and heightened neural hyperactivity.";
      } else if (colLower.includes("red 3") || colLower.includes("e127")) {
        detail += "Red 3 (Erythrosine) is an organoiodine compound and recognized thyroid carcinogen that is heavily restricted in topical products but persists in some foods.";
      } else {
        detail += "Highly synthetic coal-tar or petroleum derivative restricted in multiple international markets due to neuro-behavioral and cellular toxicity risks.";
      }
      negatives.push(detail);
      redFlagCount++;
    });
  }

  // Dynamic Artificial Flavors scan
  const flavorMatches: string[] = [];
  const flavorRegex = /\b(artificial\s+flavou?r(?:ing)?s?|vanillin|ethyl\s+vanillin|artificial\s+influence|artificial\s+essence)\b/gi;
  while ((match = flavorRegex.exec(ingStr)) !== null) {
    flavorMatches.push(match[1].toLowerCase());
  }

  if (flavorMatches.length > 0 || ingStr.includes("artificial flavor") || ingStr.includes("artificial flavour")) {
    negatives.push("Contains Artificial Flavors: Synthetic chemical formulations engineered in labs to artificially hyper-stimulate taste and satiety receptors, bypassing natural body fullness signals and encouraging overeating.");
    redFlagCount++;
  }

  // Dynamic Thickeners, Gums, and Emulsifiers scan
  const thickenerMatches: string[] = [];
  const thickenerRegex = /\b(xanthan\s+gum|guar\s+gum|carrageenan|gellan\s+gum|locust\s+bean\s+gum|cellulose\s+gum|arabic\s+gum|pectin|methylcellulose|carboxymethylcellulose|mono-\s*and\s*diglycerides|polysorbate\s*\d*)\b/gi;
  while ((match = thickenerRegex.exec(ingStr)) !== null) {
    thickenerMatches.push(match[1].toLowerCase());
  }

  if (thickenerMatches.length > 0) {
    const uniqueThickeners = Array.from(new Set(thickenerMatches));
    uniqueThickeners.forEach((thickener) => {
      const name = thickener.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      let explanation = `Flagged Industrial Thickener/Stabilizer [${name}]: `;
      if (thickener.includes("carrageenan")) {
        explanation += "Carrageenan is an algal polysaccharide strongly linked to gut lining disruption, ulcerative colitis symptoms, and chronic internal inflammation.";
      } else if (thickener.includes("xanthan")) {
        explanation += "Xanthan Gum is a bacterial fermentation product that causes significant gastrointestinal bloating, altered stool consistency, and gut microbiome strain.";
      } else if (thickener.includes("guar")) {
        explanation += "Guar Gum is an industrial bean extract that can cause abdominal cramps, gas, and digestive blockage in sensitive digestive tracts.";
      } else if (thickener.includes("polysorbate")) {
        explanation += "Polysorbates act as synthetic detergents, compromising the protective mucosal layer of the intestine and raising the risk of leaky gut.";
      } else if (thickener.includes("mono-") || thickener.includes("diglycerides")) {
        explanation += "Mono- and Diglycerides are highly processed lipid emulsifiers that often contain hidden trans-fatty acids, triggering vascular inflammation.";
      } else {
        explanation += "Processed texture-altering chemical used to suspend low-quality ingredients, masking a lack of genuine whole-food density.";
      }
      negatives.push(explanation);
      redFlagCount++;
    });
  }

  // Dynamic Artificial Sweeteners & Sugar Alcohols scan
  const sweetenerMatches: string[] = [];
  const sweetenerRegex = /\b(aspartame|sucralose|saccharin|acesulfame\s*k|acesulfame\s*potassium|neotame|advantame|sorbitol|mannitol|xylitol|maltitol|erythritol)\b/gi;
  while ((match = sweetenerRegex.exec(ingStr)) !== null) {
    sweetenerMatches.push(match[1].toLowerCase());
  }

  if (sweetenerMatches.length > 0) {
    const uniqueSweeteners = Array.from(new Set(sweetenerMatches));
    uniqueSweeteners.forEach((sweetener) => {
      const name = sweetener.charAt(0).toUpperCase() + sweetener.slice(1);
      let explanation = `Flagged Synthetic Sweetener / Polyol [${name}]: `;
      if (sweetener === "aspartame") {
        explanation += "Aspartame is a synthetic chemical sweetener that breaks down into toxic methanol and formaldehyde in the body, associated with neurological strain.";
      } else if (sweetener === "sucralose") {
        explanation += "Sucralose is a chlorinated sucrose derivative that degrades gut barrier integrity, kills beneficial flora, and can impair insulin sensitivity.";
      } else if (sweetener === "saccharin") {
        explanation += "Saccharin is a synthetic coal-tar derivative and a highly processed legacy sweetener linked to bladder sensitivity and microbiome distortion.";
      } else if (sweetener.includes("acesulfame")) {
        explanation += "Acesulfame Potassium is a synthetic chemical compound containing methylene chloride, linked in animal models to cognitive impairment.";
      } else if (["sorbitol", "mannitol", "xylitol", "maltitol", "erythritol"].includes(sweetener)) {
        explanation += "Sugar alcohols are synthetic polyols that resist digestion, causing severe osmotic water draw, painful bloating, cramps, and diarrhea.";
      } else {
        explanation += "Laboratory-synthesized high-potency sweetening compound that disrupts brain metabolic signaling and raises sugar cravings.";
      }
      negatives.push(explanation);
      redFlagCount++;
    });
  }

  // Green flags check
  GREEN_FLAGS.forEach((flag) => {
    if (ingStr.includes(flag.key)) {
      positives.push(flag.benefit);
      greenFlagCount++;
    }
  });

  // Apply ingredients modifiers to Health Score
  // Deduct 5 points per red flag
  // Add 3 points per green flag (max +15)
  healthScore -= redFlagCount * 5;
  healthScore += Math.min(15, greenFlagCount * 3);
  healthScore = Math.max(0, Math.min(100, healthScore));

  // Ensure lists have at least some default items if empty
  if (positives.length === 0) {
    positives.push("Contains standard dietary energy calories");
  }
  if (negatives.length === 0) {
    if (healthScore > 80) {
      negatives.push("None identified under standard algorithmic guidelines");
    } else {
      negatives.push("Low nutritional density with limited protein and dietary fiber");
    }
  }

  // --- 3. Determine Final Rating and Grade ---
  let grade: "A" | "B" | "C" | "D" | "E" = "C";
  let isHealthy: "healthy" | "moderate" | "unhealthy" = "moderate";

  if (healthScore >= 80) {
    grade = "A";
    isHealthy = "healthy";
  } else if (healthScore >= 65) {
    grade = "B";
    isHealthy = "healthy";
  } else if (healthScore >= 45) {
    grade = "C";
    isHealthy = "moderate";
  } else if (healthScore >= 20) {
    grade = "D";
    isHealthy = "unhealthy";
  } else {
    grade = "E";
    isHealthy = "unhealthy";
  }

  // --- 4. Dynamic Expert Summary Generation ---
  let summary = "";
  if (grade === "A" || grade === "B") {
    summary = `This product is calculated as an exceptionally nutritious, high-grade choice with a score of ${healthScore}/100. It is formulated with clean, wholesome ingredients, containing ${calVal} calories and very little added sugars. It features supportive factors like ${protVal}g of protein and ${fibVal}g of fiber. Perfect for regular consumption in a balanced wellness diet.`;
  } else if (grade === "C") {
    summary = `A moderate everyday product scored at ${healthScore}/100. While it avoids the most severe processed food warnings, it has elevated levels of sodium or sugars, paired with moderate whole-food ingredients. Best consumed in conscious moderation or balanced with more nutrient-dense proteins and vegetables.`;
  } else {
    summary = `An ultra-processed option calculated with a low score of ${healthScore}/100 and a letter grade of ${grade}. It features high quantities of negative ingredients (like ${sugVal}g of sugar or ${sodVal}mg of sodium) alongside several industrial additives. It lacks adequate fiber and protein, posing a heavy glycemic load. Strongly recommend switching to a cleaner alternative.`;
  }

  // --- 5. Healthier Alternatives Generation ---
  const lowerName = pName.toLowerCase() + " " + ingStr;
  let alternatives: { name: string; reason: string }[] = [];

  if (lowerName.includes("soda") || lowerName.includes("cola") || lowerName.includes("pepsi") || lowerName.includes("coke") || lowerName.includes("drink") || lowerName.includes("beverage") || lowerName.includes("juice")) {
    alternatives = [
      { name: "Sparkling Water with Squeezed Lemon", reason: "Provides crisp carbonation and natural citrus flavor with 0g of sugars and zero artificial sweeteners." },
      { name: "Organic Unsweetened Hibiscus Iced Tea", reason: "Naturally tart, delicious, hydration-boosting drink containing high concentrations of plant polyphenols." }
    ];
  } else if (lowerName.includes("chip") || lowerName.includes("cracker") || lowerName.includes("wafer") || lowerName.includes("snack") || lowerName.includes("pretzel") || lowerName.includes("crisp")) {
    alternatives = [
      { name: "Air-Popped Salted Popcorn", reason: "A 100% whole grain fiber source containing up to 70% less fat per serving than fried potato crisps." },
      { name: "Baked Sweet Potato Wedges", reason: "Baked with cold-pressed olive oil, providing rich dietary fiber, beta-carotenes, and Vitamin A." }
    ];
  } else if (lowerName.includes("noodle") || lowerName.includes("ramen") || lowerName.includes("pasta") || lowerName.includes("spaghetti") || lowerName.includes("macaroni")) {
    alternatives = [
      { name: "Buckwheat Soba Noodles in Low-Sodium Tamari", reason: "Non-fried gluten-free noodles providing high fiber and traditional fermented probiotics." },
      { name: "Brown Rice Air-Dried Ramen", reason: "Air-dried instead of deep-fried in palm oil, resulting in up to 80% less saturated fat." }
    ];
  } else if (lowerName.includes("cereal") || lowerName.includes("oat") || lowerName.includes("oatmeal") || lowerName.includes("granola") || lowerName.includes("muesli")) {
    alternatives = [
      { name: "Organic Sprouted Steel-Cut Oats", reason: "Sprouting unlocks bioavailable trace minerals like zinc and iron, while maintaining dense beta-glucan fiber." },
      { name: "Whole Hulled Buckwheat Groats", reason: "A complete gluten-free protein source providing high satiety and slow-burning carbohydrate fuel." }
    ];
  } else if (lowerName.includes("chocolate") || lowerName.includes("candy") || lowerName.includes("sweet") || lowerName.includes("cookie") || lowerName.includes("cake") || lowerName.includes("sugar")) {
    alternatives = [
      { name: "85% Dark Chocolate with Whole Almonds", reason: "Abundant in natural heart-healthy cocoa flavanols with up to 80% less refined sugar." },
      { name: "Air-Dried Apple Slices with Creamy Almond Butter", reason: "Satisfies sweet cravings with natural fructose paired with muscle-repairing healthy fats." }
    ];
  } else {
    // Default fallback
    alternatives = [
      { name: "Fresh Seasonal Whole Fruit", reason: "Provides rich intact dietary fibers, natural enzymes, and cellular water." },
      { name: "Raw Unsalted Almonds & Cashews", reason: "Rich source of clean plant protein and monounsaturated healthy fats." }
    ];
  }

  return {
    barcode: params.productName.match(/^\d+$/) ? params.productName : undefined,
    productName: pName,
    detectedFromImage: "manual",
    healthScore,
    grade,
    summary,
    positives,
    negatives,
    nutritionFacts: {
      calories: `${calVal} kcal`,
      totalFat: `${fatVal}g`,
      saturatedFat: `${satFatVal}g`,
      sugar: `${sugVal}g`,
      sodium: `${sodVal}mg`,
      protein: `${protVal}g`,
      fiber: `${fibVal}g`
    },
    isHealthy,
    alternatives,
    ingredients: params.ingredients.trim() || "No ingredients entered"
  };
}
