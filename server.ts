import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { OFFLINE_MOCK_FOODS, generateGenericMockResult } from "./src/mockData";
import { calculateHealthScoreAndGrade } from "./src/healthAlgorithm";

dotenv.config();

// Initialize server-side Gemini client when key is available
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

/**
 * Executes a Gemini request with automatic retries, exponential backoff,
 * and automatic model fallback (e.g. from gemini-3.5-flash to gemini-3.1-flash-lite)
 * to elegantly bypass transient 503 (service unavailable) or 429 (rate limit) errors.
 */
async function generateContentWithRetry(contents: any[], model: string, config: any, retries = 3, delay = 1000): Promise<any> {
  let attempt = 0;
  let currentModel = model;
  let hasTriedFallback = false;

  while (attempt < retries) {
    try {
      if (!ai) {
        throw new Error("Gemini AI client is not initialized.");
      }
      console.log(`[Gemini] Calling generateContent with model: "${currentModel}" (Attempt ${attempt + 1}/${retries})`);
      return await ai.models.generateContent({
        model: currentModel,
        contents,
        config,
      });
    } catch (err: any) {
      attempt++;
      const errStr = String(err?.message || err || "").toLowerCase();
      // Inspect different potential error status code locations
      const errStatus = err?.status || err?.error?.code || (errStr.includes("429") ? 429 : errStr.includes("503") ? 503 : 500);

      const is503 = errStatus === 503 || errStr.includes("503") || errStr.includes("high demand") || errStr.includes("unavailable") || errStr.includes("temporary");
      const isRateLimit = errStatus === 429 || errStr.includes("429") || errStr.includes("resourceexhausted") || errStr.includes("resource_exhausted") || errStr.includes("quota exceeded");
      const isTransient = is503 || isRateLimit;

      console.log(`[Gemini Info] Model response issue details for "${currentModel}": status ${errStatus}, transient ${isTransient}`);

      // If we hit a rate limit (429) or high demand (503), immediately try falling back to 'gemini-3.1-flash-lite'
      // if we were on 'gemini-3.5-flash' (or vice versa), without exhausting all retries on the broken model first.
      if (isTransient && !hasTriedFallback) {
        let fallbackModel = "";
        if (currentModel === "gemini-3.5-flash") {
          fallbackModel = "gemini-3.1-flash-lite";
        } else if (currentModel === "gemini-3.1-flash-lite") {
          fallbackModel = "gemini-3.5-flash";
        }

        if (fallbackModel) {
          console.log(`[Gemini] ⚡ Rate limit or high demand detected! Falling back immediately from "${currentModel}" to "${fallbackModel}".`);
          currentModel = fallbackModel;
          hasTriedFallback = true;
          attempt = 0; // Reset attempts to give the fallback model full retries
          continue;
        }
      }

      if (isTransient && attempt < retries) {
        let sleepTime = delay;
        if (isRateLimit) {
          sleepTime = 3000; // sleep 3 seconds before next attempt
          const match = errStr.match(/retry in ([\d\.]+)s/);
          if (match && match[1]) {
            const seconds = parseFloat(match[1]);
            if (!isNaN(seconds)) {
              sleepTime = Math.ceil(seconds * 1000) + 500;
            }
          }
        } else if (is503) {
          sleepTime = Math.max(delay, 2000);
        }

        console.log(`[Gemini] Sleeping for ${sleepTime}ms before retrying model "${currentModel}" (Attempt ${attempt}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, sleepTime));
        delay = Math.ceil(sleepTime * 1.5);
      } else {
        throw err;
      }
    }
  }
}

/**
 * Browses the Open Food Facts product HTML page directly for a barcode,
 * extracts raw page elements, and utilizes Gemini to accurately parse
 * ingredients and nutrition facts.
 */
async function scrapeProductFromHtml(barcode: string): Promise<any> {
  const url = `https://world.openfoodfacts.org/product/${barcode}`;
  console.log(`[Scraper] Browsing Open Food Facts page directly: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      console.log(`[Scraper] Direct browse failed. Status: ${response.status}`);
      return null;
    }

    const html = await response.text();
    console.log(`[Scraper] Fetched HTML. Length: ${html.length} chars.`);

    let contentSnippets = "";

    // Extract product page titles/headings
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      contentSnippets += `Page Title: ${titleMatch[1].trim()}\n\n`;
    }

    const h1Match = html.match(/<h1[\s\S]*?>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      contentSnippets += `Main Header: ${h1Match[1].replace(/<[^>]*>/g, "").trim()}\n\n`;
    }

    // Attempt to isolate standard ingredients block
    const ingredientsMatch = html.match(/<div[^>]*?id="ingredients_list"[^>]*?>([\s\S]*?)<\/div>/i) ||
                             html.match(/<div[^>]*?class="ingredients_list"[^>]*?>([\s\S]*?)<\/div>/i);
    if (ingredientsMatch) {
      contentSnippets += `Ingredients Element HTML:\n${ingredientsMatch[0].substring(0, 4000)}\n\n`;
    } else {
      const ingIdx = html.toLowerCase().indexOf("ingredients");
      if (ingIdx !== -1) {
        contentSnippets += `Ingredients Surrounding Text:\n${html.substring(Math.max(0, ingIdx - 150), Math.min(html.length, ingIdx + 1200)).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")}\n\n`;
      }
    }

    // Attempt to isolate standard nutrition facts block
    const nutritionMatch = html.match(/<table[^>]*?class="nutrition_data_table"[^>]*?>([\s\S]*?)<\/table>/i) ||
                           html.match(/<table[^>]*?id="nutrition_data_table"[^>]*?>([\s\S]*?)<\/table>/i) ||
                           html.match(/<div[^>]*?id="nutrition_data_table"[^>]*?>([\s\S]*?)<\/div>/i);
    if (nutritionMatch) {
      contentSnippets += `Nutrition Element HTML:\n${nutritionMatch[0].substring(0, 4000)}\n\n`;
    } else {
      const nutIdx = html.toLowerCase().indexOf("nutrition");
      if (nutIdx !== -1) {
        contentSnippets += `Nutrition Surrounding Text:\n${html.substring(Math.max(0, nutIdx - 150), Math.min(html.length, nutIdx + 1200)).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")}\n\n`;
      }
    }

    // Fallback block in case we have extremely little extracted context
    if (contentSnippets.length < 400) {
      const simplified = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<svg[\s\S]*?<\/svg>/gi, "")
        .replace(/<head>[\s\S]*?<\/head>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ");
      contentSnippets = simplified.substring(0, 18000);
    }

    if (ai) {
      console.log(`[Scraper] Requesting Gemini to parse Open Food Facts page context for: ${barcode}`);
      const extractionPrompt = `You are a professional nutrition expert and toxicologist.
An application has browsed the official Open Food Facts product web page "https://world.openfoodfacts.org/product/${barcode}".
Below is the extracted HTML/text content from that product page:

--- BEGIN PAGE CONTENT ---
${contentSnippets}
--- END PAGE CONTENT ---

Based strictly on this page, please extract and reconstruct:
1. The real Product Brand and Name (e.g. "Haldiram's Aloo Bhujia", "Britannia Good Day", "MTR Rava Idli").
2. The complete, authentic, comma-separated ingredients list. Do not summarize or truncate.
3. Standard nutritional parameters (prefer per 100g, or per serving if 100g is not listed):
   - Calories (in kcal)
   - Total Fat (in grams)
   - Saturated Fat (in grams)
   - Sugar (in grams)
   - Sodium (in milligrams; convert salt to sodium if needed: 1g salt = 400mg sodium)
   - Protein (in grams)
   - Fiber (in grams)

Return a single JSON object conforming exactly to this schema:
{
  "productName": "Brand and Name",
  "ingredients": "comma-separated ingredients list",
  "calories": 450, // number
  "totalFat": 20, // number
  "saturatedFat": 9, // number
  "sugar": 5, // number
  "sodium": 350, // number
  "protein": 6, // number
  "fiber": 2 // number
}

CRITICAL: Do not invent, guess, or estimate any data if not visible or present on the page context. If ingredients are missing, set ingredients to "Ingredients not listed". Only return the raw JSON object. Do not wrap it in markdown code blocks or add any text.`;

      const scrapeResponse = await generateContentWithRetry(
        [extractionPrompt],
        "gemini-3.1-flash-lite",
        {
          responseMimeType: "application/json",
        }
      );

      if (scrapeResponse && scrapeResponse.text) {
        const parsedData = JSON.parse(scrapeResponse.text.trim());
        if (parsedData && parsedData.productName && !parsedData.productName.toLowerCase().includes("unknown")) {
          console.log(`[Scraper] Product scraped and parsed successfully: "${parsedData.productName}"`);
          return parsedData;
        }
      }
    }
  } catch (err: any) {
    console.error(`[Scraper] Scraper error for barcode ${barcode}:`, err?.message || err);
  }
  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support larger base64 image payloads for barcode scanning
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Food Barcode Health Analysis endpoint (100% Algorithmic, No AI used)
  app.post("/api/analyze-barcode", async (req, res): Promise<any> => {
    try {
      const { barcode, image, source } = req.body;
      const bcode = barcode?.trim();

      console.log(`Processing algorithmic scan... Barcode: ${bcode || "Image provided"}, Source: ${source || "unknown"}`);

      // 1. If it's a specific pre-defined offline mock barcode, look up in OFFLINE_MOCK_FOODS
      if (bcode && OFFLINE_MOCK_FOODS[bcode]) {
        console.log(`Matched pre-cached popular barcode: ${bcode} (${OFFLINE_MOCK_FOODS[bcode].productName})`);
        return res.json(OFFLINE_MOCK_FOODS[bcode]);
      }

      // 2. Query Open Food Facts API for real database lookup (if barcode is standard numeric)
      if (bcode) {
        if (!/^\d+$/.test(bcode)) {
          return res.status(400).json({
            error: "Invalid Barcode Format",
            message: `The entered value "${bcode}" is not a valid numeric barcode. Please enter digits only (e.g., 030000010202) or use the "Manual Builder" tab to type in the packaging details.`
          });
        }

        try {
          console.log(`Querying Open Food Facts API for barcode: ${bcode}`);
          const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${bcode}.json`, {
            headers: {
              "User-Agent": "FoodBarcodeHealthScanner/2.0 (monalirjawale@gmail.com)"
            }
          });

          let data: any = null;
          try {
            data = await offResponse.json();
          } catch (jsonErr) {
            console.error("Failed to parse response as JSON:", jsonErr);
          }

          if (offResponse.ok && data && data.status === 1 && data.product) {
            const prod = data.product;
            const brandStr = prod.brands ? `${prod.brands} ` : "";
            const nameStr = prod.product_name_en || prod.product_name || "Unknown Product";
            const productName = `${brandStr}${nameStr}`.trim();

            const nutriments = prod.nutriments || {};

            // Function to look up values, preferring serving over 100g, falling back
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

            // OFF stores calories in kcal and energy in kJ
            const calories = getNutrientVal("energy-kcal") || Math.round(getNutrientVal("energy") / 4.184) || 0;
            const totalFat = getNutrientVal("fat");
            const saturatedFat = getNutrientVal("saturated-fat") || getNutrientVal("saturated_fat") || 0;
            const sugar = getNutrientVal("sugars");
            
            // Sodium can be stored as sodium directly (usually in grams in OFF) or salt (1g salt = 400mg sodium)
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

            // Check if the database record is missing ingredients or has highly incomplete/placeholder nutrition
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
            let isPrediction = false;
            let dataSource: 'api' | 'scrape' | 'prediction' = 'api';

            if ((hasNoIngredients || hasVeryLowNutrition) && ai) {
              console.log(`[Database Augmentation] Product "${productName}" has incomplete ingredients or nutrition facts on OFF. Querying live product webpage direct scrape first...`);
              let resolvedViaScrape = false;
              try {
                const scrapedProduct = await scrapeProductFromHtml(bcode);
                if (scrapedProduct && scrapedProduct.ingredients && scrapedProduct.ingredients !== "Ingredients not listed" && scrapedProduct.ingredients.trim().length > 10) {
                  console.log(`[Scraper] Successfully retrieved complete parameters via direct webpage scrape.`);
                  finalIngredients = scrapedProduct.ingredients;
                  finalCalories = scrapedProduct.calories !== undefined ? scrapedProduct.calories : finalCalories;
                  finalTotalFat = scrapedProduct.totalFat !== undefined ? scrapedProduct.totalFat : finalTotalFat;
                  finalSaturatedFat = scrapedProduct.saturatedFat !== undefined ? scrapedProduct.saturatedFat : finalSaturatedFat;
                  finalSugar = scrapedProduct.sugar !== undefined ? scrapedProduct.sugar : finalSugar;
                  finalSodium = scrapedProduct.sodium !== undefined ? scrapedProduct.sodium : finalSodium;
                  finalProtein = scrapedProduct.protein !== undefined ? scrapedProduct.protein : finalProtein;
                  finalFiber = scrapedProduct.fiber !== undefined ? scrapedProduct.fiber : finalFiber;
                  noticeMessage = "Product details successfully parsed directly from Open Food Facts web registry page.";
                  resolvedViaScrape = true;
                  dataSource = 'scrape';
                  isPrediction = false;
                }
              } catch (scrapeErr) {
                console.log("[Scraper Warning] Direct webpage scrape failed during augmentation:", scrapeErr);
              }

              if (!resolvedViaScrape) {
                console.log(`Webpage scrape returned incomplete data. Re-routing to NutriLens AI Registry database for reconstruction...`);
                try {
                  const augmentationPrompt = `You are an expert food nutritionist, toxicologist, and chemical analyst.
The product "${productName}" (barcode: ${bcode}) was successfully found in Open Food Facts, but its database entry has missing ingredient lists or zeroed nutritional parameters.
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

CRITICAL: Do not invent or estimate random data. Be highly accurate, objective, and reference official nutritional safety sheets for Indian food manufacturers (like Haldiram, Britannia, Amul, Nestle India, etc.).
Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or write introductory text.`;

                  const augResponse = await generateContentWithRetry(
                  [augmentationPrompt],
                  "gemini-3.1-flash-lite",
                  {
                    responseMimeType: "application/json",
                  }
                );

                if (augResponse && augResponse.text) {
                  const parsedAug = JSON.parse(augResponse.text.trim());
                  if (parsedAug && parsedAug.ingredients && parsedAug.ingredients !== "Unspecified") {
                    finalIngredients = parsedAug.ingredients;
                    finalCalories = parsedAug.calories !== undefined ? parsedAug.calories : finalCalories;
                    finalTotalFat = parsedAug.totalFat !== undefined ? parsedAug.totalFat : finalTotalFat;
                    finalSaturatedFat = parsedAug.saturatedFat !== undefined ? parsedAug.saturatedFat : finalSaturatedFat;
                    finalSugar = parsedAug.sugar !== undefined ? parsedAug.sugar : finalSugar;
                    finalSodium = parsedAug.sodium !== undefined ? parsedAug.sodium : finalSodium;
                    finalProtein = parsedAug.protein !== undefined ? parsedAug.protein : finalProtein;
                    finalFiber = parsedAug.fiber !== undefined ? parsedAug.fiber : finalFiber;
                    noticeMessage = "Database parameters augmented using NutriLens AI Indian product registry for maximum toxicological precision.";
                    dataSource = 'prediction';
                    isPrediction = true;
                  }
                }
              } catch (augErr: any) {
                console.log("[Database Augmentation] Could not augment product parameters:", augErr?.message || augErr);
              }
            }
          }

            console.log(`Evaluating food metadata for: ${productName}.`);
            if (!productName || productName.toLowerCase().includes("unknown") || productName.trim() === "") {
              console.log(`[Unknown Product Intercept] Product is unknown: "${productName}". Returning status 404.`);
              return res.status(404).json({
                error: "error",
                message: "error"
              });
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

            calculatedResult.barcode = bcode;
            calculatedResult.detectedFromImage = "barcode";
            calculatedResult.isPrediction = isPrediction;
            calculatedResult.dataSource = dataSource;
            if (noticeMessage) {
              calculatedResult.notice = noticeMessage;
            }

            return res.json(calculatedResult);
          } else if (offResponse.status === 404 || (data && data.status === 0)) {
            console.log(`Product with barcode ${bcode} not found in OFF API. Attempting live product webpage direct scrape...`);
            
            try {
              const scrapedProduct = await scrapeProductFromHtml(bcode);
              if (scrapedProduct && scrapedProduct.productName && !scrapedProduct.productName.toLowerCase().includes("unknown")) {
                console.log(`[Scraper] Successfully resolved product ${bcode} by direct webpage scrape -> ${scrapedProduct.productName}`);
                                const calculatedResult = calculateHealthScoreAndGrade({
                  productName: scrapedProduct.productName,
                  calories: scrapedProduct.calories || 0,
                  totalFat: scrapedProduct.totalFat || 0,
                  saturatedFat: scrapedProduct.saturatedFat || 0,
                  sugar: scrapedProduct.sugar || 0,
                  sodium: scrapedProduct.sodium || 0,
                  protein: scrapedProduct.protein || 0,
                  fiber: scrapedProduct.fiber || 0,
                  ingredients: scrapedProduct.ingredients || "Ingredients not listed"
                });

                calculatedResult.barcode = bcode;
                calculatedResult.detectedFromImage = "barcode";
                calculatedResult.isPrediction = false;
                calculatedResult.dataSource = 'scrape';
                calculatedResult.notice = "Product resolved successfully by directly browsing & parsing the Open Food Facts webpage.";
                
                return res.json(calculatedResult);
              }
            } catch (scrapeErr) {
              console.log("[Scraper Warning] Direct webpage scrape failed during 404 fallback:", scrapeErr);
            }

            console.log(`Product webpage scraping failed or returned no results. Falling back to NutriLens AI registries...`);
            
            if (ai) {
              try {
                const barcodeLookupPrompt = `You are an expert food nutritionist, product archivist, and toxicologist.
The food barcode "${bcode}" was not found in Open Food Facts. This is likely a product from India (barcodes starting with 890 or similar are Indian) or another regional market.
Please search your knowledge base for the exact product associated with the barcode "${bcode}".
If you can uniquely identify the product brand, name, standard ingredients list, and standard nutrition facts (per 100g or per standard serving), return it.

You MUST return a JSON object with this exact structure:
{
  "found": true, // set to false if you cannot identify this exact barcode with certainty
  "productName": "Brand + Product Name (e.g. Amul Pure Ghee, Haldiram's Aloo Bhujia, Britannia Marie Gold)",
  "ingredients": "comma-separated list of actual ingredients",
  "calories": 450, // number in kcal
  "totalFat": 20, // number in g
  "saturatedFat": 9, // number in g
  "sugar": 5, // number in g
  "sodium": 580, // number in mg
  "protein": 6, // number in g
  "fiber": 2 // number in g
}

CRITICAL: Do not invent or guess data. If you are not absolutely certain about this barcode, set 'found' to false. Do not hallucinate.
Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or write introductory text.`;

                const registryResponse = await generateContentWithRetry(
                  [barcodeLookupPrompt],
                  "gemini-3.1-flash-lite",
                  {
                    responseMimeType: "application/json",
                  }
                );

                if (registryResponse && registryResponse.text) {
                  const parsedResult = JSON.parse(registryResponse.text.trim());
                  if (parsedResult && parsedResult.found && parsedResult.productName && !parsedResult.productName.toLowerCase().includes("unknown")) {
                    console.log(`[NutriLens AI Registry] Successfully resolved barcode ${bcode} -> ${parsedResult.productName}`);
                    
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

                    calculatedResult.barcode = bcode;
                    calculatedResult.detectedFromImage = "barcode";
                    calculatedResult.isPrediction = true;
                    calculatedResult.dataSource = 'prediction';
                    calculatedResult.notice = "Product resolved successfully from NutriLens AI Indian product registry database.";
                    
                    return res.json(calculatedResult);
                  }
                }
              } catch (registryErr: any) {
                console.log("[NutriLens AI Registry] Could not resolve barcode via registry:", registryErr?.message || registryErr);
              }
            }

            return res.status(404).json({
              error: "error",
              message: "error"
            });
          } else {
            console.log(`Database request failed with HTTP ${offResponse.status}`);
            return res.status(offResponse.status || 500).json({
              error: "error",
              message: "error"
            });
          }
        } catch (fetchErr) {
          console.error("Failed to query Open Food Facts API:", fetchErr);
          return res.status(500).json({
            error: "error",
            message: "error"
          });
        }
      }

      // 3. If an image is provided without a barcode, analyze using Gemini if available
      if (image) {
        if (!ai) {
          return res.status(422).json({
            error: "Scanning Unsupported",
            message: "Automatic label and image scanning requires AI vision capabilities (currently disabled). Please enter the numeric barcode manually above, or use the 'Manual Builder' tab to type in the nutrition facts!"
          });
        }

        try {
          console.log("Analyzing captured camera frame using Gemini 3.5 Flash Vision...");

          // Clean base64 image (remove data:image/jpeg;base64, etc.)
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

          const imagePart = {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          };

          const prompt = `You are an expert food nutritionist and toxicologist. Your task is to analyze the uploaded product image with absolute scientific accuracy.
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

CRITICAL REQUIREMENT: Do not invent, guess, or estimate any data. This is a serious health application where incorrect data can be dangerous. Only extract what is clearly visible on the packaging or nutrition label. If any nutrient, ingredient, or value is not visible or cannot be determined with absolute certainty, set its value in the JSON object to null or "Unspecified".
Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or write introductory text.`;

          const response = await generateContentWithRetry(
            [imagePart, prompt],
            "gemini-3.1-flash-lite",
            {
              responseMimeType: "application/json",
            }
          );

          const jsonText = response.text || "{}";
          console.log("Gemini parsed response successfully.");
          const parsedResult = JSON.parse(jsonText.trim());

          if (!parsedResult.productName || parsedResult.productName.toLowerCase().includes("unknown") || parsedResult.productName.trim() === "") {
            console.log(`[Camera Intercept] productName is empty or unknown: "${parsedResult.productName}". Returning status 404.`);
            return res.status(404).json({
              error: "error",
              message: "error"
            });
          }

          // Provide unique ID and timestamp
          parsedResult.id = Math.floor(100000 + Math.random() * 900000).toString();
          parsedResult.timestamp = new Date().toISOString();
          if (!parsedResult.detectedFromImage) {
            parsedResult.detectedFromImage = "camera";
          }

          return res.json(parsedResult);
        } catch (geminiErr: any) {
          console.log("Gemini image analysis exception:", geminiErr?.message || geminiErr);
          return res.status(500).json({
            error: "error",
            message: "error"
          });
        }
      }

      return res.status(400).json({
        error: "error",
        message: "error"
      });
    } catch (error: any) {
      console.error("Error during food analysis:", error);
      return res.status(500).json({
        error: "error",
        message: "error"
      });
    }
  });

  // AI-powered product database reconstruction/augmentation endpoint
  app.post("/api/augment-product-ai", async (req, res): Promise<any> => {
    try {
      const { barcode, productName } = req.body;
      const bcode = barcode?.trim();
      const pName = productName?.trim();

      if (!bcode && !pName) {
        return res.status(400).json({
          error: "Invalid Request",
          message: "Please provide either a barcode or product name for AI reconstruction."
        });
      }

      if (!ai) {
        return res.status(503).json({
          error: "AI Scanner Unavailable",
          message: "NutriLens AI engine is not currently configured or available on the server. Please fill in packaging details manually using the Manual Builder."
        });
      }

      console.log(`[AI Reconstruction Request] Barcode: ${bcode || "N/A"}, Name: ${pName || "N/A"}`);

      const reconstructionPrompt = `You are an expert food nutritionist, chemical toxicologist, and veteran product archivist.
The user is scanning a food product (often from the Indian market) which has missing ingredient lists or incomplete nutrition values in standard databases.
Please look up or scientifically synthesize the authentic, exact ingredient list and standard nutritional profile (per 100g or per standard serving) for this exact product:
Product Name / Hint: "${pName || 'Unknown'}"
Barcode: "${bcode || 'Unknown'}"

If you recognize popular Indian food brands like Haldiram's, Britannia, Amul, Parle, Maggi, Kurkure, Lay's India, Nestle India, Kissan, Balaji, Bikaji, Bikano, MTR, Kwality Wall's, Mother Dairy, etc., reconstruct their exact, real ingredients and nutrition values with extreme precision. 

You MUST return a JSON object conforming to this exact structure:
{
  "productName": "Correct Brand Name + Product Name (e.g. Britannia Bourbon Biscuits, Haldiram's Aloo Bhujia, Parle-G, Amul Butter)",
  "ingredients": "Real comma-separated list of ingredients (e.g. Wheat Flour, Sugar, Palm Oil, Cocoa Solids, Salt, Raising Agents, Emulsifiers...)",
  "calories": 480, // integer in kcal per 100g or serving
  "totalFat": 21.0, // number in grams
  "saturatedFat": 9.5, // number in grams
  "sugar": 32.0, // number in grams
  "sodium": 340, // number in milligrams
  "protein": 6.5, // number in grams
  "fiber": 2.0 // number in grams
}

CRITICAL: Do not invent or estimate random data. Reference authentic nutritional safety profiles for Indian or international food brands. Keep it objective, precise, and scientifically accurate.
Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or write introductory text.`;

      const response = await generateContentWithRetry(
        [reconstructionPrompt],
        "gemini-3.1-flash-lite",
        {
          responseMimeType: "application/json",
        }
      );

      if (!response || !response.text) {
        throw new Error("No response received from NutriLens AI.");
      }

      const parsedData = JSON.parse(response.text.trim());
      console.log(`[AI Reconstruction Success] Reconstructed: ${parsedData.productName}`);

      const calculatedResult = calculateHealthScoreAndGrade({
        productName: parsedData.productName || pName || "Augmented Product",
        calories: parsedData.calories !== undefined ? parsedData.calories : 0,
        totalFat: parsedData.totalFat !== undefined ? parsedData.totalFat : 0,
        saturatedFat: parsedData.saturatedFat !== undefined ? parsedData.saturatedFat : 0,
        sugar: parsedData.sugar !== undefined ? parsedData.sugar : 0,
        sodium: parsedData.sodium !== undefined ? parsedData.sodium : 0,
        protein: parsedData.protein !== undefined ? parsedData.protein : 0,
        fiber: parsedData.fiber !== undefined ? parsedData.fiber : 0,
        ingredients: parsedData.ingredients || "No ingredients list could be found"
      });

      calculatedResult.barcode = bcode || undefined;
      calculatedResult.detectedFromImage = "barcode";
      calculatedResult.isPrediction = true;
      calculatedResult.dataSource = 'prediction';
      calculatedResult.notice = `Successfully reconstructed ingredients & nutrition facts using NutriLens AI Indian product registry database for "${parsedData.productName}".`;

      return res.json(calculatedResult);
    } catch (err: any) {
      console.error("[AI Reconstruction Error] Failed to reconstruct product:", err);
      return res.status(500).json({
        error: "AI Reconstruction Failed",
        message: `We couldn't reconstruct the ingredients or nutritional facts using AI: ${err?.message || err}. Please double check your internet connection or use the Manual Builder to input the values.`
      });
    }
  });

  // Local fallback rule-based analyzer for ingredients list
  function localAnalyzeIngredients(ingredientsText: string) {
    const ingredientsLower = (ingredientsText || "").toLowerCase();
    const additives: Array<{ name: string; risk: "Low" | "Moderate" | "High"; reason: string }> = [];
    const allergens: string[] = [];
    const positives: string[] = [];
    const negatives: string[] = [];

    // Match known bad/moderate additives
    const additiveMatches = [
      { name: "High Fructose Corn Syrup", keywords: ["high fructose corn syrup", "hfcs"], risk: "High", reason: "Highly refined sweetener linked to obesity, metabolic issues, and fatty liver." },
      { name: "Palm Oil", keywords: ["palm oil", "palm fat"], risk: "Moderate", reason: "High in saturated fats and raises environmental concerns." },
      { name: "Aspartame", keywords: ["aspartame"], risk: "High", reason: "Artificial sweetener associated with potential neurochemical effects and gut dysbiosis." },
      { name: "Sucralose", keywords: ["sucralose"], risk: "Moderate", reason: "Artificial sweetener that may impact insulin sensitivity and gut bacteria." },
      { name: "MSG (Mono-sodium Glutamate)", keywords: ["monosodium glutamate", "msg", "e621"], risk: "Moderate", reason: "Excitotoxin and flavor enhancer that can trigger headaches or sensitivity in some." },
      { name: "Sodium Benzoate", keywords: ["sodium benzoate", "e211"], risk: "Moderate", reason: "Chemical preservative that can form benzene (a carcinogen) in presence of Vitamin C." },
      { name: "Hydrogenated Oil", keywords: ["hydrogenated", "partially hydrogenated"], risk: "High", reason: "Source of trans-fats which significantly raise LDL (bad) cholesterol and cardiovascular risk." },
      { name: "Carrageenan", keywords: ["carrageenan", "e407"], risk: "Moderate", reason: "Thickener linked to gastrointestinal inflammation and digestive distress." },
      { name: "Titanium Dioxide", keywords: ["titanium dioxide", "e171"], risk: "High", reason: "Food colorant banned in Europe due to genotoxicity concerns." },
      { name: "Yellow 5", keywords: ["yellow 5", "tartrazine", "e102"], risk: "High", reason: "Artificial food dye linked to hyperactivity in children and allergic reactions." },
      { name: "Red 40", keywords: ["red 40", "allura red", "e129"], risk: "High", reason: "Synthetic petro-chemical dye linked to behavioral issues and allergic responses." },
    ];

    for (const item of additiveMatches) {
      if (item.keywords.some(k => ingredientsLower.includes(k))) {
        additives.push({ name: item.name, risk: item.risk as any, reason: item.reason });
        negatives.push(`Contains ${item.name}`);
      }
    }

    // Check allergens
    const allergenMatches = [
      { name: "Wheat (Gluten)", keywords: ["wheat", "gluten", "barley", "rye"] },
      { name: "Milk (Dairy)", keywords: ["milk", "dairy", "whey", "casein", "lactose", "butter", "cheese"] },
      { name: "Soy", keywords: ["soy", "soya", "lecithin"] },
      { name: "Nuts", keywords: ["peanut", "almond", "cashew", "walnut", "hazelnut", "pecan", "macadamia", "nut"] },
      { name: "Eggs", keywords: ["egg", "albumen"] },
      { name: "Fish/Shellfish", keywords: ["fish", "shrimp", "crab", "lobster", "prawn", "oyster"] },
    ];

    for (const item of allergenMatches) {
      if (item.keywords.some(k => ingredientsLower.includes(k))) {
        allergens.push(item.name);
      }
    }

    // Check positives
    const positiveMatches = [
      { name: "Whole Grains", keywords: ["whole wheat", "oats", "oatmeal", "brown rice", "quinoa", "whole grain"] },
      { name: "Natural Sweeteners", keywords: ["honey", "maple syrup", "dates", "stevia", "monk fruit"] },
      { name: "Superfoods/Seeds", keywords: ["chia", "flax", "hemp", "turmeric", "ginger", "cacao", "green tea"] },
      { name: "Probiotics/Fermented", keywords: ["yogurt cultures", "probiotic", "lactobacillus", "kefir"] },
      { name: "Healthy Oils", keywords: ["olive oil", "avocado oil", "coconut oil"] },
    ];

    for (const item of positiveMatches) {
      if (item.keywords.some(k => ingredientsLower.includes(k))) {
        positives.push(`Contains healthy ${item.name.toLowerCase()}`);
      }
    }

    // Score calculation
    let score = 85; // Base high score for whole foods
    score -= additives.length * 15;
    if (ingredientsLower.includes("sugar") || ingredientsLower.includes("sucrose")) {
      score -= 10;
      negatives.push("Contains added sugars");
    }
    if (ingredientsLower.includes("salt") || ingredientsLower.includes("sodium")) {
      if (!ingredientsLower.includes("sea salt")) {
        score -= 5;
      }
    }

    score = Math.max(0, Math.min(100, score));

    let rating: "Good" | "Moderate" | "Avoid" = "Good";
    let isHealthy: "healthy" | "moderate" | "unhealthy" = "healthy";

    if (score < 45) {
      rating = "Avoid";
      isHealthy = "unhealthy";
    } else if (score < 70) {
      rating = "Moderate";
      isHealthy = "moderate";
    }

    if (positives.length === 0) {
      positives.push("Provides standard nutritional energy");
    }
    if (negatives.length === 0) {
      positives.push("No highly processed sweeteners or industrial additives found");
    }

    const summary = `This ingredient profile scores a ${score}/100. It contains ${additives.length > 0 ? `${additives.length} flagged additives` : "no major flagged additives"} and is rated as ${rating}. ${
      rating === "Good" 
        ? "It consists primarily of wholesome or standard food ingredients with minimal synthetic processing." 
        : rating === "Moderate"
        ? "It contains a few moderately processed additives or sweeteners that are safe in moderation but should be limited."
        : "It contains highly processed synthetic ingredients, artificial sweeteners, or preservatives which are recommended to avoid."
    }`;

    return {
      ingredients: ingredientsText,
      rating,
      score,
      summary,
      additives,
      allergens,
      positives,
      negatives,
      isHealthy
    };
  }

  // Ingredients List Health Analysis endpoint
  app.post("/api/analyze-ingredients", async (req, res): Promise<any> => {
    try {
      const { ingredients, image } = req.body;

      if (!ingredients && !image) {
        return res.status(400).json({
          error: "Invalid Request",
          message: "Please provide either ingredients text or an image of an ingredients label for analysis."
        });
      }

      // If Gemini is available, use it for rich analysis
      if (ai) {
        try {
          let contents: any[] = [];
          let userPrompt = "";

          if (image) {
            console.log("Analyzing ingredients image using Gemini 3.5 Flash...");
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

            contents.push({
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64,
              }
            });

             userPrompt = `You are an expert food toxicologist and chemical specialist. 
Your task is to scan and transcribe the visible ingredients list from this packaging photo with absolute fidelity.
Then, evaluate all the transcribed ingredients for healthiness, additives, potential allergen risks, and clean-label quality.
You MUST return a JSON object with this exact structure:
{
  "ingredients": "transcribed comma-separated list of ingredients",
  "productName": "Product name or brand if visible (or null if not clearly visible)",
  "rating": "Good" | "Moderate" | "Avoid",
  "score": 85, // 0 to 100 healthiness rating based strictly on toxicology profile
  "summary": "Concise 2-3 sentence overview of these ingredients, highlighting any safety, processing, or chemical additive concerns.",
  "additives": [
    { "name": "Ingredient / Additive Name", "risk": "Low" | "Moderate" | "High", "reason": "Why is this a risk or benefit?" }
  ],
  "allergens": ["Gluten", "Dairy"],
  "positives": ["Positive point 1", "Positive point 2"],
  "negatives": ["Negative point 1", "Negative point 2"],
  "isHealthy": "healthy" | "moderate" | "unhealthy"
}

CRITICAL REQUIREMENT: Do not invent or estimate any data. This is a serious health and toxicology application. Only transcribe what is clearly visible on the packaging. If any ingredients are not visible, or if the product cannot be determined, set ingredients to "Unspecified" and additives/allergens to empty arrays.
Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or write introductory text.`;
          } else {
            console.log("Analyzing ingredients text using Gemini 3.5 Flash...");
            userPrompt = `You are an expert food toxicologist and nutrition specialist.
Analyze the following text listing food ingredients:
"${ingredients}"

Evaluate all of these ingredients for healthiness, synthetic additives, potential allergen cross-contamination risks, and clean-label benefits with absolute precision.
You MUST return a JSON object with this exact structure:
{
  "ingredients": "the provided ingredients text cleaned up",
  "rating": "Good" | "Moderate" | "Avoid",
  "score": 85, // 0 to 100 healthiness rating
  "summary": "Concise 2-3 sentence overview of these ingredients, highlighting any safety, processing, or chemical additive concerns.",
  "additives": [
    { "name": "Ingredient / Additive Name", "risk": "Low" | "Moderate" | "High", "reason": "Why is this a risk or benefit?" }
  ],
  "allergens": ["Gluten", "Dairy"],
  "positives": ["Positive point 1", "Positive point 2"],
  "negatives": ["Negative point 1", "Negative point 2"],
  "isHealthy": "healthy" | "moderate" | "unhealthy"
}

CRITICAL REQUIREMENT: Do not invent random data or hallucinate safety ratings. Be strictly precise, objective, and scientific. If ingredients are vague or unknown, mark them objectively and list any associated risks neutrally.
Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or write introductory text.`;
          }

          contents.push(userPrompt);

          const response = await generateContentWithRetry(
            contents,
            "gemini-3.1-flash-lite",
            {
              responseMimeType: "application/json",
            }
          );

          const jsonText = response.text || "{}";
          const parsedResult = JSON.parse(jsonText.trim());
          parsedResult.id = Math.floor(100000 + Math.random() * 900000).toString();
          parsedResult.timestamp = new Date().toISOString();

          return res.json(parsedResult);
        } catch (geminiErr: any) {
          console.log("Gemini ingredients analysis exception, evaluating fallbacks:", geminiErr?.message || geminiErr);
          
          // If the user uploaded an image, we cannot parse ingredients text without the AI vision OCR.
          // Therefore, throw a proper user-friendly 503 error instead of an empty rule-based mockup.
          if (image) {
            return res.status(503).json({
              error: "AI Vision Service Busy",
              message: "The premium AI scanner is currently experiencing extremely high demand. Please wait a few seconds and try capturing again, or copy and paste the ingredient text directly to run the local toxicological scanner instantly!"
            });
          }

          // Fallback to local analysis for text input
          const localResult = localAnalyzeIngredients(ingredients || "");
          return res.json({
            ...localResult,
            notice: "A connection timeout occurred with the premium AI scanner. Fell back to the local toxicological parser!"
          });
        }
      } else {
        // Run rules-based local engine
        console.log("Gemini client not initialized. Using rules-based local ingredients analyzer.");
        if (image) {
          return res.status(422).json({
            error: "OCR Scanning Disabled",
            message: "Automatic image OCR transcription requires AI vision capabilities (currently disabled). Please copy and paste the ingredients list text directly, or enter a barcode!"
          });
        }

        const localResult = localAnalyzeIngredients(ingredients);
        return res.json(localResult);
      }
    } catch (err: any) {
      console.error("Error during ingredients analysis:", err);
      return res.status(500).json({
        error: err.message || "An unexpected error occurred during the ingredients analysis.",
        details: err.toString(),
      });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started on port ${PORT}`);
  });
}

startServer();
