import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Camera, 
  Search, 
  History, 
  Calculator, 
  Leaf, 
  Sparkles, 
  AlertCircle, 
  HelpCircle,
  FileText,
  Plus,
  Apple,
  Heart,
  Activity,
  TrendingUp,
  ShieldAlert,
  HeartHandshake
} from "lucide-react";

import { FoodAnalysisResult, HistoryItem } from "./types";
import { calculateHealthScoreAndGrade } from "./healthAlgorithm";
import { OFFLINE_MOCK_FOODS } from "./mockData";

// Components
import DemoBarcodes from "./components/DemoBarcodes";
import CameraScanner from "./components/CameraScanner";
import AnalysisDetails from "./components/AnalysisDetails";
import IngredientsScanner from "./components/IngredientsScanner";
import AppLogo from "./components/AppLogo";
import BarcodeHistory from "./components/BarcodeHistory";
import FakeProductGuide from "./components/FakeProductGuide";

export default function App() {
  const [activeTab, setActiveTab] = useState<"scan" | "calculator" | "ingredients" | "fake">("scan");
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Scanner states
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  // Manual Calculator states
  const [calcName, setCalcName] = useState("");
  const [calcCalories, setCalcCalories] = useState("");
  const [calcTotalFat, setCalcTotalFat] = useState("");
  const [calcSatFat, setCalcSatFat] = useState("");
  const [calcSugar, setCalcSugar] = useState("");
  const [calcSodium, setCalcSodium] = useState("");
  const [calcProtein, setCalcProtein] = useState("");
  const [calcFiber, setCalcFiber] = useState("");
  const [calcIngredients, setCalcIngredients] = useState("");

  // Welcome Splash Screen State
  const [showWelcome, setShowWelcome] = useState(true);
  const [loadingSub, setLoadingSub] = useState("Initializing NutriLens Engine v2.0...");

  useEffect(() => {
    const t1 = setTimeout(() => {
      setLoadingSub("Processing Additive Warning Matrix...");
    }, 700);

    const t2 = setTimeout(() => {
      setLoadingSub("Ready to Analyze Formulation...");
    }, 1400);

    const t3 = setTimeout(() => {
      setShowWelcome(false);
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("barcode_health_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filter out any items that have "unknown" or empty product name
          const filtered = parsed.filter(item => {
            const name = item.result?.productName || "";
            return name && !name.toLowerCase().includes("unknown") && name.trim() !== "";
          });
          setHistory(filtered);
          // If we had to filter any out, save it back
          if (filtered.length !== parsed.length) {
            localStorage.setItem("barcode_health_history", JSON.stringify(filtered));
          }
        } else {
          setHistory(parsed);
        }
      }
    } catch (e) {
      console.warn("Could not read barcode history from localStorage:", e);
    }
  }, []);

  // Save history to localStorage helper
  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("barcode_health_history", JSON.stringify(newHistory));
    } catch (e) {
      console.warn("Could not save barcode history to localStorage:", e);
    }
  };

  // Add search result to history list
  const appendToHistory = (itemResult: FoodAnalysisResult) => {
    const newItem: HistoryItem = {
      id: Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      result: itemResult,
    };
    const updatedHistory = [newItem, ...history].slice(0, 50); // Keep last 50 items
    saveHistory(updatedHistory);
  };

  // Barcode Lookup function
  const handleBarcodeLookup = async (barcode: string) => {
    if (!barcode.trim()) return;
    setIsLoading(true);
    setError(null);
    setOfflineNotice(null);

    // Strip whitespaces
    const cleanBarcode = barcode.trim();

    try {
      const response = await fetch("/api/analyze-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: cleanBarcode, source: "webapp" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to analyze barcode.");
      }

      setResult(data);
      if (data.notice) {
        setOfflineNotice(data.notice);
      } else {
        setOfflineNotice(null);
      }
      appendToHistory(data);
      setBarcodeInput(""); // clear input

      // Fire leaf-burst storm event
      window.dispatchEvent(new CustomEvent("product-analyzed"));
    } catch (err: any) {
      console.log("Analysis notification:", err?.message || err);
      setError("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle direct demo select
  const handleDemoSelect = (barcode: string) => {
    handleBarcodeLookup(barcode);
  };

  // Handle manual formulation calculation
  const handleManualCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calcName.trim()) {
      setError("Please enter a product name for the manual evaluation.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setOfflineNotice(null);

    try {
      // Calculate grade purely based on the Nutri-Score derived local algorithm
      const calculated = calculateHealthScoreAndGrade({
        productName: calcName,
        calories: calcCalories || 0,
        totalFat: calcTotalFat || 0,
        saturatedFat: calcSatFat || 0,
        sugar: calcSugar || 0,
        sodium: calcSodium || 0,
        protein: calcProtein || 0,
        fiber: calcFiber || 0,
        ingredients: calcIngredients || "unspecified whole grains",
      });

      calculated.detectedFromImage = "manual";

      // Slight timeout simulation for polished feedback loop feel
      setTimeout(() => {
        setResult(calculated);
        appendToHistory(calculated);
        setOfflineNotice("Nutrition profile analyzed locally via the expert Nutri-Score formulation engine.");
        setIsLoading(false);

        // Fire leaf storm animation
        window.dispatchEvent(new CustomEvent("product-analyzed"));
      }, 500);
    } catch (err: any) {
      setError("Failed to calculate. Verify your values are valid numbers.");
      setIsLoading(false);
    }
  };

  // Camera upload of frames for Gemini or OCR evaluation
  const handleCameraImageCaptured = async (base64Image: string) => {
    setIsLoading(true);
    setError(null);
    setOfflineNotice(null);

    try {
      const response = await fetch("/api/analyze-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image, source: "camera" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to analyze image.");
      }

      setResult(data);
      if (data.notice) {
        setOfflineNotice(data.notice);
      } else {
        setOfflineNotice(null);
      }
      appendToHistory(data);
      window.dispatchEvent(new CustomEvent("product-analyzed"));
    } catch (err: any) {
      console.log("Image scanner notification:", err?.message || err);
      setError("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete individual item from history
  const handleDeleteHistoryItem = (id: string) => {
    const filtered = history.filter((item) => item.id !== id);
    saveHistory(filtered);
  };

  // Clear all history
  const handleClearHistory = () => {
    saveHistory([]);
  };

  // Load an item from history to view
  const handleLoadHistoryItem = (item: HistoryItem) => {
    const name = item.result?.productName || "";
    if (!name || name.toLowerCase().includes("unknown") || name.trim() === "") {
      setError("error");
      handleDeleteHistoryItem(item.id);
      return;
    }
    setResult(item.result);
    setOfflineNotice("Viewing cached lookup result from your local history scan log.");
  };

  // Helper to parse numerical values from string representations
  const parseNumValue = (val: string | undefined): number => {
    if (!val) return 0;
    const match = val.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  // Context-aware dynamic Health Advice Generator
  const getHealthAdvice = () => {
    if (history.length === 0) {
      return {
        type: "neutral",
        icon: "Sparkles",
        title: "Personalized Advisory System",
        text: "Your tailored Health Advice is warming up! Scan or manually build a few items to generate dynamic, food-additive conscious recommendations based on your habits.",
        bgColor: "bg-stone-55 border-stone-200/50",
        bgStyle: "bg-white/80 border-stone-200/60",
        iconColor: "text-emerald-700",
        accentBg: "bg-emerald-50"
      };
    }

    // Count metrics across history
    let highSugarScans = 0;
    let highSodiumScans = 0;
    let highSatFatScans = 0;
    let highAdditiveScans = 0;
    let healthyScans = 0; // Grade A or B

    history.forEach((item) => {
      const res = item.result;
      const sugarVal = parseNumValue(res.nutritionFacts?.sugar);
      const sodiumVal = parseNumValue(res.nutritionFacts?.sodium);
      const satFatVal = parseNumValue(res.nutritionFacts?.saturatedFat);
      
      // Check sugar
      if (sugarVal > 10) highSugarScans++;
      
      // Check sodium (mg)
      if (sodiumVal > 350) highSodiumScans++;
      
      // Check sat fat
      if (satFatVal > 4) highSatFatScans++;

      // Check additives / artificials by scanning negatives or ingredients list
      const lowerIngs = (res.ingredientsList || []).join(", ").toLowerCase();
      const hasArtificials = 
        lowerIngs.includes("artificial") || 
        lowerIngs.includes("blue ") || 
        lowerIngs.includes("red ") || 
        lowerIngs.includes("yellow ") || 
        (res.negatives || []).some(n => {
          const lowerN = n.toLowerCase();
          return lowerN.includes("artificial") || lowerN.includes("synthetic") || lowerN.includes("thickener") || lowerN.includes("sweetener") || lowerN.includes("e-number") || lowerN.includes("e1") || lowerN.includes("e2") || lowerN.includes("e3");
        });
      if (hasArtificials) {
        highAdditiveScans++;
      }

      if (res.grade === "A" || res.grade === "B") {
        healthyScans++;
      }
    });

    const total = history.length;
    const sugarPercent = highSugarScans / total;
    const sodiumPercent = highSodiumScans / total;
    const satFatPercent = highSatFatScans / total;
    const additivePercent = highAdditiveScans / total;
    const healthyPercent = healthyScans / total;

    // Prioritize advice based on intensity of scanned history
    if (sugarPercent >= 0.3) {
      return {
        type: "sugar",
        icon: "Apple",
        title: "Glycemic Impact Alert",
        text: "You've been scanning a lot of high-sugar items. High sugar density causes rapid blood glucose spikes and energy crashes; try swapping processed foods for fresh organic fruit.",
        bgStyle: "bg-amber-50/90 border-amber-200/50",
        iconColor: "text-amber-800",
        accentBg: "bg-amber-100/50"
      };
    }

    if (additivePercent >= 0.3) {
      return {
        type: "additive",
        icon: "ShieldAlert",
        title: "Additive Accumulation Warning",
        text: "A significant portion of your scans contain artificial flavors, synthetic colors, or industrial thickeners. These additives can harm gut integrity; try choosing whole-food alternatives.",
        bgStyle: "bg-rose-50/90 border-rose-200/50",
        iconColor: "text-rose-800",
        accentBg: "bg-rose-100/50"
      };
    }

    if (sodiumPercent >= 0.3) {
      return {
        type: "sodium",
        icon: "Heart",
        title: "Cardiovascular Pressure Advisory",
        text: "Your scanned products are frequently high in sodium. Elevated sodium intake is linked to cardiovascular strain; consider prioritizing fresh ingredients seasoned with natural herbs.",
        bgStyle: "bg-amber-50/90 border-amber-200/50",
        iconColor: "text-amber-800",
        accentBg: "bg-amber-100/50"
      };
    }

    if (satFatPercent >= 0.3) {
      return {
        type: "fat",
        icon: "Activity",
        title: "Lipid Profile Warning",
        text: "Several scanned items are high in saturated lipids or refined oils. For a healthier profile, try prioritizing sources rich in monounsaturated fats like avocados, seeds, and olive oil.",
        bgStyle: "bg-amber-50/90 border-amber-200/50",
        iconColor: "text-amber-800",
        accentBg: "bg-amber-100/50"
      };
    }

    if (healthyPercent >= 0.5) {
      return {
        type: "healthy",
        icon: "TrendingUp",
        title: "Outstanding Clean-Label Habits!",
        text: "Outstanding work! More than half of your scans are clean-label, high-grade foods. Keep prioritizing fiber, proteins, and minimally processed ingredients to feed a thriving microbiome.",
        bgStyle: "bg-emerald-50/90 border-emerald-200/50",
        iconColor: "text-emerald-800",
        accentBg: "bg-emerald-100/50"
      };
    }

    // Default balanced feedback
    return {
      type: "neutral",
      icon: "HeartHandshake",
      title: "Balanced Scanner Profile",
      text: "You are maintaining a diverse product scanning log. Keep evaluating ingredient cards closely and aim to replace items flagged with 'E-Numbers' or synthetic chemicals with whole food swaps.",
      bgStyle: "bg-white/90 border-stone-200/60 shadow-2xs",
      iconColor: "text-emerald-800",
      accentBg: "bg-emerald-50"
    };
  };

  const renderAdviceIcon = (iconName: string, colorClass: string) => {
    const cls = `w-5 h-5 ${colorClass} shrink-0`;
    switch (iconName) {
      case "Apple":
        return <Apple className={cls} />;
      case "ShieldAlert":
        return <ShieldAlert className={cls} />;
      case "Heart":
        return <Heart className={cls} />;
      case "Activity":
        return <Activity className={cls} />;
      case "TrendingUp":
        return <TrendingUp className={cls} />;
      case "Sparkles":
        return <Sparkles className={cls} />;
      default:
        return <HeartHandshake className={cls} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-emerald-50/15 to-stone-100 text-stone-800 relative font-sans flex flex-col selection:bg-emerald-100 selection:text-emerald-950">
      
      {/* Welcome Splash Screen Animation */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            key="welcome-splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
            className="fixed inset-0 bg-gradient-to-b from-stone-50 via-emerald-50/20 to-stone-100 flex flex-col items-center justify-center p-6 z-50 selection:bg-emerald-100 selection:text-emerald-950"
          >
            <div className="flex flex-col items-center text-center max-w-md w-full relative">
              <div className="absolute -top-16 -left-16 w-32 h-32 bg-emerald-200/30 rounded-full blur-2xl animate-pulse" />
              <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-teal-200/20 rounded-full blur-2xl animate-pulse delay-75" />

              {/* Shared Logo */}
              <motion.div 
                layoutId="app-logo"
                className="mb-6 drop-shadow-md"
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              >
                <AppLogo size={140} />
              </motion.div>

              {/* Shared Badge */}
              <motion.div 
                layoutId="app-badge"
                className="inline-flex items-center gap-2 bg-emerald-100/80 border border-emerald-200 px-4 py-2 rounded-full mb-4 shadow-sm"
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              >
                <Leaf className="w-4 h-4 text-emerald-800 animate-spin" style={{ animationDuration: "3s" }} />
                <span className="text-[11px] font-display font-extrabold tracking-widest text-emerald-900 uppercase">
                  NutriLens Premium Food Scanner
                </span>
                <span className="bg-emerald-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                  v2.0
                </span>
              </motion.div>

              {/* Shared Title */}
              <motion.h1 
                layoutId="app-title"
                className="text-3xl md:text-5xl font-display font-black tracking-tight text-stone-900 flex flex-wrap items-center justify-center gap-2 md:gap-3 leading-none"
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              >
                <span className="flex items-center gap-2">
                  <span>NutriLens</span>
                  <span className="bg-emerald-600 text-white font-mono text-xs font-bold px-2 py-0.5 rounded-full select-none shadow-xs">
                    2.0
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium text-lg md:text-xl">
                  <span className="text-stone-300 font-light select-none">|</span>
                  <span>by</span>
                  <img src="/zettacreations-logo.jpg" alt="ZettaCreations Logo" className="w-6 h-6 rounded-full object-cover shadow-xs border border-emerald-100" referrerPolicy="no-referrer" />
                  <span>ZettaCreations</span>
                </span>
              </motion.h1>

              {/* Shared Description */}
              <motion.p 
                layoutId="app-description"
                className="text-xs md:text-sm text-stone-500 mt-4 max-w-sm leading-relaxed"
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              >
                Instantly score food packaging parameters, analyze chemical additive profiles, scan nutrition labels, and screen toxicology lists with absolute precision.
              </motion.p>

              {/* Progress Loader */}
              <div className="mt-10 w-full max-w-[240px] flex flex-col items-center gap-3">
                <div className="w-full h-1.5 bg-stone-200/80 rounded-full overflow-hidden shadow-xs relative border border-stone-200/40">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, ease: [0.4, 0, 0.2, 1] }}
                    className="h-full bg-gradient-to-r from-emerald-600 to-teal-500"
                  />
                </div>

                <AnimatePresence mode="wait">
                  <motion.p 
                    key={loadingSub}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="text-[10px] font-mono text-emerald-700 font-semibold uppercase tracking-wider"
                  >
                    {loadingSub}
                  </motion.p>
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main Container */}
      <motion.div 
        className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 md:py-12 flex flex-col relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: showWelcome ? 0 : 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        
        {/* Elegant Minimal Header */}
        <header className="text-center mb-8 md:mb-10 flex flex-col items-center">
          <motion.div layoutId="app-logo" className="mb-4">
            <AppLogo size={96} />
          </motion.div>
          <motion.div layoutId="app-badge" className="inline-flex items-center gap-2 bg-emerald-50/90 border border-emerald-100 px-3.5 py-1.5 rounded-full mb-3 shadow-2xs">
            <Leaf className="w-4 h-4 text-emerald-700 animate-pulse" />
            <span className="text-[10px] font-display font-extrabold tracking-widest text-emerald-800 uppercase">
              NutriLens Premium Food Scanner
            </span>
            <span className="bg-emerald-600 text-white font-mono text-[8px] font-bold px-1.5 py-0.5 rounded-full ml-1">
              v2.0
            </span>
          </motion.div>
          <motion.h1 layoutId="app-title" className="text-2xl md:text-4xl font-display font-black tracking-tight text-stone-900 flex flex-wrap items-center justify-center gap-2 leading-none">
            <span className="flex items-center gap-1.5">
              <span>NutriLens</span>
              <span className="bg-emerald-600 text-white font-mono text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded-full select-none shadow-xs">
                2.0
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium text-base md:text-lg">
              <span className="text-stone-300 font-light select-none">|</span>
              <span>by</span>
              <img src="/zettacreations-logo.jpg" alt="ZettaCreations Logo" className="w-5 h-5 rounded-full object-cover shadow-xs border border-emerald-100" referrerPolicy="no-referrer" />
              <span>ZettaCreations</span>
            </span>
          </motion.h1>
          <motion.p layoutId="app-description" className="text-xs md:text-sm text-stone-500 mt-3 max-w-md mx-auto leading-relaxed">
            Instantly score food packaging parameters, analyze chemical additive profiles, scan nutrition labels, and screen toxicology lists with absolute precision.
          </motion.p>
        </header>

        {/* Dynamic Screen Area */}
        <main className="flex-1 flex flex-col justify-center">
          
          <AnimatePresence mode="wait">
            
            {result ? (
              /* DETAILED ASSESSMENT DISPLAY VIEW */
              <motion.div
                key="details"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                {offlineNotice && (
                  <div className="max-w-2xl mx-auto mb-4 bg-emerald-50/70 border border-emerald-100/50 text-emerald-800 p-2.5 rounded-xl text-[10px] font-medium flex items-center gap-2 justify-center backdrop-blur-xs">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>{offlineNotice}</span>
                  </div>
                )}
                <AnalysisDetails 
                  result={result} 
                  onBack={() => setResult(null)} 
                  onUpdateResult={(updated) => {
                    setResult(updated);
                    if (updated.notice) {
                      setOfflineNotice(updated.notice);
                    }
                    // Update the item in local history if it matches
                    const updatedHistory = history.map((item) => {
                      if (item.result.barcode && item.result.barcode === updated.barcode) {
                        return { ...item, result: updated };
                      }
                      return item;
                    });
                    saveHistory(updatedHistory);
                  }}
                />
              </motion.div>
            ) : (
              /* ACTIVE FORM / SCANNER CONSOLE TABS */
              <motion.div
                key="console"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 w-full"
              >
                
                {/* Visual Tab Selection bar */}
                <div className="flex bg-stone-100/80 backdrop-blur-md p-1 rounded-2xl max-w-xl mx-auto border border-stone-200/50 shadow-2xs relative z-10">
                  <button
                    onClick={() => {
                      setActiveTab("scan");
                      setError(null);
                    }}
                    className={`relative flex-1 py-2.5 rounded-xl text-xs font-bold font-display transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTab === "scan"
                        ? "text-emerald-900"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {activeTab === "scan" && (
                      <motion.div
                        layoutId="activeTabBackground"
                        className="absolute inset-0 bg-white rounded-xl shadow-xs"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5" />
                      Quick Scan
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("calculator");
                      setError(null);
                    }}
                    className={`relative flex-1 py-2.5 rounded-xl text-xs font-bold font-display transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTab === "calculator"
                        ? "text-emerald-900"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {activeTab === "calculator" && (
                      <motion.div
                        layoutId="activeTabBackground"
                        className="absolute inset-0 bg-white rounded-xl shadow-xs"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5" />
                      Manual Builder
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("ingredients");
                      setError(null);
                    }}
                    className={`relative flex-1 py-2.5 rounded-xl text-xs font-bold font-display transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTab === "ingredients"
                        ? "text-emerald-900"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {activeTab === "ingredients" && (
                      <motion.div
                        layoutId="activeTabBackground"
                        className="absolute inset-0 bg-white rounded-xl shadow-xs"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Ingredients
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("fake");
                      setError(null);
                    }}
                    className={`relative flex-1 py-2.5 rounded-xl text-xs font-bold font-display transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTab === "fake"
                        ? "text-emerald-900"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {activeTab === "fake" && (
                      <motion.div
                        layoutId="activeTabBackground"
                        className="absolute inset-0 bg-white rounded-xl shadow-xs"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                      Fake Finder
                    </span>
                  </button>
                </div>

                {/* Main Error Indicator */}
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="bg-rose-50/90 backdrop-blur-md border border-rose-100 text-rose-800 p-4 rounded-xl text-xs max-w-xl mx-auto flex gap-3 shadow-3xs items-center justify-center"
                  >
                    {error === "error" ? (
                      <span className="font-mono font-black tracking-widest text-rose-700 uppercase py-1">error</span>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="font-bold">Lookup Unsuccessful</h5>
                          <p className="mt-1 leading-relaxed font-normal text-rose-700/95">{error}</p>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

                {/* Main Tab Content with AnimatePresence */}
                <div className="relative overflow-visible w-full mt-6">
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.div
                        key="loading-spinner"
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white/80 backdrop-blur-md border border-stone-200/80 rounded-2xl p-12 text-center max-w-md mx-auto shadow-lg relative z-10 space-y-4"
                      >
                        <div className="relative w-16 h-16 mx-auto">
                          <div className="absolute inset-0 rounded-full border-4 border-stone-100" />
                          <div className="absolute inset-0 rounded-full border-4 border-emerald-700 border-t-transparent animate-spin" />
                          <Leaf className="w-6 h-6 text-emerald-700 absolute inset-0 m-auto animate-pulse" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-stone-800">Evaluating Food Formulation...</h4>
                          <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
                            Scanning database repositories and processing ingredients profile against the global additive warning matrix.
                          </p>
                        </div>
                      </motion.div>
                    ) : activeTab === "scan" ? (
                      <motion.div
                        key="tab-scan"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="space-y-6"
                      >
                        {/* Live Camera Scanner Container */}
                        <div className="w-full max-w-2xl mx-auto relative z-10 overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
                          <div className="mb-3 px-1 flex items-center justify-between">
                            <div>
                              <h3 className="text-xs font-semibold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5 text-emerald-800" />
                                Live Camera Scanner
                              </h3>
                              <p className="text-[10px] text-stone-400 mt-0.5">
                                Align the food packaging barcode inside the frame to scan automatically.
                              </p>
                            </div>
                          </div>
                          
                          <CameraScanner
                            onScanSuccess={(code) => handleBarcodeLookup(code)}
                            onImageCaptured={handleCameraImageCaptured}
                            showCloseButton={false}
                          />
                        </div>

                        {/* Inline Barcode Search Console */}
                        <div className="bg-white/85 backdrop-blur-md border border-stone-200/80 rounded-2xl p-6 max-w-xl mx-auto shadow-sm shadow-stone-100/50 relative z-10 space-y-4">
                          <div>
                            <h3 className="text-xs font-semibold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                              <Search className="w-3.5 h-3.5 text-emerald-800" />
                              Manual Barcode Lookup
                            </h3>
                            <p className="text-[10px] text-stone-400 mt-0.5">
                              Or type the numbers under the barcode lines if you prefer.
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                placeholder="e.g. 030000010202, 028400070560..."
                                value={barcodeInput}
                                onChange={(e) => setBarcodeInput(e.target.value.replace(/\D/g, ""))}
                                onKeyDown={(e) => e.key === "Enter" && handleBarcodeLookup(barcodeInput)}
                                className="w-full bg-stone-50/50 border border-stone-200 rounded-xl py-3 pl-4 pr-10 text-xs focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 outline-none transition font-semibold"
                              />
                              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                <span className="font-mono text-[9px] text-stone-400 font-bold bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                                  NUMBERS
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleBarcodeLookup(barcodeInput)}
                              disabled={!barcodeInput.trim()}
                              className="bg-emerald-800 hover:bg-emerald-900 active:scale-98 transition text-white px-5 py-3 rounded-xl font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <Search className="w-3.5 h-3.5" />
                              Lookup Item
                            </button>
                          </div>
                        </div>

                        {/* Demo Barcodes Quick Selection */}
                        <DemoBarcodes onSelectBarcode={handleDemoSelect} isLoading={isLoading} />
                      </motion.div>
                    ) : activeTab === "calculator" ? (
                      <motion.div
                        key="tab-calculator"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="bg-white/85 backdrop-blur-md border border-stone-200/80 rounded-2xl p-6 max-w-2xl mx-auto shadow-sm shadow-stone-100/50 relative z-10"
                      >
                        <div className="mb-5">
                          <h3 className="text-xs font-semibold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Calculator className="w-4 h-4 text-emerald-800" />
                            Manual Nutrition Builder
                          </h3>
                          <p className="text-[10px] text-stone-400 mt-0.5">
                            Don't have a database-listed product? Formulate the exact values from the back-of-pack nutrition facts table to run a simulation.
                          </p>
                        </div>

                        <form onSubmit={handleManualCalculate} className="space-y-4">
                          
                          {/* Product Name */}
                          <div>
                            <label className="block text-[11px] font-bold text-stone-600 mb-1">
                              Product Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Organic Blueberry Greek Yogurt"
                              value={calcName}
                              onChange={(e) => setCalcName(e.target.value)}
                              className="w-full bg-stone-50/50 border border-stone-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-700/10 focus:border-emerald-700 outline-none transition font-semibold"
                            />
                          </div>

                          {/* Numbers Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                            
                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1 truncate">
                                Calories (kcal)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 150"
                                value={calcCalories}
                                onChange={(e) => setCalcCalories(e.target.value.replace(/[^\d.]/g, ""))}
                                className="w-full bg-stone-50/50 border border-stone-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-700/10 focus:border-emerald-700 outline-none transition font-mono font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1 truncate">
                                Total Fat (g)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 3.5"
                                value={calcTotalFat}
                                onChange={(e) => setCalcTotalFat(e.target.value.replace(/[^\d.]/g, ""))}
                                className="w-full bg-stone-50/50 border border-stone-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-700/10 focus:border-emerald-700 outline-none transition font-mono font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1 truncate">
                                Saturated Fat (g)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 0.5"
                                value={calcSatFat}
                                onChange={(e) => setCalcSatFat(e.target.value.replace(/[^\d.]/g, ""))}
                                className="w-full bg-stone-50/50 border border-stone-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-700/10 focus:border-emerald-700 outline-none transition font-mono font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1 truncate">
                                Sugars (g)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 12"
                                value={calcSugar}
                                onChange={(e) => setCalcSugar(e.target.value.replace(/[^\d.]/g, ""))}
                                className="w-full bg-stone-50/50 border border-stone-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-700/10 focus:border-emerald-700 outline-none transition font-mono font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1 truncate">
                                Sodium (mg)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 45"
                                value={calcSodium}
                                onChange={(e) => setCalcSodium(e.target.value.replace(/[^\d.]/g, ""))}
                                className="w-full bg-stone-50/50 border border-stone-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-700/10 focus:border-emerald-700 outline-none transition font-mono font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1 truncate">
                                Protein (g)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 6.4"
                                value={calcProtein}
                                onChange={(e) => setCalcProtein(e.target.value.replace(/[^\d.]/g, ""))}
                                className="w-full bg-stone-50/50 border border-stone-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-700/10 focus:border-emerald-700 outline-none transition font-mono font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 mb-1 truncate">
                                Dietary Fiber (g)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 3.0"
                                value={calcFiber}
                                onChange={(e) => setCalcFiber(e.target.value.replace(/[^\d.]/g, ""))}
                                className="w-full bg-stone-50/50 border border-stone-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-700/10 focus:border-emerald-700 outline-none transition font-mono font-bold"
                              />
                            </div>

                            <div className="flex flex-col justify-end">
                              <span className="text-[9px] text-stone-400 leading-tight mb-2 italic">
                                * Values are typically calculated per serving size.
                              </span>
                            </div>

                          </div>

                          {/* Ingredients list */}
                          <div>
                            <label className="block text-[11px] font-bold text-stone-600 mb-1">
                              Ingredients List
                            </label>
                            <textarea
                              placeholder="e.g. Sprouted whole oats, organic chia seeds, blueberries, sea salt, soy lecithin..."
                              value={calcIngredients}
                              onChange={(e) => setCalcIngredients(e.target.value)}
                              rows={3}
                              className="w-full bg-stone-50/50 border border-stone-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-700/10 focus:border-emerald-700 outline-none transition font-semibold resize-none"
                            />
                            <p className="text-[9px] text-stone-400 mt-1 leading-normal">
                              Separate ingredients with commas. The algorithm scans this text to detect positive whole foods or additive red flags.
                            </p>
                          </div>

                          {/* Submit */}
                          <button
                            type="submit"
                            className="w-full bg-emerald-800 hover:bg-emerald-900 active:scale-[0.99] transition text-white font-bold text-xs py-3.5 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-2"
                            id="btn-calculate-manual"
                          >
                            <Plus className="w-4 h-4" />
                            Calculate Nutrition Grade
                          </button>
                        </form>
                      </motion.div>
                    ) : activeTab === "ingredients" ? (
                      <motion.div
                        key="tab-ingredients"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="w-full"
                      >
                        <IngredientsScanner />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="tab-fake"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="w-full"
                      >
                        <FakeProductGuide />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Health Advisory & Scan History Section */}
                <div className="max-w-xl mx-auto w-full pt-6 space-y-6">
                  
                  {/* Dynamic Health Tip Banner */}
                  {(() => {
                    const advice = getHealthAdvice();
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`p-4 rounded-2xl border flex gap-3.5 items-start ${advice.bgStyle}`}
                      >
                        <div className={`p-2.5 rounded-xl ${advice.accentBg} flex items-center justify-center shrink-0 shadow-2xs`}>
                          {renderAdviceIcon(advice.icon, advice.iconColor)}
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-stone-800 tracking-tight flex items-center gap-1.5">
                            {advice.title}
                          </h4>
                          <p className="text-[11px] leading-relaxed text-stone-500 font-medium">
                            {advice.text}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })()}

                  {/* History Logs Panel */}
                  <div className="border-t border-stone-200/50 pt-6">
                    <BarcodeHistory
                      history={history}
                      onSelectItem={handleLoadHistoryItem}
                      onDeleteItem={handleDeleteHistoryItem}
                      onClearAll={handleClearHistory}
                    />
                  </div>

                </div>

              </motion.div>
            )}

          </AnimatePresence>

        </main>

        {/* Humid Footer details */}
        <footer className="mt-16 text-center text-[10px] text-stone-400/80 select-none relative z-10 border-t border-stone-200/40 pt-4">
          <p>© {new Date().getFullYear()} NutriLens. All rights reserved.</p>
          <p className="mt-1">
            Precision health & toxicological evaluation powered by NutriLens AI and scientific ingredients analysis.
          </p>
        </footer>

      </motion.div>
    </div>
  );
}
