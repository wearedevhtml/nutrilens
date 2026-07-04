import { HistoryItem } from "../types";
import { Trash2, Calendar, ShieldCheck, ChevronRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface BarcodeHistoryProps {
  history: HistoryItem[];
  onSelectItem: (item: HistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export default function BarcodeHistory({
  history,
  onSelectItem,
  onDeleteItem,
  onClearAll,
}: BarcodeHistoryProps) {
  
  // Grade color utility
  const getGradeStyles = (grade: string) => {
    switch (grade) {
      case "A":
        return { bg: "bg-emerald-50 text-emerald-800 border-emerald-200" };
      case "B":
        return { bg: "bg-stone-50 text-stone-700 border-stone-200" };
      case "C":
        return { bg: "bg-amber-50 text-amber-800 border-amber-200" };
      case "D":
        return { bg: "bg-orange-50 text-orange-800 border-orange-200" };
      case "E":
        return { bg: "bg-rose-50 text-rose-800 border-rose-200" };
      default:
        return { bg: "bg-stone-50 text-stone-700 border-stone-200" };
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return isoString;
    }
  };

  if (history.length === 0) {
    return (
      <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-stone-200/80 p-8 text-center max-w-lg mx-auto shadow-2xs relative z-10">
        <div className="w-12 h-12 bg-emerald-50/50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-emerald-100/30">
          <ShieldCheck className="w-6 h-6 text-emerald-700" />
        </div>
        <h3 className="text-xs font-display font-semibold text-stone-800">No scanned history</h3>
        <p className="text-xs text-stone-400 mt-1 max-w-[240px] mx-auto leading-relaxed">
          Scan barcodes or input packages manually to populate your recent grades list.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-xl mx-auto relative z-10">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-xs font-display font-bold text-stone-800 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          Recent Grades ({history.length})
        </h3>
        <button
          onClick={onClearAll}
          className="text-xs text-stone-400 hover:text-rose-600 transition cursor-pointer font-medium"
          id="btn-clear-history"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {history.map((item, index) => {
          const styles = getGradeStyles(item.result.grade);
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`flex items-center justify-between p-3 bg-white/90 backdrop-blur-md rounded-xl border border-stone-200/80 hover:border-emerald-600/50 cursor-pointer transition group`}
              onClick={() => onSelectItem(item)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Visual Grade Stamp */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-sm shrink-0 border ${styles.bg} shadow-2xs`}>
                  {item.result.grade}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-stone-800 truncate group-hover:text-stone-900 transition">
                    {item.result.productName}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 text-stone-400 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      {formatTime(item.timestamp)}
                    </span>
                    <span className="text-stone-200">•</span>
                    <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                      Score: {item.result.healthScore}
                    </span>
                    <span className="text-stone-200">•</span>
                    {item.result.isPrediction ? (
                      <span className="bg-amber-50 text-amber-800 border border-amber-100 px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold tracking-wide">
                        PREDICTED
                      </span>
                    ) : (
                      <span className="bg-emerald-50/80 text-emerald-800 border border-emerald-100/50 px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold tracking-wide">
                        VERIFIED
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0 ml-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem(item.id);
                  }}
                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition cursor-pointer"
                  title="Delete Item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-stone-300 group-hover:translate-x-0.5 transition" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
