import { FoodAnalysisResult } from "../types";
import {
  ThumbsUp,
  ThumbsDown,
  Info,
  ShieldAlert,
  ArrowLeft,
  Apple,
  Share2,
  CheckCircle,
  AlertTriangle,
  Leaf,
  Scale,
  Volume2,
  VolumeX,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import RadialGauge from "./RadialGauge";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      type: "spring", 
      stiffness: 260, 
      damping: 25 
    } 
  }
};

interface AnalysisDetailsProps {
  result: FoodAnalysisResult;
  onBack: () => void;
  onUpdateResult?: (updated: FoodAnalysisResult) => void;
}

export default function AnalysisDetails({ result, onBack, onUpdateResult }: AnalysisDetailsProps) {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isReconstructing, setIsReconstructing] = useState(false);
  const [reconstructError, setReconstructError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<"serving" | "100g">("serving");
  const [servingWeightG, setServingWeightG] = useState<number>(55);

  const handleAIReconstruct = async () => {
    setIsReconstructing(true);
    setReconstructError(null);
    try {
      const response = await fetch("/api/augment-product-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: result.barcode,
          productName: result.productName,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to reconstruct product data using AI.");
      }
      if (onUpdateResult) {
        onUpdateResult(data);
      }
    } catch (err: any) {
      console.log("Reconstruction notification:", err?.message || err);
      setReconstructError("error");
    } finally {
      setIsReconstructing(false);
    }
  };

  // Check for SpeechSynthesis support
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      setVoiceSupported(true);
      // Auto-narrate the scan result on load
      announceProduct();
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [result]);

  const announceProduct = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    
    // Cancel any current speaking
    window.speechSynthesis.cancel();

    const textToSpeak = `Detected product: ${result.productName}. It has a calculated health score of ${result.healthScore} out of 100, receiving a nutritional grade of ${result.grade}.`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleToggleVoice = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      announceProduct();
    }
  };

  // Determine colors based on status
  const getThemeColors = (status: string) => {
    switch (status) {
      case "healthy":
        return {
          primary: "text-emerald-700",
          bg: "bg-white",
          border: "border-neutral-200",
          ring: "ring-emerald-500/10",
          textBg: "bg-emerald-600 text-white",
          accentBg: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
          progressColor: "stroke-emerald-600",
        };
      case "moderate":
        return {
          primary: "text-amber-700",
          bg: "bg-white",
          border: "border-neutral-200",
          ring: "ring-amber-500/10",
          textBg: "bg-amber-500 text-white",
          accentBg: "bg-amber-50 text-amber-700 border-amber-200/50",
          progressColor: "stroke-amber-500",
        };
      case "unhealthy":
      default:
        return {
          primary: "text-rose-700",
          bg: "bg-white",
          border: "border-neutral-200",
          ring: "ring-rose-500/10",
          textBg: "bg-rose-600 text-white",
          accentBg: "bg-rose-50 text-rose-700 border-rose-200/50",
          progressColor: "stroke-rose-600",
        };
    }
  };

  // Helper to parse numeric values from strings (e.g. "3.5g", "150mg" -> 3.5, 150)
  const parseNumValue = (val: string | undefined): number => {
    if (!val) return 0;
    const match = val.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  const convertValue = (valString: string | undefined): string => {
    if (!valString) return "N/A";
    if (displayMode === "serving") return valString;

    // We parse the numerical part and the unit part
    const match = valString.match(/^([\d.]+)\s*([a-zA-Z%]+)?$/);
    if (!match) return valString;

    const num = parseFloat(match[1]);
    const unit = match[2] || "";

    if (isNaN(num)) return valString;

    // Calculate per 100g: (value / servingWeightG) * 100
    const per100g = (num / servingWeightG) * 100;
    
    // Format to a clean number with 1 or 2 decimal places if needed
    const formatted = parseFloat(per100g.toFixed(1));
    return unit ? `${formatted} ${unit}` : `${formatted}`;
  };

  const fatG = parseNumValue(result.nutritionFacts.totalFat);
  const sugarG = parseNumValue(result.nutritionFacts.sugar);
  const sodiumMg = parseNumValue(result.nutritionFacts.sodium);
  const proteinG = parseNumValue(result.nutritionFacts.protein);
  const fiberG = parseNumValue(result.nutritionFacts.fiber);

  // Normalize sub-metrics to a 10-100 rating scale where a higher value is positive / balanced:
  // - Low Fat is positive
  // - Low Sugar is positive
  // - Low Sodium is positive
  // - High Protein is positive
  // - High Fiber is positive
  const fatScore = fatG <= 3 ? 100 : fatG >= 20 ? 25 : Math.round(100 - ((fatG - 3) * (75 / 17)));
  const sugarScore = sugarG <= 5 ? 100 : sugarG >= 25 ? 20 : Math.round(100 - ((sugarG - 5) * (80 / 20)));
  const sodiumScore = sodiumMg <= 140 ? 100 : sodiumMg >= 800 ? 20 : Math.round(100 - ((sodiumMg - 140) * (80 / 660)));
  const proteinScore = proteinG >= 15 ? 100 : proteinG <= 1 ? 20 : Math.round(20 + ((proteinG - 1) * (80 / 14)));
  const fiberScore = fiberG >= 6 ? 100 : fiberG <= 0.5 ? 20 : Math.round(20 + ((fiberG - 0.5) * (80 / 5.5)));

  const radarData = [
    { subject: "Fat Balance", value: Math.max(10, Math.min(100, fatScore)), raw: convertValue(result.nutritionFacts.totalFat || "0g") },
    { subject: "Sugar Limit", value: Math.max(10, Math.min(100, sugarScore)), raw: convertValue(result.nutritionFacts.sugar || "0g") },
    { subject: "Sodium Limit", value: Math.max(10, Math.min(100, sodiumScore)), raw: convertValue(result.nutritionFacts.sodium || "0mg") },
    { subject: "Protein Boost", value: Math.max(10, Math.min(100, proteinScore)), raw: convertValue(result.nutritionFacts.protein || "0g") },
    { subject: "Fiber Index", value: Math.max(10, Math.min(100, fiberScore)), raw: convertValue(result.nutritionFacts.fiber || "0g") },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-stone-200/80 p-2.5 rounded-xl shadow-md text-[10px] font-sans font-semibold">
          <p className="text-stone-800 font-bold mb-0.5">{data.subject}</p>
          <div className="space-y-0.5 font-mono text-stone-500">
            <p>Score: <span className="text-emerald-700 font-bold">{data.value}/100</span></p>
            <p>Value: <span className="text-stone-700 font-bold">{data.raw}</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  const colors = getThemeColors(result.isHealthy);

  // Format share text
  const handleShare = () => {
    const text = `Food Health Check: ${result.productName}
Score: ${result.healthScore}/100 (Grade: ${result.grade})
Status: ${result.isHealthy.toUpperCase()}
Summary: ${result.summary}
Ingredients: ${result.ingredients}
Check your food healthy scores with Food Barcode Health Scanner!`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-2xl mx-auto pb-12 relative z-10"
    >
      {/* Back button and Share */}
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-stone-500 hover:text-emerald-800 font-semibold transition group py-1 cursor-pointer"
          id="btn-back-scanner"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition text-emerald-700" />
          Scan another item
        </button>

        <div className="flex items-center gap-2">
          {voiceSupported && (
            <button
              onClick={handleToggleVoice}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition cursor-pointer border ${
                isSpeaking 
                  ? "bg-emerald-100/80 border-emerald-300 text-emerald-800 animate-pulse" 
                  : "bg-stone-100/80 hover:bg-stone-200/80 text-stone-700 border-stone-200"
              }`}
              id="btn-voice-tell"
              title="Speak product name out loud"
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-emerald-700 animate-bounce" />
                  <span>Stop Speaking</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-stone-500" />
                  <span>Speak Name</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs bg-stone-100/80 hover:bg-stone-200/80 active:scale-95 text-stone-700 px-3 py-1.5 rounded-full font-semibold transition cursor-pointer border border-stone-200"
            id="btn-share-result"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-700" />
            {copied ? "Copied!" : "Share Summary"}
          </button>
        </div>
      </div>

      {/* Main score card */}
      <div className="p-6 rounded-2xl border border-stone-200 bg-white/85 backdrop-blur-md shadow-sm shadow-stone-100/50">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 relative">
          <div className="text-center md:text-left flex-1 min-w-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${colors.accentBg} mb-3 border`}>
              {result.isHealthy === "healthy" && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
              {result.isHealthy === "moderate" && <Info className="w-3.5 h-3.5 text-amber-600" />}
              {result.isHealthy === "unhealthy" && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
              {result.isHealthy.toUpperCase()} CHOICE
            </span>
            <h2 className="text-xl font-display font-bold text-stone-800 leading-tight tracking-tight break-words">
              {result.productName}
            </h2>
            {result.barcode && (
              <p className="text-[10px] text-stone-400 mt-1 font-mono tracking-wider">
                Barcode: {result.barcode}
              </p>
            )}
            {result.notice && (
              <div className="mt-3 flex items-start gap-2 bg-emerald-50/80 border border-emerald-100 text-emerald-800 p-2.5 rounded-xl text-[11px] leading-relaxed text-left">
                <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>{result.notice}</span>
              </div>
            )}
            <p className="text-xs text-stone-600 mt-3.5 leading-relaxed font-normal">
              {result.summary}
            </p>
          </div>

          {/* Health Score Circle & Grade Stamp */}
          <div className="flex flex-row md:flex-col items-center gap-4 shrink-0 bg-white/90 p-4 rounded-2xl border border-stone-200/60 shadow-2xs">
            {/* Animated Radial Gauge */}
            <RadialGauge score={result.healthScore} grade={result.grade} />

            {/* Letter Grade */}
            <div className="text-center">
              <div className={`w-12 h-12 rounded-xl font-black text-2xl flex items-center justify-center border shadow-2xs ${colors.textBg} ${colors.border}`}>
                {result.grade}
              </div>
              <p className="text-[9px] text-stone-400 font-bold mt-1 uppercase tracking-wider">GRADE</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid: Positives vs Negatives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Positives */}
        <div className="p-5 bg-white/85 backdrop-blur-md border border-stone-200 rounded-2xl flex flex-col h-full shadow-2xs">
          <div className="flex items-center gap-2 text-stone-800 font-bold text-xs border-b border-stone-100 pb-3 mb-3 font-display">
            <div className="p-1 bg-emerald-50 border border-emerald-100 rounded-md">
              <ThumbsUp className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            Nutritional Positives
          </div>
          {result.positives.length > 0 ? (
            <motion.ul
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-2.5 flex-1"
            >
              {result.positives.map((pos, idx) => (
                <motion.li
                  key={idx}
                  variants={itemVariants}
                  className="text-xs text-stone-600 flex items-start gap-2 leading-relaxed font-normal"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <span>{pos}</span>
                </motion.li>
              ))}
            </motion.ul>
          ) : (
            <p className="text-xs text-stone-400 italic">No significant positive properties found.</p>
          )}
        </div>

        {/* Negatives */}
        <div className="p-5 bg-white/85 backdrop-blur-md border border-stone-200 rounded-2xl flex flex-col h-full shadow-2xs">
          <div className="flex items-center gap-2 text-stone-800 font-bold text-xs border-b border-stone-100 pb-3 mb-3 font-display">
            <div className="p-1 bg-rose-50 border border-rose-100 rounded-md">
              <ThumbsDown className="w-3.5 h-3.5 text-rose-700" />
            </div>
            Ingredient Warnings
          </div>
          {result.negatives.length > 0 ? (
            <motion.ul
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-2.5 flex-1"
            >
              {result.negatives.map((neg, idx) => (
                <motion.li
                  key={idx}
                  variants={itemVariants}
                  className="text-xs text-stone-600 flex items-start gap-2 leading-relaxed font-normal"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                  <span>{neg}</span>
                </motion.li>
              ))}
            </motion.ul>
          ) : (
            <p className="text-xs text-stone-400 italic">No critical warnings or bad ingredients spotted!</p>
          )}
        </div>
      </div>

      {/* Grid: Nutrition Card & Ingredients */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nutrition Card */}
        <div className="bg-white/85 backdrop-blur-md border border-stone-200 rounded-2xl p-5 shadow-2xs col-span-1 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3 mb-4">
            <div className="flex items-center gap-2 text-stone-800 font-bold text-xs font-display">
              <div className="p-1 bg-emerald-50 border border-emerald-100 rounded-md">
                <Scale className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              Nutrition Parameters & Balanced Formulation Radar
            </div>

            {/* Display Mode Toggle */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400 font-bold uppercase tracking-wider text-[9px] font-mono">View Mode</span>
                <div className="inline-flex rounded-lg bg-stone-100 p-0.5 border border-stone-200/50">
                  <button
                    type="button"
                    onClick={() => setDisplayMode("serving")}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition duration-150 ${
                      displayMode === "serving"
                        ? "bg-white text-emerald-800 shadow-3xs border border-stone-200/30 font-extrabold"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    Per Serving
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode("100g")}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition duration-150 ${
                      displayMode === "100g"
                        ? "bg-white text-emerald-800 shadow-3xs border border-stone-200/30 font-extrabold"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    Per 100g
                  </button>
                </div>
              </div>

              {/* Editable Serving Weight */}
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400 font-bold uppercase tracking-wider text-[9px] font-mono">Serving Size</span>
                <div className="flex items-center bg-white border border-stone-200 rounded-lg px-2 py-0.5 shadow-3xs max-w-[85px] hover:border-emerald-500/50 focus-within:border-emerald-600 transition">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={servingWeightG}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setServingWeightG(val > 0 ? val : 1);
                    }}
                    className="w-10 bg-transparent text-center font-mono text-stone-800 font-bold focus:outline-none focus:ring-0 text-xs py-0.5"
                  />
                  <span className="text-[10px] text-stone-400 font-bold font-mono">g</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Table Parameters */}
            <div className="md:col-span-6 divide-y divide-stone-100 text-xs font-normal">
              <div className="flex justify-between py-2">
                <span className="text-stone-500 font-medium">Calories</span>
                <span className="font-semibold text-stone-800 font-mono">{convertValue(result.nutritionFacts.calories)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-stone-500 font-medium">Sugars (Total)</span>
                <span className={`font-semibold font-mono ${result.nutritionFacts.sugar && parseInt(result.nutritionFacts.sugar) > 10 ? "text-amber-600" : "text-stone-800"}`}>
                  {convertValue(result.nutritionFacts.sugar)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-stone-500 font-medium">Sodium</span>
                <span className="font-semibold text-stone-800 font-mono">{convertValue(result.nutritionFacts.sodium)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-stone-500 font-medium">Total Fat</span>
                <span className="font-semibold text-stone-800 font-mono">{convertValue(result.nutritionFacts.totalFat)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-stone-500 font-medium">Saturated Fat</span>
                <span className="font-semibold text-stone-800 font-mono">{convertValue(result.nutritionFacts.saturatedFat)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-stone-500 font-medium">Dietary Fiber</span>
                <span className="font-semibold text-emerald-700 font-mono">{convertValue(result.nutritionFacts.fiber)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-stone-500 font-medium">Protein</span>
                <span className="font-semibold text-emerald-700 font-mono">{convertValue(result.nutritionFacts.protein)}</span>
              </div>
            </div>

            {/* Radar Chart Visualizer */}
            <div className="md:col-span-6 flex flex-col items-center justify-center p-2 bg-stone-50/50 rounded-xl border border-stone-200/40 relative overflow-visible h-56">
              <div className="absolute top-2.5 left-3.5 text-[9px] font-mono text-stone-400 font-bold uppercase tracking-wider">
                Parameter Scoring Map
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="53%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: '#57534e', fontSize: 9, fontWeight: 700 }}
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]} 
                    tick={{ fill: '#a8a29e', fontSize: 7 }}
                    tickCount={4}
                  />
                  <Radar
                    name="Nutritional Score"
                    dataKey="value"
                    stroke="#047857"
                    fill="#10b981"
                    fillOpacity={0.2}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Ingredients visual list */}
        <div className="bg-white/85 backdrop-blur-md border border-stone-200 rounded-2xl p-5 flex flex-col h-full shadow-2xs col-span-1 md:col-span-2">
          <div className="flex items-center gap-2 text-stone-800 font-bold text-xs border-b border-stone-100 pb-3 mb-3 font-display">
            <div className="p-1 bg-emerald-50 border border-emerald-100 rounded-md">
              <Leaf className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            Ingredients Profile
          </div>
          <div className="text-xs text-stone-600 leading-relaxed overflow-y-auto flex-1 max-h-[220px] bg-stone-50/70 p-3 rounded-xl border border-stone-200/50 font-normal">
            {result.ingredients || "No ingredients list extracted."}
          </div>
          <p className="text-[10px] text-stone-400 mt-2.5 italic flex items-center gap-1 leading-normal">
            <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            Ingredients are evaluated against raw food additive standards.
          </p>

          {/* BioLens AI Reconstruction Card */}
          {(!result.ingredients || 
            result.ingredients.toLowerCase().includes("no ingredients list") || 
            result.ingredients.toLowerCase().includes("not listed") || 
            result.ingredients.length < 25) && onUpdateResult && (
            <div className="mt-4 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-100 p-4 rounded-xl shadow-3xs relative overflow-hidden text-left">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Sparkles className="w-16 h-16 text-emerald-700" />
              </div>
              <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 font-display">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
                BioLens AI Ingredient Reconstructor
              </h4>
              <p className="text-[11px] text-emerald-700 mt-1.5 leading-relaxed font-normal">
                Scanned products (especially regional or Indian brands like Haldiram's, Amul, Britannia, Parle-G, Maggi, Kurkure etc.) are often missing details in standard public registries. Trigger BioLens AI to reconstruct this product's authentic formulation and preservatives.
              </p>
              
              <button
                onClick={handleAIReconstruct}
                disabled={isReconstructing}
                className={`mt-3 w-full flex items-center justify-center gap-2 text-xs font-bold font-display py-2 px-4 rounded-lg shadow-sm border transition-all duration-200 cursor-pointer ${
                  isReconstructing 
                    ? "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 hover:shadow-md"
                }`}
              >
                {isReconstructing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                    Reconstructing Formulation...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-white/90" />
                    Reconstruct with BioLens AI
                  </>
                )}
              </button>
              {reconstructError && (
                <p className="text-[10px] text-rose-600 mt-2 font-medium bg-rose-50 border border-rose-100/50 p-2 rounded-lg">
                  ⚠️ {reconstructError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Explanatory Guide Box */}
      <div className="bg-stone-50 border border-stone-200/60 rounded-2xl p-4 shadow-3xs text-left">
        <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5 font-display mb-2">
          <Info className="w-3.5 h-3.5 text-stone-500" />
          How are missing ingredients and Indian products evaluated?
        </h4>
        <p className="text-[11px] text-stone-600 leading-relaxed font-normal">
          When a database record lacks complete ingredient text, BioLens evaluates the product's health scale using a dual-mode approach:
        </p>
        <ul className="mt-2 space-y-1.5 text-[10px] text-stone-500 list-disc list-inside font-normal">
          <li><strong className="text-stone-700">Macro Ratio Scoring:</strong> We analyze the ratio of positive elements (protein, dietary fiber) against negative ones (saturated fats, sugars, sodium density) to produce a Nutri-Score inspired grade.</li>
          <li><strong className="text-stone-700">Active Camera Extraction:</strong> Use our <span className="font-bold text-emerald-800">Ingredients Scanner</span> tab to snap a quick photo of the ingredients list on the packaging for a 100% complete toxicological analysis!</li>
          <li><strong className="text-stone-700">BioLens Indian Registry Synthesis:</strong> Click the <span className="font-bold text-emerald-800">Reconstruct with BioLens AI</span> button above to trigger a direct lookup and safety evaluation against popular Indian brands.</li>
        </ul>
      </div>

      {/* Better Alternatives */}
      <div className="bg-emerald-50/40 border border-emerald-100/60 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center gap-2 text-emerald-900 font-display font-bold text-sm mb-4">
          <Apple className="w-4 h-4 text-emerald-700" />
          Smart Botanical Recommendations
        </div>
        
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-3.5"
        >
          {result.alternatives.map((alt, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              whileHover={{ scale: 1.015, y: -2 }}
              className="bg-white/95 p-4 rounded-xl border border-stone-200/80 shadow-3xs hover:border-emerald-500/50 hover:shadow-2xs transition duration-200"
            >
              <h5 className="text-xs font-bold text-stone-800 flex items-center gap-1.5 font-display">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                {alt.name}
              </h5>
              <p className="text-xs text-stone-500 mt-1.5 leading-relaxed font-normal">
                {alt.reason}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
