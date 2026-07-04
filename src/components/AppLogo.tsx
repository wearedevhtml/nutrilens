import React from "react";

interface AppLogoProps {
  className?: string;
  size?: number;
}

export default function AppLogo({ className = "", size = 80 }: AppLogoProps) {
  const [useFallback, setUseFallback] = React.useState(false);

  return (
    <div
      id="nutrilens-logo-container"
      className={`inline-flex items-center justify-center select-none overflow-hidden rounded-3xl bg-white shadow-md border-4 border-emerald-500/10 ${className}`}
      style={{ width: size, height: size }}
    >
      {!useFallback ? (
        <img
          src="/app-logo.png"
          alt="NutriLens Logo"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setUseFallback(true)}
        />
      ) : (
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full drop-shadow-sm"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Soft watercolor blurs and textures */}
            <filter id="brush-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
              <feDisplacementMap in="blur" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" />
            </filter>

            {/* Symmetrical nested heart leaf path definition */}
            <g id="clover-leaf">
              <path
                d="M 100 100 C 76 80, 60 55, 80 40 C 94 30, 100 50, 100 50 C 100 50, 106 30, 120 40 C 140 55, 124 80, 100 100 Z"
                fill="#1db845"
              />
              <path
                d="M 100 100 C 82 85, 70 66, 85 55 C 95 47, 100 62, 100 62 C 100 62, 105 47, 115 55 C 130 66, 118 85, 100 100 Z"
                fill="#86d419"
              />
              <path
                d="M 100 100 C 88 90, 80 77, 90 70 C 97 65, 100 74, 100 74 C 100 74, 103 65, 110 70 C 120 77, 112 90, 100 100 Z"
                fill="#dbfa30"
              />
            </g>
          </defs>

          <g filter="url(#brush-blur)" opacity="0.85">
            <path
              d="M 25 105 C 40 98, 70 95, 100 97 C 130 95, 160 100, 175 108 C 178 115, 165 125, 140 123 C 110 120, 80 125, 50 121 C 30 118, 20 112, 25 105 Z"
              fill="#79af40"
            />
            <path
              d="M 30 98 C 50 90, 90 92, 120 90 C 150 88, 165 92, 170 97 C 160 103, 110 101, 80 104 C 50 107, 32 103, 30 98 Z"
              fill="#8cb94f"
              opacity="0.9"
            />
            <path
              d="M 40 115 C 60 113, 90 117, 120 115 C 150 113, 160 120, 155 124 C 140 129, 100 125, 70 127 C 45 129, 35 121, 40 115 Z"
              fill="#699e32"
              opacity="0.8"
            />
            <path
              d="M 20 106 L 30 105 M 172 104 L 182 105 M 23 112 L 35 110 M 168 118 L 178 116"
              stroke="#73a53c"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.7"
            />
          </g>

          <use href="#clover-leaf" transform="rotate(0, 100, 100)" />
          <use href="#clover-leaf" transform="rotate(90, 100, 100)" />
          <use href="#clover-leaf" transform="rotate(180, 100, 100)" />
          <use href="#clover-leaf" transform="rotate(270, 100, 100)" />
        </svg>
      )}
    </div>
  );
}
