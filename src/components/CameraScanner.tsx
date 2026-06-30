import React, { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";

interface CameraScannerProps {
  onScanSuccess: (barcode: string) => void;
  onImageCaptured: (base64Image: string) => void;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export default function CameraScanner({ 
  onScanSuccess, 
  onImageCaptured, 
  onClose,
  showCloseButton = true 
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detectorSupported, setDetectorSupported] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [retryKey, setRetryKey] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        onImageCaptured(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Check for native BarcodeDetector support
  useEffect(() => {
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      setDetectorSupported(true);
    }
  }, []);

  // Initialize Camera Stream and manage lifetime
  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      setLoading(true);
      setError(null);
      
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera permission denied or camera access is blocked in this context. Please ensure you have enabled camera access in your browser or try launching the app in a new tab.");
        }

        const constraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!active) {
          // If unmounted while requested, immediately clean up stream
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true"); // Required for iOS
          
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((playErr) => {
              if (playErr.name === "AbortError") {
                console.log("Camera play request was safely interrupted/superseded by another stream load.");
              } else {
                console.warn("Video play warning:", playErr);
              }
            });
          }
        }
        setLoading(false);
      } catch (err: any) {
        if (!active) return;
        console.warn("Camera access alert:", err);
        const errMsg = err?.message || "";
        const errName = err?.name || "";
        const isPermission = 
          errName === "NotAllowedError" || 
          errName === "PermissionDeniedError" || 
          errMsg.toLowerCase().includes("permission") || 
          errMsg.toLowerCase().includes("denied") ||
          errName.toLowerCase().includes("permission") ||
          errName.toLowerCase().includes("denied");

        if (isPermission) {
          setError("Camera permission denied. Please allow camera access in your browser settings to scan barcodes.");
        } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
          setError("No video recording device found. Please verify your camera is connected.");
        } else {
          setError(`Failed to open camera: ${err.message || "Unknown error"}`);
        }
        setLoading(false);
      }
    };

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, retryKey]);

  // Barcode Detection Loop (Native browser API)
  useEffect(() => {
    if (!detectorSupported || loading || error || !scanning || !videoRef.current) return;

    let active = true;
    let detector: any;

    try {
      // Initialize detector for popular barcode formats
      detector = new (window as any).BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
      });
    } catch (e) {
      console.warn("Failed to initialize BarcodeDetector:", e);
      return;
    }

    const checkFrame = async () => {
      if (!active || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        if (active) requestAnimationFrame(checkFrame);
        return;
      }

      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0 && active) {
          const detectedBarcode = barcodes[0].rawValue;
          console.log("Barcode detected natively:", detectedBarcode);
          
          // Play success sound
          playBeep();
          
          setScanning(false);
          onScanSuccess(detectedBarcode);
          active = false;
          return;
        }
      } catch (err) {
        // Silently catch detection frame failures (e.g. frame empty)
      }

      if (active) {
        // Limit checks slightly to conserve CPU
        setTimeout(() => {
          if (active) requestAnimationFrame(checkFrame);
        }, 150);
      }
    };

    requestAnimationFrame(checkFrame);

    return () => {
      active = false;
    };
  }, [detectorSupported, loading, error, scanning]);

  // Audio feedback for successful native scanning
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      // Audio context might be blocked or unsupported
    }
  };

  // Capture current frame as base64 for Gemini vision fallback
  const handleCaptureFrame = () => {
    if (!videoRef.current) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL("image/jpeg", 0.85);
        onImageCaptured(base64Image);
      }
    } catch (err) {
      console.warn("Failed to capture video frame:", err);
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden aspect-video md:aspect-[16/10] w-full shadow-2xl border-4 border-emerald-500/20 max-w-2xl mx-auto">
      {/* Video stream */}
      {!error && (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
        />
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="absolute inset-0 bg-neutral-900 flex flex-col items-center justify-center text-white space-y-4">
          <RefreshCw className="w-10 h-10 animate-spin text-emerald-500" />
          <p className="text-sm font-medium tracking-wide">Starting camera feed...</p>
        </div>
      )}

      {/* Hidden file input for native capture/gallery upload fallback */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 bg-neutral-900/95 flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
          <h4 className="text-lg font-semibold text-neutral-100">Camera Access Issue</h4>
          <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
            {error}
            <br />
            <span className="text-[11px] text-emerald-400 font-medium block mt-1.5">
              💡 Tip: Since this app runs inside a preview iframe, you can use the button below to upload/take a photo natively, or open the app in a new window.
            </span>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full max-w-xs sm:max-w-md justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 transition text-white text-xs px-4 py-2.5 rounded-lg font-medium shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Upload / Snap Packaging Photo
            </button>
            <button
              onClick={() => setRetryKey((prev) => prev + 1)}
              className="bg-neutral-800 hover:bg-neutral-750 active:scale-95 transition text-neutral-300 text-xs px-4 py-2.5 rounded-lg font-medium border border-neutral-700 cursor-pointer"
            >
              Try Again
            </button>
            {showCloseButton && onClose && (
              <button
                onClick={onClose}
                className="bg-neutral-800 hover:bg-neutral-700 active:scale-95 transition text-white text-xs px-4 py-2.5 rounded-lg font-medium border border-neutral-700 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Scanner Guides */}
      {!loading && !error && (
        <>
          {/* Laser animated line */}
          <div className="absolute left-[15%] right-[15%] h-[2px] bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse pointer-events-none top-1/2 -translate-y-1/2" />

          {/* Scanner bounds overlay */}
          <div className="absolute inset-0 border-[28px] md:border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
            <div className="w-[85%] h-[60%] border-2 border-dashed border-emerald-400/80 rounded-lg relative">
              {/* Corner markings */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-500 rounded-tl" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-500 rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-500 rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-500 rounded-br" />
            </div>
          </div>

          {/* Camera controls overlay */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
            <span className="bg-black/75 backdrop-blur-sm text-neutral-300 font-mono text-[10px] px-2.5 py-1 rounded-full border border-neutral-800/50 flex items-center gap-1.5 shadow">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              {detectorSupported ? "AUTO-DECODING ACTIVE" : "VISION SCANNER MODE"}
            </span>
            <div className="flex gap-2 pointer-events-auto">
              <button
                onClick={toggleFacingMode}
                className="bg-black/75 hover:bg-neutral-900 active:scale-95 text-white p-2.5 rounded-full transition shadow-lg border border-neutral-800"
                title="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {showCloseButton && onClose && (
                <button
                  onClick={onClose}
                  className="bg-black/75 hover:bg-neutral-900 active:scale-95 text-white p-2.5 rounded-full transition shadow-lg border border-neutral-800"
                  title="Close Scanner"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Capture/Analyze instruction footer */}
          <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center justify-center px-4 space-y-2 pointer-events-none">
            <p className="text-[11px] text-white/90 bg-black/85 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-neutral-800 text-center max-w-sm shadow-md">
              {detectorSupported
                ? "Align the barcode. It will auto-detect instantly!"
                : "Position the barcode or nutrition label inside and press Analyze"}
            </p>
            <div className="flex gap-2 pointer-events-auto">
              <button
                onClick={handleCaptureFrame}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium text-xs px-5 py-2.5 rounded-full shadow-xl active:scale-95 transition flex items-center gap-2"
                id="btn-analyze-frame"
              >
                <Camera className="w-4 h-4" />
                Analyze Frame Now
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-black/85 hover:bg-neutral-900 text-neutral-200 font-medium text-xs px-5 py-2.5 rounded-full shadow-xl active:scale-95 transition flex items-center gap-2 border border-neutral-800 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                Upload Photo
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
