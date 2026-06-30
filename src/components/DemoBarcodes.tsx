import { Flame, Droplet, Soup, Wheat, Plus, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface DemoProduct {
  barcode: string;
  name: string;
  category: "soda" | "snack" | "healthy" | "instant";
  description: string;
}

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    barcode: "012000000133",
    name: "Pepsi Cola Soda",
    category: "soda",
    description: "Classic High Sugar Carbonated Drink",
  },
  {
    barcode: "028400070560",
    name: "Lay's Classic Chips",
    category: "snack",
    description: "Salty Fried Potato Snacks",
  },
  {
    barcode: "030000010202",
    name: "Quaker Rolled Oats",
    category: "healthy",
    description: "100% Whole Grain Healthy Oats",
  },
  {
    barcode: "8850125078512",
    name: "Mama Instant Noodles",
    category: "instant",
    description: "Instant ramen with high sodium and MSG",
  }
];

interface DemoBarcodesProps {
  onSelectBarcode: (barcode: string) => void;
  isLoading: boolean;
}

export default function DemoBarcodes({ onSelectBarcode, isLoading }: DemoBarcodesProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "soda":
        return <Droplet className="w-3.5 h-3.5 text-sky-700" />;
      case "snack":
        return <Flame className="w-3.5 h-3.5 text-amber-700" />;
      case "healthy":
        return <Wheat className="w-3.5 h-3.5 text-emerald-700" />;
      case "instant":
        return <Soup className="w-3.5 h-3.5 text-orange-700" />;
      default:
        return <Plus className="w-3.5 h-3.5 text-stone-600" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "healthy":
        return "bg-emerald-50/20 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50/50";
      case "soda":
        return "bg-stone-50/30 border-stone-200/80 hover:border-sky-500 hover:bg-sky-50/30";
      case "snack":
        return "bg-stone-50/30 border-stone-200/80 hover:border-amber-500 hover:bg-amber-50/30";
      case "instant":
        return "bg-stone-50/30 border-stone-200/80 hover:border-orange-500 hover:bg-orange-50/30";
      default:
        return "bg-stone-50/30 border-stone-200/80 hover:border-emerald-500 hover:bg-emerald-50/30";
    }
  };

  return (
    <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-stone-200/85 p-5 max-w-xl mx-auto space-y-4 shadow-sm shadow-stone-100/40 relative z-10">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-xs font-display font-bold text-stone-800">Quick Test Barcodes</h4>
          <p className="text-[10px] text-stone-400 mt-0.5 leading-relaxed">
            No product nearby? Click any popular item below to run a lookup simulation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {DEMO_PRODUCTS.map((prod) => (
          <button
            key={prod.barcode}
            disabled={isLoading}
            onClick={() => onSelectBarcode(prod.barcode)}
            className={`flex items-start gap-3 p-3 text-left border rounded-xl transition active:scale-[0.98] ${getCategoryColor(
              prod.category
            )} group relative overflow-hidden cursor-pointer ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
            title={`Scan barcode ${prod.barcode}`}
          >
            {/* Category Icon */}
            <div className="p-1.5 bg-white rounded-lg border border-stone-100/80 shrink-0 shadow-2xs group-hover:scale-105 transition">
              {getCategoryIcon(prod.category)}
            </div>

            {/* Product details */}
            <div className="min-w-0 flex-1">
              <h5 className="text-xs font-semibold text-stone-800 group-hover:text-stone-900 transition truncate">
                {prod.name}
              </h5>
              <p className="text-[10px] text-stone-400 mt-0.5 leading-normal truncate font-normal">
                {prod.description}
              </p>
              <span className="inline-block mt-1.5 font-mono text-[9px] text-stone-400 tracking-wider">
                #{prod.barcode}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
