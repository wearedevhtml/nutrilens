import React, { useEffect, useState } from "react";
import { motion, animate } from "framer-motion";

interface RadialGaugeProps {
  score: number;
  grade: string;
}

export default function RadialGauge({ score, grade }: RadialGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    // Reset display score and animate to the target score
    const controls = animate(0, score, {
      duration: 1.5,
      ease: [0.16, 1, 0.3, 1], // Custom premium easeOutExpo
      onUpdate: (latest) => setDisplayScore(Math.round(latest)),
    });
    return () => controls.stop();
  }, [score]);

  // SVG Geometry Constants
  // Center is (60, 62) to give slightly more space at the bottom for text/labels
  const cx = 60;
  const cy = 62;
  const r = 44;

  // 240-degree arc properties
  // Full circumference = 2 * Math.PI * r = 276.46
  const circumference = 2 * Math.PI * r;
  const activeSweep = 240;
  const totalCircle = 360;
  const activeArcLength = circumference * (activeSweep / totalCircle); // 184.3
  const strokeDasharray = `${activeArcLength} ${circumference}`;

  // Start at 150 degrees (bottom-left) to span 240 degrees clockwise to 30 degrees (bottom-right)
  const rotationAngle = 150; 

  // Calculate progress offset
  // Offset of 0 means the active arc is fully filled.
  // Offset of activeArcLength means it is completely empty.
  const strokeDashoffset = activeArcLength - (displayScore / 100) * activeArcLength;

  // Needle rotation: from -120 deg (at score 0) to +120 deg (at score 100)
  const needleRotation = -120 + (displayScore / 100) * 240;

  // Generate tick marks
  const ticks = Array.from({ length: 11 }).map((_, i) => {
    const tickValue = i * 10;
    const tickAngleDeg = -120 + (tickValue / 100) * 240; // relative to top center
    const tickAngleRad = ((tickAngleDeg - 90) * Math.PI) / 180; // standard SVG coordinate angle
    
    // Start at outer radius r, end further in
    const isMajor = i % 5 === 0;
    const rStart = r - 1;
    const rEnd = r - (isMajor ? 6 : 3.5);

    const x1 = cx + rStart * Math.cos(tickAngleRad);
    const y1 = cy + rStart * Math.sin(tickAngleRad);
    const x2 = cx + rEnd * Math.cos(tickAngleRad);
    const y2 = cy + rEnd * Math.sin(tickAngleRad);

    return { id: i, x1, y1, x2, y2, isMajor, value: tickValue };
  });

  // Highlight color based on the current score
  const getScoreColorClass = (val: number) => {
    if (val >= 80) return "text-emerald-600 fill-emerald-600";
    if (val >= 50) return "text-amber-500 fill-amber-500";
    return "text-rose-600 fill-rose-600";
  };

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-stone-50/40 rounded-xl border border-stone-200/50 shadow-3xs w-36 h-36 relative select-none">
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full overflow-visible"
        style={{ transform: "translate3d(0,0,0)" }}
      >
        <defs>
          {/* Botanical color gradient for the active gauge sweep */}
          <linearGradient id="nature-gauge-grad" x1="0%" y1="100%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />   {/* Rose Red */}
            <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.85" />  {/* Amber */}
            <stop offset="75%" stopColor="#10b981" stopOpacity="0.85" />  {/* Emerald */}
            <stop offset="100%" stopColor="#047857" stopOpacity="0.95" /> {/* Deep Forest */}
          </linearGradient>

          {/* Smooth shadow for the needle cap */}
          <filter id="needle-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* 1. Background Arc Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          className="stroke-stone-150 fill-none opacity-40"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          style={{
            transform: `rotate(${rotationAngle}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
          }}
        />

        {/* 2. Colorful Progress Fill Arc */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="url(#nature-gauge-grad)"
          strokeWidth="6.5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{
            transform: `rotate(${rotationAngle}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: "stroke-dashoffset 0.05s ease-out",
          }}
        />

        {/* 3. Instrument Tick Marks */}
        {ticks.map((tick) => (
          <line
            key={tick.id}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            className={`${
              tick.isMajor ? "stroke-stone-400" : "stroke-stone-300"
            } transition-colors duration-300`}
            strokeWidth={tick.isMajor ? "1.2" : "0.7"}
          />
        ))}

        {/* 4. Soft Text Labels for 0, 50, and 100 */}
        <text
          x="18"
          y="104"
          textAnchor="middle"
          className="fill-stone-400 font-mono text-[7px] font-semibold tracking-tighter"
        >
          0
        </text>
        <text
          x={cx}
          y="11"
          textAnchor="middle"
          className="fill-stone-400 font-mono text-[7px] font-semibold tracking-tighter"
        >
          50
        </text>
        <text
          x="102"
          y="104"
          textAnchor="middle"
          className="fill-stone-400 font-mono text-[7px] font-semibold tracking-tighter"
        >
          100
        </text>

        {/* 5. Animated Leaf Needle Group */}
        <g
          style={{
            transform: `rotate(${needleRotation}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
          }}
          className="transition-transform duration-75 ease-out"
        >
          {/* Outer elegant leaf pointer */}
          <path
            d={`M${cx},${cy} C${cx - 3},${cy - 8} ${cx - 4},${cy - 24} ${cx},${cy - 36} C${cx + 4},${cy - 24} ${cx + 3},${cy - 8} ${cx},${cy} Z`}
            fill="#065f46"
            stroke="#10b981"
            strokeWidth="0.6"
            filter="url(#needle-shadow)"
          />
          {/* Inner stem vein */}
          <path
            d={`M${cx},${cy - 4} L${cx},${cy - 30}`}
            stroke="#34d399"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.9"
          />
        </g>

        {/* 6. High-contrast central pivot cap */}
        <circle
          cx={cx}
          cy={cy}
          r="4.5"
          fill="#065f46"
          stroke="#ffffff"
          strokeWidth="1.2"
          className="shadow-xs"
        />
        <circle cx={cx} cy={cy} r="1.2" fill="#34d399" />
      </svg>

      {/* 7. Score and Grade Display Overlay */}
      <div className="absolute bottom-2.5 flex flex-col items-center justify-center">
        <span className={`text-[19px] font-display font-extrabold tracking-tight ${getScoreColorClass(displayScore)}`}>
          {displayScore}
        </span>
        <span className="text-[8px] text-stone-400 font-bold tracking-wider -mt-1 uppercase">
          Score
        </span>
      </div>
    </div>
  );
}
