import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Camera, 
  Upload, 
  X, 
  FileText, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  ThumbsUp, 
  ThumbsDown, 
  Info, 
  ShieldAlert, 
  ArrowLeft, 
  AlertTriangle, 
  Heart, 
  RefreshCw,
  Search,
  ScanLine
} from "lucide-react";
import RadialGauge from "./RadialGauge";
import { API_BASE } from "../App";

export default function IngredientsScanner() {
  const [ingredientsText, setIngredientsText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  // Camera capture states
  const [showCamera, setShowCamera] = useState(true);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File drag & drop states
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera helper
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setCameraLoading(false);
    setCameraError(null);
  };

  // Start camera helper
  const startCamera = () => {
    setShowCamera(true);
  };

  // Flip camera helper
  const flipCamera = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  // Effect to restart camera when facingMode or showCamera changes
  useEffect(() => {
    let isCurrent = true;

    const runStart = async () => {
      if (showCamera) {
        setCameraLoading(true);
        setCameraError(null);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        try {
          const constraints = {
            video: {
              facingMode: facingMode,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          
          if (!isCurrent) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute("playsinline", "true");
            try {
              await videoRef.current.play();
            } catch (playErr: any) {
              if (playErr.name !== "AbortError") {
                console.warn("Play interrupted or failed:", playErr);
              }
            }
          }
          setCameraLoading(false);
        } catch (err: any) {
          if (!isCurrent) return;
          console.warn("Camera access failed:", err);
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            setCameraError("Camera permission denied. Please click the camera/lock icon in your browser address bar, grant permission, and try again, or use the photo upload option instead.");
          } else {
            setCameraError(`Could not access camera: ${err.message || "Please grant camera permissions or select a photo of the ingredients list instead."}`);
          }
          setCameraLoading(false);
        }
      }
    };

    runStart();

    return () => {
      isCurrent = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, showCamera]);

  // Capture photo from stream
  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.85);
        stopCamera();
        analyzeIngredients(null, base64);
      }
    } catch (err) {
      console.warn("Failed to capture photo:", err);
      setError("Failed to capture picture. Please try pasting the list or uploading a saved picture.");
    }
  };

  // Drag and Drop helpers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG or JPEG) containing the ingredients packaging.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      analyzeIngredients(null, base64);
    };
    reader.onerror = () => {
      setError("Failed to read image file. Please try pasting the text list directly.");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Main Ingredients Analyzer API Request
  const analyzeIngredients = async (text: string | null, base64Image: string | null = null) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    const payloadText = text || ingredientsText;

    if (!payloadText && !base64Image) {
      setError("Please paste an ingredients list or upload a packaging snapshot to analyze!");
      setIsAnalyzing(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/analyze-ingredients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ingredients: base64Image ? null : payloadText,
          image: base64Image,
        }),
      });

      if (!response.ok) {
        let errorMessage = `Analysis failed with status ${response.status}`;
        try {
          const errData = await response.json();
          errorMessage = errData.message || errData.error || errorMessage;
        } catch (e) {
          if (response.status === 405 || response.status === 404) {
            errorMessage = `Backend API returned status ${response.status}. Since you are deployed on Cloudflare Pages, make sure you have added the VITE_API_BASE_URL environment variable in your Cloudflare settings pointing to your live backend server.`;
          } else {
            errorMessage = `Server error (status ${response.status}).`;
          }
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error(`Failed to parse backend response as JSON. Ensure your VITE_API_BASE_URL points to the correct backend endpoint and not a static HTML page.`);
      }

      setResult(data);
      if (data.ingredients) {
        setIngredientsText(data.ingredients);
      }
    } catch (err: any) {
      console.warn("Ingredients analysis API error:", err);
      setError(err.message || "An unexpected network error occurred. Please verify your connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Quick reset
  const handleBack = () => {
    setResult(null);
    setError(null);
    setIngredientsText("");
  };

  // Helper colors for health level
  const getRatingTheme = (rating: string) => {
    switch (rating?.toLowerCase()) {
      case "good":
        return {
          bg: "bg-emerald-50 border-emerald-200/50 text-emerald-800",
          badge: "bg-emerald-600 text-white",
          accentText: "text-emerald-700",
          icon: <Heart className="w-5 h-5 text-emerald-600 fill-emerald-600" />,
        };
      case "moderate":
        return {
          bg: "bg-amber-50 border-amber-200/50 text-amber-800",
          badge: "bg-amber-500 text-white",
          accentText: "text-amber-700",
          icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
        };
      case "avoid":
      default:
        return {
          bg: "bg-rose-50 border-rose-200/50 text-rose-800",
          badge: "bg-rose-600 text-white",
          accentText: "text-rose-700",
          icon: <ShieldAlert className="w-5 h-5 text-rose-600" />,
        };
    }
  };

  const ratingTheme = getRatingTheme(result?.rating || "moderate");

  return (
    <div id="ingredients-scanner-root" className="max-w-2xl mx-auto w-full px-4 py-2">
      <AnimatePresence mode="wait">
        {!result ? (
          /* SCANNING AND PASTING INPUT VIEW */
          <motion.div
            key="input-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white/80 backdrop-blur-md rounded-3xl border border-stone-200/50 shadow-lg p-6 space-y-6 relative overflow-hidden"
          >
            {/* Header branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-200/40">
                <ScanLine className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold font-display text-stone-900 flex items-center gap-2">
                  Chemical & Additive Analyzer
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-sans font-medium uppercase tracking-wide">
                    Gemini AI Vision
                  </span>
                </h2>
                <p className="text-xs text-stone-500">
                  Scan ingredients on packaging or paste plain-text ingredient lists to screen for hazardous food additives.
                </p>
              </div>
            </div>

            {/* ERROR NOTIFIER */}
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 text-xs flex gap-3 shadow-3xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB INTERFACES: TEXT PASTE OR UPLOAD/CAMERA */}
            {!showCamera ? (
              <div className="space-y-4">
                {/* 1. TEXT INPUT FORM */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-stone-600 flex items-center justify-between">
                    <span>Paste Ingredients Text</span>
                    <span className="text-[10px] text-stone-400 font-normal">Separate with commas</span>
                  </label>
                  <div className="relative">
                    <textarea
                      value={ingredientsText}
                      onChange={(e) => setIngredientsText(e.target.value)}
                      placeholder="Sugar, Bleached Flour, Hydrogenated Palm Fat, Emulsifiers (E471, E435), Artificial Caramel Flavor, Sodium Benzoate..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-2xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-600 text-xs text-stone-800 font-sans leading-relaxed shadow-inner-sm transition-all"
                    />
                    {ingredientsText && (
                      <button
                        onClick={() => setIngredientsText("")}
                        className="absolute right-3 top-3 p-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 cursor-pointer transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Preview / Quick Try Ingredients Presets */}
                <div className="space-y-2 bg-stone-50/50 p-3 rounded-2xl border border-stone-200/50">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                    Quick Try Previews
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        label: "🥤 Fizzy Soda (High Risk)",
                        text: "Carbonated Water, High Fructose Corn Syrup, Caramel Color (E150d), Phosphoric Acid, Caffeine, Natural Flavors."
                      },
                      {
                        label: "🍿 Processed Chips (Moderate)",
                        text: "Potatoes, Palm Oil, Salt, Monosodium Glutamate (E621), Maltodextrin, Yeast Extract, Artificial Cheese Flavor, Yellow 5 (E102)."
                      },
                      {
                        label: "🥣 Organic Oats (Clean/Good)",
                        text: "Organic Whole Grain Rolled Oats, Organic Chia Seeds, Organic Ground Flaxseed, Organic Ceylon Cinnamon."
                      }
                    ].map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setIngredientsText(preset.text);
                          analyzeIngredients(preset.text);
                        }}
                        className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border border-stone-200 rounded-xl text-[10px] font-bold text-stone-600 transition-all cursor-pointer shadow-3xs hover:shadow-2xs active:scale-95"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider Line */}
                <div className="flex items-center my-4 text-stone-300">
                  <div className="flex-1 border-t border-stone-200/60"></div>
                  <span className="px-3 text-[10px] uppercase font-bold tracking-widest text-stone-400">OR SCAN PACKAGING</span>
                  <div className="flex-1 border-t border-stone-200/60"></div>
                </div>

                {/* 2. SNAPSHOT & CAMERA SELECTION */}
                <div className="grid grid-cols-2 gap-3">
                  {/* File Drag and Drop / Choose File */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
                      dragActive 
                        ? "border-emerald-500 bg-emerald-50/50" 
                        : "border-stone-200 bg-stone-50/30 hover:bg-stone-50 hover:border-stone-300"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <div className="p-2.5 bg-stone-100/80 rounded-xl text-stone-600">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold text-stone-700">Drop package photo</p>
                      <p className="text-[9px] text-stone-400 mt-0.5">Click to browse file</p>
                    </div>
                  </div>

                  {/* Start camera view */}
                  <button
                    onClick={startCamera}
                    type="button"
                    className="border-2 border-stone-150 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-stone-50 hover:border-stone-300 cursor-pointer transition-all duration-200"
                  >
                    <div className="p-2.5 bg-stone-100/80 rounded-xl text-stone-600">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold text-stone-700">Use Live Camera</p>
                      <p className="text-[9px] text-stone-400 mt-0.5">Align packaging and snapshot</p>
                    </div>
                  </button>
                </div>

                {/* ACTION SUBMIT BUTTON */}
                <button
                  disabled={isAnalyzing || (!ingredientsText.trim())}
                  onClick={() => analyzeIngredients(null)}
                  className={`w-full py-3.5 rounded-2xl font-bold font-display text-xs text-center flex items-center justify-center gap-2 shadow-xs transition-all ${
                    ingredientsText.trim() && !isAnalyzing
                      ? "bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-750 text-white cursor-pointer active:scale-[0.99]"
                      : "bg-stone-100 text-stone-400 cursor-not-allowed"
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Deconstructuring Ingredients...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Screen Health Score
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* ACTIVE CAMERA PREVIEW MODE */
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-black border border-stone-800 shadow-inner h-64 flex items-center justify-center">
                  {cameraLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-950 text-stone-400 z-10">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                      <span className="text-xs font-mono font-medium tracking-wide">Starting live vision matrix...</span>
                    </div>
                  ) : null}

                  {cameraError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-900 text-stone-400 p-6 text-center z-10">
                      <AlertTriangle className="w-8 h-8 text-rose-500" />
                      <p className="text-xs font-medium text-stone-300 leading-relaxed">{cameraError}</p>
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            stopCamera();
                            fileInputRef.current?.click();
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-[10px] font-bold rounded-xl cursor-pointer shadow-md hover:brightness-110 active:scale-95 transition"
                        >
                          Upload / Snap Photo
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-4 py-2 bg-stone-800 hover:bg-stone-750 text-white text-[10px] font-bold rounded-xl cursor-pointer border border-stone-700"
                        >
                          Go Back
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <video
                    ref={videoRef}
                    playsInline
                    className="w-full h-full object-cover"
                  />

                  {/* Scanning overlay frame */}
                  <div className="absolute inset-0 border-[3px] border-emerald-500/20 pointer-events-none">
                    <div className="absolute inset-x-8 top-1/4 bottom-1/4 border-2 border-dashed border-emerald-400/60 rounded-xl flex items-center justify-center">
                      <div className="text-[10px] font-mono text-emerald-400 font-bold bg-stone-950/80 backdrop-blur-md px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                        Ingredients Section Focus
                      </div>
                    </div>
                  </div>

                  {/* Top-right close button */}
                  <button
                    onClick={stopCamera}
                    className="absolute top-3 right-3 p-2 bg-stone-900/80 backdrop-blur-md text-stone-300 hover:text-white rounded-full cursor-pointer z-20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Camera control buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={flipCamera}
                    className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold font-display text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Flip Lens
                  </button>
                  <button
                    onClick={capturePhoto}
                    disabled={cameraLoading}
                    className="flex-[2] py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold font-display text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99] transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    Snap Ingredient list
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* ANALYSIS REPORT DISPLAY DASHBOARD */
          <motion.div
            key="analysis-report"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Header / Back Action Bar */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-3xs transition-all active:scale-95"
              >
                <ArrowLeft className="w-4 h-4 text-stone-600" />
                Analyze New Product
              </button>
              {result.productName && (
                <span className="text-[10px] font-mono bg-stone-100 text-stone-500 border border-stone-200 px-2.5 py-1 rounded-full truncate max-w-xs">
                  {result.productName}
                </span>
              )}
            </div>

            {/* Main Scorecard Banner Card */}
            <div className="bg-white rounded-3xl border border-stone-200/50 shadow-md p-6 relative overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Gauge visualization (4 cols) */}
                <div className="md:col-span-4 flex justify-center">
                  <RadialGauge score={result.score} grade={result.rating === "Good" ? "A" : result.rating === "Moderate" ? "C" : "E"} />
                </div>

                {/* Score breakdown description (8 cols) */}
                <div className="md:col-span-8 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full ${ratingTheme.badge}`}>
                      {result.rating} Profile
                    </span>
                    {ratingTheme.icon}
                  </div>
                  <h3 className="text-sm font-extrabold text-stone-900 font-display">
                    Toxicological Summary
                  </h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {result.summary}
                  </p>
                </div>
              </div>

              {/* Specific Allergens Indicator Banner */}
              {result.allergens && result.allergens.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200/50 rounded-2xl flex items-center gap-2 text-[11px] font-medium text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    <strong>Allergy Alert:</strong> Contains {result.allergens.join(", ")}
                  </span>
                </div>
              )}
            </div>

            {/* Dual column: Positives & Negatives lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Positives Card */}
              <div className="bg-white rounded-3xl border border-stone-200/50 shadow-sm p-5 space-y-3">
                <h4 className="text-xs font-bold text-stone-800 font-display flex items-center gap-2 pb-1.5 border-b border-stone-100">
                  <ThumbsUp className="w-4 h-4 text-emerald-600" />
                  Wholesome Attributes
                </h4>
                <ul className="space-y-2">
                  {result.positives && result.positives.map((pos: string, idx: number) => (
                    <li key={idx} className="text-xs text-stone-600 flex gap-2 items-start leading-snug">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{pos}</span>
                    </li>
                  ))}
                  {(!result.positives || result.positives.length === 0) && (
                    <li className="text-xs text-stone-400 italic">No wholesome attributes detected.</li>
                  )}
                </ul>
              </div>

              {/* Negatives Card */}
              <div className="bg-white rounded-3xl border border-stone-200/50 shadow-sm p-5 space-y-3">
                <h4 className="text-xs font-bold text-stone-800 font-display flex items-center gap-2 pb-1.5 border-b border-stone-100">
                  <ThumbsDown className="w-4 h-4 text-rose-500" />
                  Flagged Elements
                </h4>
                <ul className="space-y-2">
                  {result.negatives && result.negatives.map((neg: string, idx: number) => (
                    <li key={idx} className="text-xs text-stone-600 flex gap-2 items-start leading-snug">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span>{neg}</span>
                    </li>
                  ))}
                  {(!result.negatives || result.negatives.length === 0) && (
                    <li className="text-xs text-stone-500 italic flex gap-2 items-center">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Clean label with no high-risk compounds.
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Additives Details Screen Section */}
            {result.additives && result.additives.length > 0 && (
              <div className="bg-white rounded-3xl border border-stone-200/50 shadow-sm p-5 space-y-3">
                <h4 className="text-xs font-bold text-stone-800 font-display flex items-center gap-2 pb-1.5 border-b border-stone-100">
                  <Info className="w-4 h-4 text-blue-600" />
                  Chemical Additives Profile ({result.additives.length})
                </h4>
                <div className="divide-y divide-stone-100">
                  {result.additives.map((add: any, idx: number) => (
                    <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-800 font-sans">{add.name}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          add.risk === "High"
                            ? "bg-rose-50 border border-rose-100 text-rose-700"
                            : add.risk === "Moderate"
                            ? "bg-amber-50 border border-amber-100 text-amber-700"
                            : "bg-emerald-50 border border-emerald-100 text-emerald-700"
                        }`}>
                          {add.risk} Risk
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-relaxed font-sans">{add.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transcribed Raw Text Card */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-stone-200/50 p-4 shadow-3xs">
              <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400 block mb-1.5">Parsed Ingredients Text</span>
              <p className="text-[11px] text-stone-500 italic font-mono leading-relaxed truncate hover:text-stone-700 hover:whitespace-normal cursor-pointer transition-all">
                {result.ingredients}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
