import { OFFLINE_MOCK_FOODS } from "../../src/mockData";
import { calculateHealthScoreAndGrade } from "../../src/healthAlgorithm";

interface Env {
  GEMINI_API_KEY?: string;
}

async function callGemini(apiKey: string, model: string, contents: any[], responseMimeType?: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents,
      generationConfig: responseMimeType ? { responseMimeType } : undefined
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data: any = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return { text };
}

async function callGeminiWithRetry(apiKey: string, contents: any[], model: string, responseMimeType?: string, retries = 3): Promise<any> {
  let attempt = 0;
  let currentModel = model;
  let hasTriedFallback = false;

  while (attempt < retries) {
    try {
      return await callGemini(apiKey, currentModel, contents, responseMimeType);
    } catch (err: any) {
      attempt++;
      const errStr = String(err?.message || err || "").toLowerCase();
      const isTransient = errStr.includes("429") || errStr.includes("503") || errStr.includes("limit") || errStr.includes("exhausted") || errStr.includes("busy") || errStr.includes("unavailable");

      if (isTransient && !hasTriedFallback) {
        let fallbackModel = "";
        if (currentModel === "gemini-3.5-flash") {
          fallbackModel = "gemini-3.1-flash-lite";
        } else if (currentModel === "gemini-3.1-flash-lite") {
          fallbackModel = "gemini-3.5-flash";
        }

        if (fallbackModel) {
          currentModel = fallbackModel;
          hasTriedFallback = true;
          attempt = 0;
          continue;
        }
      }

      if (isTransient && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      } else {
        throw err;
      }
    }
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const apiKey = env.GEMINI_API_KEY;

  try {
    const body: any = await request.json();
    const barcode = body.barcode?.trim();
    const image = body.image;
    const source = body.source;

    console.log(`[Cloudflare Function] Barcode: ${barcode || "Image provided"}, Source: ${source || "unknown"}`);

    // 1. Predefined offline mock lookup
    if (barcode && OFFLINE_MOCK_FOODS[barcode]) {
      return new Response(JSON.stringify(OFFLINE_MOCK_FOODS[barcode]), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 2. Open Food Facts Lookup
    if (barcode) {
      if (!/^\d+$/.test(barcode)) {
        return new Response(
          JSON.stringify({
            error: "Invalid Barcode Format",
            message: `The entered value "${barcode}" is not a valid numeric barcode.`
          }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      try {
        const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
          headers: {
            "User-Agent": "FoodBarcodeHealthScanner/2.0 (monalirjawale@gmail.com)"
          }
        });

        let data: any = null;
        if (offResponse.ok) {
          data = await offResponse.json();
        }

        if (offResponse.ok && data && data.status === 1 && data.product) {
          const prod = data.product;
          const brandStr = prod.brands ? `${prod.brands} ` : "";
          const nameStr = prod.product_name_en || prod.product_name || "Unknown Product";
          const productName = `${brandStr}${nameStr}`.trim();

          const nutriments = prod.nutriments || {};
          const getNutrientVal = (keyBase: string): number => {
            if (nutriments[`${keyBase}_serving`] !== undefined) {
              return parseFloat(nutriments[`${keyBase}_serving`]) || 0;
            }
            if (nutriments[`${keyBase}_100g`] !== undefined) {
              return parseFloat(nutriments[`${keyBase}_100g`]) || 0;
            }
            if (nutriments[keyBase] !== undefined) {
              return parseFloat(nutriments[keyBase]) || 0;
            }
            return 0;
          };

          const calories = getNutrientVal("energy-kcal") || Math.round(getNutrientVal("energy") / 4.184) || 0;
          const totalFat = getNutrientVal("fat");
          const saturatedFat = getNutrientVal("saturated-fat") || getNutrientVal("saturated_fat") || 0;
          const sugar = getNutrientVal("sugars");
          
          let sodium = 0;
          if (nutriments["sodium_serving"] !== undefined) {
            sodium = parseFloat(nutriments["sodium_serving"]) * 1000;
          } else if (nutriments["sodium_100g"] !== undefined) {
            sodium = parseFloat(nutriments["sodium_100g"]) * 1000;
          } else if (nutriments["sodium"] !== undefined) {
            sodium = parseFloat(nutriments["sodium"]) * 1000;
          } else {
            const saltG = getNutrientVal("salt");
            sodium = saltG * 400;
          }

          const protein = getNutrientVal("proteins") || getNutrientVal("protein") || 0;
          const fiber = getNutrientVal("fiber");
          const ingredients = prod.ingredients_text_en || prod.ingredients_text || "No ingredients list available";

          const hasNoIngredients = !prod.ingredients_text_en && !prod.ingredients_text && (!prod.ingredients || prod.ingredients.length === 0 || ingredients === "No ingredients list available" || ingredients.trim().length < 8);
          const hasVeryLowNutrition = calories === 0 && totalFat === 0 && sugar === 0 && protein === 0;

          let finalIngredients = ingredients;
          let finalCalories = calories;
          let finalTotalFat = totalFat;
          let finalSaturatedFat = saturatedFat;
          let finalSugar = sugar;
          let finalSodium = sodium;
          let finalProtein = protein;
          let finalFiber = fiber;
          let noticeMessage = "";

          if ((hasNoIngredients || hasVeryLowNutrition) && apiKey) {
            try {
              const augmentationPrompt = `You are an expert food nutritionist, toxicologist, and chemical analyst.
The product "${productName}" (barcode: ${barcode}) was successfully found in Open Food Facts, but its database entry has missing ingredient lists or zeroed nutritional parameters.
Please look up or scientifically reconstruct the standard, authentic ingredient list and nutrition profile (per 100g or per standard serving) for this exact product (which is commonly sold in India).

You MUST return a JSON object with this exact structure:
{
  "ingredients": "The real comma-separated ingredient list (e.g. Whole Wheat Flour, Palm Oil, Sugar, Iodized Salt, Spices...)",
  "calories": 420, // number in kcal
  "totalFat": 15.0, // number in grams
  "saturatedFat": 6.5, // number in grams
  "sugar": 4.0, // number in grams
  "sodium": 350, // number in milligrams
  "protein": 7.0, // number in grams
  "fiber": 3.0 // number in grams
}

CRITICAL: Do not invent or estimate random data. Be highly accurate, objective, and reference official nutritional safety sheets for Indian food manufacturers.
Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or write introductory text.`;

              const augResponse = await callGeminiWithRetry(
                apiKey,
                [{ parts: [{ text: augmentationPrompt }] }],
                "gemini-3.1-flash-lite",
                "application/json"
              );

              if (augResponse && augResponse.text) {
                const parsedAug = JSON.parse(augResponse.text.trim());
                if (parsedAug && parsedAug.ingredients) {
                  finalIngredients = parsedAug.ingredients;
                  finalCalories = parsedAug.calories !== undefined ? parsedAug.calories : finalCalories;
                  finalTotalFat = parsedAug.totalFat !== undefined ? parsedAug.totalFat : finalTotalFat;
                  finalSaturatedFat = parsedAug.saturatedFat !== undefined ? parsedAug.saturatedFat : finalSaturatedFat;
                  finalSugar = parsedAug.sugar !== undefined ? parsedAug.sugar : finalSugar;
                  finalSodium = parsedAug.sodium !== undefined ? parsedAug.sodium : finalSodium;
                  finalProtein = parsedAug.protein !== undefined ? parsedAug.protein : finalProtein;
                  finalFiber = parsedAug.fiber !== undefined ? parsedAug.fiber : finalFiber;
                  noticeMessage = "Database parameters augmented using BioLens AI Indian product registry for maximum toxicological precision.";
                }
              }
            } catch (augErr) {
              console.log("Could not augment product parameters:", augErr);
            }
          }

          if (!productName || productName.toLowerCase().includes("unknown") || productName.trim() === "") {
            return new Response(
              JSON.stringify({ error: "error", message: "error" }),
              { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
          }

          const calculatedResult = calculateHealthScoreAndGrade({
            productName,
            calories: finalCalories,
            totalFat: finalTotalFat,
            saturatedFat: finalSaturatedFat,
            sugar: finalSugar,
            sodium: finalSodium,
            protein: finalProtein,
            fiber: finalFiber,
            ingredients: finalIngredients
          });

          calculatedResult.barcode = barcode;
          calculatedResult.detectedFromImage = "barcode";
          if (noticeMessage) {
            calculatedResult.notice = noticeMessage;
          }

          return new Response(JSON.stringify(calculatedResult), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        } else {
          // Check database search in BioLens AI
          if (apiKey) {
            try {
              const barcodeLookupPrompt = `You are an expert food nutritionist, product archivist, and toxicologist.
The food barcode "${barcode}" was not found in Open Food Facts. This is likely a product from India or another regional market.
Please search your knowledge base for the exact product associated with the barcode "${barcode}".
If you can uniquely identify the product brand, name, standard ingredients list, and standard nutrition facts, return it.

You MUST return a JSON object with this exact structure:
{
  "found": true, // set to false if you cannot identify this exact barcode with certainty
  "productName": "Brand + Product Name",
  "ingredients": "comma-separated list of actual ingredients",
  "calories": 450, // number in kcal
  "totalFat": 20, // number in g
  "saturatedFat": 9, // number in g
  "sugar": 5, // number in g
  "sodium": 580, // number in mg
  "protein": 6, // number in g
  "fiber": 2 // number in g
}

CRITICAL: Do not invent or guess data. If you are not absolutely certain, set 'found' to false.
Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or write introductory text.`;

              const registryResponse = await callGeminiWithRetry(
                apiKey,
                [{ parts: [{ text: barcodeLookupPrompt }] }],
                "gemini-3.1-flash-lite",
                "application/json"
              );

              if (registryResponse && registryResponse.text) {
                const parsedResult = JSON.parse(registryResponse.text.trim());
                if (parsedResult && parsedResult.found && parsedResult.productName) {
                  const calculatedResult = calculateHealthScoreAndGrade({
                    productName: parsedResult.productName,
                    calories: parsedResult.calories || 0,
                    totalFat: parsedResult.totalFat || 0,
                    saturatedFat: parsedResult.saturatedFat || 0,
                    sugar: parsedResult.sugar || 0,
                    sodium: parsedResult.sodium || 0,
                    protein: parsedResult.protein || 0,
                    fiber: parsedResult.fiber || 0,
                    ingredients: parsedResult.ingredients || "Ingredients not listed"
                  });

                  calculatedResult.barcode = barcode;
                  calculatedResult.detectedFromImage = "barcode";
                  calculatedResult.notice = "Product resolved successfully from BioLens AI product registry database.";

                  return new Response(JSON.stringify(calculatedResult), {
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                  });
                }
              }
            } catch (registryErr) {
              console.log("Could not resolve barcode via AI registry:", registryErr);
            }
          }

          return new Response(
            JSON.stringify({ error: "error", message: "error" }),
            { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
          );
        }
      } catch (fetchErr) {
        return new Response(
          JSON.stringify({ error: "error", message: "error" }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    }

    // 3. Camera Image Analysis (Vision)
    if (image) {
      if (!apiKey) {
        return new Response(
          JSON.stringify({
            error: "Scanning Unsupported",
            message: "Automatic label and image scanning requires Gemini API Configuration. Please add GEMINI_API_KEY to your deployment environment."
          }),
          { status: 422, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      let cleanBase64 = image;
      let mimeType = "image/jpeg";
      if (image.includes(";base64,")) {
        const parts = image.split(";base64,");
        cleanBase64 = parts[1];
        const mimePart = parts[0].split(":");
        if (mimePart.length > 1) {
          mimeType = mimePart[1];
        }
      }

      const contents = [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64
              }
            },
            {
              text: `You are an expert food nutritionist and toxicologist. Your task is to analyze the uploaded product image with absolute scientific accuracy.
Analyze any nutrition labels, barcodes, ingredient lists, or product branding visible on the packaging.
You MUST return a JSON object conforming to the following structure:
{
  "productName": "Brand and Product Name",
  "detectedFromImage": "camera",
  "healthScore": 75, // 0 to 100 healthiness score based strictly on actual ingredients and visible nutrition facts
  "grade": "B", // Nutrition Grade matching the healthScore: A (80-100), B (60-79), C (40-59), D (20-39), E (0-19)
  "summary": "Concise 2-3 sentence overview of this product's health impact.",
  "positives": ["Positive point 1", "Positive point 2"],
  "negatives": ["Negative point 1", "Negative point 2"],
  "nutritionFacts": {
    "calories": "120 kcal", // or null if not visible
    "totalFat": "3g", // or null if not visible
    "saturatedFat": "0.5g", // or null if not visible
    "sugar": "8g", // or null if not visible
    "sodium": "140mg", // or null if not visible
    "protein": "4g", // or null if not visible
    "fiber": "2g" // or null if not visible
  },
  "isHealthy": "healthy", // 'healthy' for grade A/B, 'moderate' for C, 'unhealthy' for D/E
  "alternatives": [
    { "name": "Substitute product 1", "reason": "Why it is a healthier choice." },
    { "name": "Substitute product 2", "reason": "Why it is a healthier choice." }
  ],
  "ingredients": "Sugar, Whole Wheat, Coco Solids, Milk Powder, Salt..." // or null if not visible
}

CRITICAL REQUIREMENT: Do not invent or estimate data. Only extract what is clearly visible. If any nutrient, ingredient, or value is not visible, set its value in the JSON object to null or "Unspecified".
Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or write introductory text.`
            }
          ]
        }
      ];

      try {
        const response = await callGeminiWithRetry(
          apiKey,
          contents,
          "gemini-3.1-flash-lite",
          "application/json"
        );

        const jsonText = response.text || "{}";
        const parsedResult = JSON.parse(jsonText.trim());

        if (!parsedResult.productName || parsedResult.productName.toLowerCase().includes("unknown") || parsedResult.productName.trim() === "") {
          return new Response(
            JSON.stringify({ error: "error", message: "error" }),
            { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
          );
        }

        parsedResult.id = Math.floor(100000 + Math.random() * 900000).toString();
        parsedResult.timestamp = new Date().toISOString();
        if (!parsedResult.detectedFromImage) {
          parsedResult.detectedFromImage = "camera";
        }

        return new Response(JSON.stringify(parsedResult), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (geminiErr) {
        return new Response(
          JSON.stringify({ error: "error", message: "error" }),
          { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "error", message: "error" }),
      { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "error", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
};
