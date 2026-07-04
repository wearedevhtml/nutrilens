import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Droplet, 
  Beaker, 
  Flame, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  ShieldCheck, 
  HelpCircle,
  Eye,
  Info
} from "lucide-react";

interface AdulterantItem {
  id: string;
  name: string;
  commonAdulterants: string[];
  purpose: string;
  hazardLevel: "Severe" | "High" | "Moderate";
  hazardDescription: string;
  tests: {
    title: string;
    description: string;
    steps: string[];
    resultInterpretation: {
      pure: string;
      adulterated: string;
    };
  }[];
}

const ADULTERANTS_DATA: AdulterantItem[] = [
  {
    id: "milk",
    name: "Milk",
    commonAdulterants: ["Water", "Detergent", "Caustic Soda", "Urea", "Starch"],
    purpose: "Diluted with water to increase volume, and contaminated with harmful chemical agents like detergent, caustic soda, urea, and starch to artificially maintain thickness, foam, and density.",
    hazardLevel: "Severe",
    hazardDescription: "Caustic soda and detergents damage the gastrointestinal mucosa, cause food poisoning, and severely affect renal and cardiac health over time.",
    tests: [
      {
        title: "The Water Dilution Slide Test",
        description: "Detects water dilution or structural stretching.",
        steps: [
          "Put a single drop of milk on a polished, slanted surface (like a clean metallic plate, marble surface, or glass slide).",
          "Observe how the milk flows downwards."
        ],
        resultInterpretation: {
          pure: "Pure milk flows slowly, leaving a clear, thick white trail behind it.",
          adulterated: "Water-diluted milk flows downwards immediately and rapidly, leaving zero trace or trail."
        }
      },
      {
        title: "The Foam / Detergent Shake Test",
        description: "Detects added detergent or foaming surfactants.",
        steps: [
          "Take 5-10 ml of milk sample in a small bottle or test tube and add an equal quantity of clean water.",
          "Shake the mixture vigorously for 15-30 seconds.",
          "Observe the froth or foam that forms at the top."
        ],
        resultInterpretation: {
          pure: "Pure milk forms a very thin layer of froth that dissolves quickly within a minute.",
          adulterated: "Adulterated milk forms a thick, dense, soapy lather that remains stable for a long time without dissolving."
        }
      },
      {
        title: "The Starch Iodine Test",
        description: "Detects added starch flour used for thickening milk.",
        steps: [
          "Boil 3 ml of milk in a spoon or small cup, then let it cool down to room temperature.",
          "Add 1 to 2 drops of common household Iodine solution (or liquid antiseptic containing iodine).",
          "Watch for any color transition."
        ],
        resultInterpretation: {
          pure: "No color change occurs (it remains a light yellowish-white mixture).",
          adulterated: "The milk instantly turns a deep blue or violet color, confirming starch adulteration."
        }
      }
    ]
  },
  {
    id: "ghee",
    name: "Ghee (Clarified Butter)",
    commonAdulterants: ["Vanaspati (Vegetable Fat)", "Hydrogenated Oils", "Animal Fats", "Mashed Potatoes"],
    purpose: "Frequently bulked up or completely replaced with cheap hydrogenated vegetable fats (like vanaspati) and animal body fats to closely mimic ghee texture at a fraction of the cost.",
    hazardLevel: "High",
    hazardDescription: "Hydrogenated fats contain high amounts of trans-fatty acids which dramatically increase the risk of coronary heart disease and raise LDL cholesterol levels.",
    tests: [
      {
        title: "The Acid Crimson Test",
        description: "Detects Vanaspati (hydrogenated sesame/vegetable oils).",
        steps: [
          "Take 1 teaspoon of melted ghee in a clean glass container.",
          "Add an equal quantity of concentrated hydrochloric acid (or common heavy-duty clear bathroom/acid cleaner) along with a small pinch of sugar.",
          "Shake the container gently and let it sit for 5 minutes."
        ],
        resultInterpretation: {
          pure: "The acid layer remains completely clear or unchanged.",
          adulterated: "The bottom acid layer turns a bright crimson, red, or dark pink color. This indicates the presence of sesame oil/vanaspati."
        }
      },
      {
        title: "The Iodine Starch Test",
        description: "Detects mashed potatoes, sweet potatoes, or starch.",
        steps: [
          "Melt 1 teaspoon of ghee in a spoon or bowl.",
          "Add 2-3 drops of Iodine solution.",
          "Observe the color reaction."
        ],
        resultInterpretation: {
          pure: "The mixture retains its natural light yellow oily color.",
          adulterated: "The ghee turns into a distinct blue color, proving starch or mashed tubers were blended in."
        }
      }
    ]
  },
  {
    id: "honey",
    name: "Honey",
    commonAdulterants: ["High-Fructose Corn Syrup", "Invert Sugar", "Molasses", "Sugar Water"],
    purpose: "Artificially mixed or diluted with cheap high-fructose corn syrup, industrial rice syrups, molasses, or sugar water to stretch the volume and lower production costs.",
    hazardLevel: "Moderate",
    hazardDescription: "Adulterated honey defeats the diabetic-friendly and antioxidant-rich purposes of honey, spikes blood sugar rapidly, and causes metabolic weight gain.",
    tests: [
      {
        title: "The Water Dispersion Test",
        description: "Detects sugar syrups which have higher water solubility.",
        steps: [
          "Take a glass of clean, room-temperature water.",
          "Gently pour 1 teaspoon of honey into the water from a short distance without stirring.",
          "Observe how the honey settles or dissolves."
        ],
        resultInterpretation: {
          pure: "The honey does not disperse in water. It stays perfectly intact as a thick, solid lump and settles at the very bottom.",
          adulterated: "The honey begins dissolving and dispersing into the water on its way down, clouding the liquid."
        }
      },
      {
        title: "The Cotton Wick Burn Test",
        description: "Detects excessive water dilution in adulterated syrups.",
        steps: [
          "Take a small cotton wick or matchstick and dip it completely into the honey sample.",
          "Wipe off any excessive honey.",
          "Try to light the wick with a matchbox or lighter."
        ],
        resultInterpretation: {
          pure: "The wick catches fire easily and burns smoothly without crackling.",
          adulterated: "The wick will fail to burn, or it will produce a continuous crackling or popping sound due to excess moisture."
        }
      }
    ]
  },
  {
    id: "spices",
    name: "Spices (Turmeric / Chilli Powder)",
    commonAdulterants: ["Metanil Yellow Dye", "Lead Chromate", "Sawdust", "Chalk Powder", "Brick Powder"],
    purpose: "Turmeric is dyed with metanil yellow or mixed with chalk/lead chromate. Chilli powder is bulked up with sawdust, brick dust, or non-permissible toxic industrial dyes to enhance red color.",
    hazardLevel: "Severe",
    hazardDescription: "Metanil yellow and lead chromate are highly carcinogenic toxic colorants that lead to neurological damage, kidney toxicity, and severe digestive disorders.",
    tests: [
      {
        title: "Turmeric: Metanil Yellow Acid Test",
        description: "Detects prohibited industrial yellow dyes.",
        steps: [
          "Take a pinch of turmeric powder in a test tube or transparent glass container.",
          "Add 3-5 ml of warm water and shake well.",
          "Add a few drops of common acid (such as lemon juice or dilute household acid)."
        ],
        resultInterpretation: {
          pure: "The yellow solution might temporarily darken slightly but does not turn pink or violet.",
          adulterated: "The solution immediately turns a bright violet or deep pink. (If it remains pink/violet even after dilution, metanil yellow is present)."
        }
      },
      {
        title: "Chilli Powder: Water Sedimentation Test",
        description: "Detects heavy brick dust, sawdust, or sand.",
        steps: [
          "Take a teaspoon of chilli powder and sprinkle it over a glass of water.",
          "Observe the behavior of the powder particles."
        ],
        resultInterpretation: {
          pure: "Chilli powder stays suspended or slowly sinks without leaving heavy residues.",
          adulterated: "Heavy brick powder or sand settles immediately to the bottom, leaving a gritty layer, while sawdust floats clearly on the surface."
        }
      }
    ]
  },
  {
    id: "tea",
    name: "Loose Tea Leaves",
    commonAdulterants: ["Exhausted/Used Tea Leaves", "Coal Tar Dyes", "Iron Filings", "Artificial Coloring Agents"],
    purpose: "Frequently blended with exhausted (previously used and dried) tea leaves that are artificially colored with chemical coal tar dyes, or mixed with iron filings to increase weight.",
    hazardLevel: "High",
    hazardDescription: "Coal tar dyes are toxic and can cause bladder cancer and liver degradation. Excess iron filings damage the stomach lining.",
    tests: [
      {
        title: "The Wet Paper Dye Bleed Test",
        description: "Detects added artificial chemical dyes.",
        steps: [
          "Take a piece of white filter paper, blotting paper, or a clean white paper towel and moisten it slightly with water.",
          "Sprinkle a pinch of tea leaves over the wet paper.",
          "Leave it for 2-3 minutes, then remove the leaves."
        ],
        resultInterpretation: {
          pure: "The paper shows no spots or only very faint light brownish spots after removing leaves.",
          adulterated: "The paper shows vivid yellow, pink, or red colored spots bleed patterns instantly, indicating artificial food coloring."
        }
      },
      {
        title: "The Magnet Iron Test",
        description: "Detects iron filings used to increase density and weight.",
        steps: [
          "Spread a small handful of loose tea leaves flatly on a sheet of clean white paper.",
          "Move a standard household magnet closely above the tea leaves without touching them.",
          "Observe if any particles jump up."
        ],
        resultInterpretation: {
          pure: "No particles are attracted or move toward the magnet.",
          adulterated: "Dark iron filings will instantly lift and stick to the magnet, showing high levels of industrial metal contamination."
        }
      }
    ]
  },
  {
    id: "oils",
    name: "Edible Oils (Mustard / Olive Oil)",
    commonAdulterants: ["Argemone Oil", "Cottonseed Oil", "Mineral Oil", "Cheap Palm Oil"],
    purpose: "Premium edible oils (like cold-pressed mustard oil or extra-virgin olive oil) are diluted with cheaper, odorless, hazardous argemone weed oil, cottonseed oil, or mineral oils.",
    hazardLevel: "Severe",
    hazardDescription: "Argemone oil consumption causes toxic epidemic dropsy, cardiovascular strain, severe edema, blindness, and heart failure.",
    tests: [
      {
        title: "The Acid Argemone Test",
        description: "Detects argemone seed oil in mustard oil.",
        steps: [
          "Take 5 ml of the mustard oil sample in a small glass container.",
          "Add 2 ml of nitric acid (or concentrated clear acid) and shake the mixture thoroughly.",
          "Let it sit for 2-3 minutes and inspect the lower layer."
        ],
        resultInterpretation: {
          pure: "The oil remains clear and keeps its standard natural golden-yellow color.",
          adulterated: "The lower acid layer turns a reddish-brown, orange-red, or crimson color, confirming lethal argemone oil presence."
        }
      },
      {
        title: "The Refrigerator Separation Test",
        description: "Detects palm oil or cheap saturated fats in premium oil.",
        steps: [
          "Pour 20 ml of premium oil (like olive oil) into a small clean glass cup.",
          "Place the cup inside the refrigerator (not freezer) for 3-4 hours.",
          "Observe the state of liquid."
        ],
        resultInterpretation: {
          pure: "Extra virgin olive oil or pure mustard oil will remain fully liquid or thicken very uniformly as a gel.",
          adulterated: "Cheap added fats will separate and solidify into a thick white opaque layer at the bottom, leaving the lighter oil on top."
        }
      }
    ]
  },
  {
    id: "paneer",
    name: "Paneer (Cottage Cheese)",
    commonAdulterants: ["Starch", "Detergent", "Urea", "Synthetic Milk Fats"],
    purpose: "Frequently bulked up with starch, or made using low-quality synthetic milk containing detergent, urea, and cheap vegetable oils to artificially mimic rich dairy fat and increase overall weight.",
    hazardLevel: "Severe",
    hazardDescription: "Detergents and chemical stabilizers in synthetic paneer cause severe stomach disorders, toxicity, damages to the intestinal lining, and acute food poisoning.",
    tests: [
      {
        title: "The Iodine Starch Test",
        description: "Detects added starch or binders used to add weight and density.",
        steps: [
          "Take a small piece of paneer and boil it in a cup of water for 2-3 minutes.",
          "Let the water and paneer cool down to room temperature.",
          "Add 2-3 drops of Iodine solution to the mixture and observe any color transformation."
        ],
        resultInterpretation: {
          pure: "The solution or paneer retains its natural light milky-white or faint yellow color.",
          adulterated: "The paneer or water instantly turns a distinct, deep blue or purple color, proving starch was blended in."
        }
      },
      {
        title: "The Hot Water Mashing Test",
        description: "Detects synthetic binding agents, urea, or detergent residues.",
        steps: [
          "Place a small cube of paneer in hot boiling water for 2 minutes.",
          "Remove it carefully and let it cool slightly.",
          "Try to mash and squeeze it between your thumb and index finger to check its texture and cohesion."
        ],
        resultInterpretation: {
          pure: "Pure paneer is soft, spongy, and crumbles smoothly under mild pressure without feeling sticky.",
          adulterated: "Adulterated or synthetic paneer turns highly rubbery, extremely hard to break, or disintegrates into a slippery, soapy-feeling paste."
        }
      }
    ]
  }
];

