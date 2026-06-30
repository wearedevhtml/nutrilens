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
  let score = 85; 
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const apiKey = env.GEMINI_API_KEY;

  try {
    const body: any = await request.json();
    const { ingredients, image } = body;

    if (!ingredients && !image) {
      return new Response(
        JSON.stringify({
          error: "Invalid Request",
          message: "Please provide either ingredients text or an image of an ingredients label for analysis."
        }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (apiKey) {
      try {
        let contents: any[] = [];
        let userPrompt = "";

        if (image) {
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
              mimeType,
              data: cleanBase64
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

CRITICAL REQUIREMENT: Do not invent or estimate any data. Only transcribe what is clearly visible. If any ingredients are not visible, set ingredients to "Unspecified" and additives/allergens to empty arrays.
Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or write introductory text.`;
        } else {
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

CRITICAL REQUIREMENT: Do not invent random data or hallucinate safety ratings. Be strictly precise, objective, and scientific.
Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or write introductory text.`;
        }

        contents.push({ parts: [{ text: userPrompt }] });

        const response = await callGeminiWithRetry(
          apiKey,
          contents,
          "gemini-3.1-flash-lite",
          "application/json"
        );

        const jsonText = response.text || "{}";
        const parsedResult = JSON.parse(jsonText.trim());
        parsedResult.id = Math.floor(100000 + Math.random() * 900000).toString();
        parsedResult.timestamp = new Date().toISOString();

        return new Response(JSON.stringify(parsedResult), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (geminiErr: any) {
        if (image) {
          return new Response(
            JSON.stringify({
              error: "AI Vision Service Busy",
              message: "The premium AI scanner is currently experiencing high demand. Please try copy-pasting the ingredient text directly!"
            }),
            { status: 503, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
          );
        }

        const localResult = localAnalyzeIngredients(ingredients || "");
        return new Response(
          JSON.stringify({
            ...localResult,
            notice: "A connection timeout occurred with the premium AI scanner. Fell back to local toxicological parser!"
          }),
          { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    } else {
      if (image) {
        return new Response(
          JSON.stringify({
            error: "OCR Scanning Disabled",
            message: "Automatic image OCR transcription requires AI vision capabilities. Please copy and paste the ingredients list text directly!"
          }),
          { status: 422, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }

      const localResult = localAnalyzeIngredients(ingredients);
      return new Response(JSON.stringify(localResult), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "Analysis failed",
        message: err.message || "An unexpected error occurred."
      }),
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
