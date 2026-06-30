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

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "AI Scanner Unavailable",
        message: "BioLens AI engine requires a GEMINI_API_KEY environment variable. Please add it in your Cloudflare Pages dashboard settings."
      }),
      { status: 503, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  try {
    const body: any = await request.json();
    const barcode = body.barcode?.trim();
    const productName = body.productName?.trim();

    if (!barcode && !productName) {
      return new Response(
        JSON.stringify({
          error: "Invalid Request",
          message: "Please provide either a barcode or product name for AI reconstruction."
        }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const reconstructionPrompt = `You are an expert food nutritionist, chemical toxicologist, and veteran product archivist.
The user is scanning a food product (often from the Indian market) which has missing ingredient lists or incomplete nutrition values in standard databases.
Please look up or scientifically synthesize the authentic, exact ingredient list and standard nutritional profile (per 100g or per standard serving) for this exact product:
Product Name / Hint: "${productName || 'Unknown'}"
Barcode: "${barcode || 'Unknown'}"

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

    const response = await callGeminiWithRetry(
      apiKey,
      [{ parts: [{ text: reconstructionPrompt }] }],
      "gemini-3.1-flash-lite",
      "application/json"
    );

    if (!response || !response.text) {
      throw new Error("No response received from BioLens AI.");
    }

    const parsedData = JSON.parse(response.text.trim());

    const calculatedResult = calculateHealthScoreAndGrade({
      productName: parsedData.productName || productName || "Augmented Product",
      calories: parsedData.calories !== undefined ? parsedData.calories : 0,
      totalFat: parsedData.totalFat !== undefined ? parsedData.totalFat : 0,
      saturatedFat: parsedData.saturatedFat !== undefined ? parsedData.saturatedFat : 0,
      sugar: parsedData.sugar !== undefined ? parsedData.sugar : 0,
      sodium: parsedData.sodium !== undefined ? parsedData.sodium : 0,
      protein: parsedData.protein !== undefined ? parsedData.protein : 0,
      fiber: parsedData.fiber !== undefined ? parsedData.fiber : 0,
      ingredients: parsedData.ingredients || "No ingredients list could be found"
    });

    calculatedResult.barcode = barcode || undefined;
    calculatedResult.detectedFromImage = "barcode";
    calculatedResult.notice = `Successfully reconstructed ingredients & nutrition facts using BioLens AI Indian product registry database for "${parsedData.productName}".`;

    return new Response(JSON.stringify(calculatedResult), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "AI Reconstruction Failed",
        message: err.message || "We couldn't reconstruct the ingredients or nutritional facts using AI."
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