export default function FakeProductGuide() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string | null>("milk");

  const filteredData = ADULTERANTS_DATA.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.commonAdulterants.some(ad => ad.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeProduct = ADULTERANTS_DATA.find(p => p.id === selectedProduct) || ADULTERANTS_DATA[0];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 relative z-10" id="fake-product-guide">
      {/* Intro Header */}
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200/60 text-amber-900 px-3 py-1 rounded-full text-[11px] font-bold font-mono uppercase shadow-3xs">
          <ShieldCheck className="w-4 h-4 text-amber-700" />
          <span>PureTest™ Household DIY Registry</span>
        </div>
        <h2 className="text-xl font-extrabold text-stone-800 font-display tracking-tight sm:text-2xl">
          Zero-AI Pure Adulteration Guide
        </h2>
        <p className="text-xs text-stone-500 leading-relaxed max-w-lg mx-auto">
          No camera, AI, or advanced laboratory machinery needed. Protect your family with instant, scientifically proven physical tests using common kitchen supplies.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-3xs">
        <div className="relative">
          <input
            type="text"
            placeholder="Search products (e.g. Ghee, Milk, Honey, Spices)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-stone-50/50 border border-stone-200 rounded-xl py-3 pl-10 pr-4 text-xs focus:ring-2 focus:ring-amber-500/10 focus:border-amber-600 outline-none transition font-semibold"
          />
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Main Two-Column Guide Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        
        {/* Left Side: Product Selector Cards List */}
        <div className="md:col-span-5 space-y-2">
          <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-1">
            Common Household Targets
          </h3>
          <div className="space-y-2">
            {filteredData.map((item) => {
              const isActive = item.id === selectedProduct;
              const isSevere = item.hazardLevel === "Severe";
              const isHigh = item.hazardLevel === "High";

              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedProduct(item.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between group ${
                    isActive 
                      ? "bg-white border-amber-500 shadow-sm ring-1 ring-amber-500/20" 
                      : "bg-white/80 hover:bg-white border-stone-200 hover:border-stone-300 shadow-3xs"
                  }`}
                >
                  <div className="space-y-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold font-display text-xs ${isActive ? "text-amber-900" : "text-stone-700"}`}>
                        {item.name}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold tracking-wide ${
                        isSevere 
                          ? "bg-rose-50 text-rose-700 border border-rose-100" 
                          : isHigh 
                          ? "bg-amber-50 text-amber-700 border border-amber-100" 
                          : "bg-stone-100 text-stone-600 border border-stone-200"
                      }`}>
                        {item.hazardLevel} Hazard
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-400 line-clamp-1">
                      Adulterants: {item.commonAdulterants.join(", ")}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${
                    isActive ? "text-amber-600 translate-x-0.5" : "text-stone-300 group-hover:text-stone-400"
                  }`} />
                </button>
              );
            })}

            {filteredData.length === 0 && (
              <div className="text-center py-8 bg-white border border-stone-200 rounded-xl">
                <Info className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-xs text-stone-400 font-semibold">No food target matched your query</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active Product Testing Details Sheet */}
        <div className="md:col-span-7">
          <AnimatePresence mode="wait">
            {activeProduct && (
              <motion.div
                key={activeProduct.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6"
              >
                {/* Header Information */}
                <div className="border-b border-stone-100 pb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-stone-800 font-display">
                      {activeProduct.name} Integrity Protocol
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                      activeProduct.hazardLevel === "Severe" 
                        ? "bg-rose-100 text-rose-800 border border-rose-200 animate-pulse" 
                        : activeProduct.hazardLevel === "High" 
                        ? "bg-amber-100 text-amber-800 border border-amber-200" 
                        : "bg-stone-100 text-stone-800 border border-stone-200"
                    }`}>
                      {activeProduct.hazardLevel} Toxicity Alert
                    </span>
                  </div>

                  <div className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3.5 rounded-xl border border-stone-100 relative">
                    <div className="font-bold text-stone-700 flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      Adulteration Pattern:
                    </div>
                    {activeProduct.purpose}
                  </div>
                  
                  <div className="text-[10px] text-rose-800 font-medium flex gap-1.5 items-start mt-2">
                    <span className="font-bold uppercase font-mono bg-rose-50 border border-rose-100 px-1 py-0.2 rounded text-[8px] shrink-0 mt-0.5">Toxicity Hazard</span>
                    <span className="leading-relaxed">{activeProduct.hazardDescription}</span>
                  </div>
                </div>

                {/* Experimental DIY Tests */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Beaker className="w-4 h-4 text-emerald-800" />
                    Recommended Home Testing Protocols
                  </h4>

                  <div className="space-y-5">
                    {activeProduct.tests.map((test, idx) => (
                      <div 
                        key={idx}
                        className="border border-stone-100/80 bg-stone-50/20 rounded-xl p-4 space-y-3 shadow-3xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-black text-emerald-800 flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <h5 className="text-xs font-bold text-stone-800">
                            {test.title}
                          </h5>
                        </div>
                        
                        <p className="text-[11px] text-stone-400 italic font-medium pl-7">
                          {test.description}
                        </p>

                        <ul className="space-y-1.5 pl-7">
                          {test.steps.map((step, sIdx) => (
                            <li key={sIdx} className="text-xs text-stone-600 flex items-start gap-1.5">
                              <span className="text-emerald-700 font-bold shrink-0 mt-0.5">•</span>
                              <span className="leading-relaxed">{step}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Result Indicators */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-stone-100/60 pl-7">
                          {/* Pure */}
                          <div className="bg-emerald-50/50 border border-emerald-100/50 p-2.5 rounded-lg space-y-1">
                            <span className="text-[9px] font-mono font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              If Pure Product
                            </span>
                            <p className="text-[10px] text-emerald-800 font-medium leading-relaxed">
                              {test.resultInterpretation.pure}
                            </p>
                          </div>

                          {/* Adulterated */}
                          <div className="bg-rose-50/50 border border-rose-100/50 p-2.5 rounded-lg space-y-1">
                            <span className="text-[9px] font-mono font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              If Adulterated
                            </span>
                            <p className="text-[10px] text-rose-800 font-medium leading-relaxed">
                              {test.resultInterpretation.adulterated}
                            </p>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>

                {/* Footnote guidance */}
                <div className="bg-stone-100/80 p-3 rounded-xl border border-stone-200/50 flex items-start gap-2.5">
                  <HelpCircle className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-stone-500 leading-relaxed font-medium">
                    Disclaimer: These tests are rapid primary screening tests designed strictly for qualitative domestic evaluation. For highly sensitive, legal, or absolute quantitative validation, please consult authorized state food safety testing laboratories.
                  </p>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
