"use client";

type BadgeIconProps = {
  slug: string;
  category: string;
  rarity: string;
  size?: number;
  className?: string;
};

type BadgePalette = {
  glow: string;
  shell: string;
  core: string;
  accent: string;
  accentSoft: string;
};

const categoryPalettes: Record<string, BadgePalette> = {
  founders: {
    glow: "#e7ddd1",
    shell: "#f7f1eb",
    core: "#3f2f29",
    accent: "#f1d9bc",
    accentSoft: "#fff7ef",
  },
  sales: {
    glow: "#ffd69e",
    shell: "#fff1d8",
    core: "#8c3d24",
    accent: "#ffbf47",
    accentSoft: "#fff6d7",
  },
  purchases: {
    glow: "#cfe2ff",
    shell: "#edf4ff",
    core: "#2f4c9e",
    accent: "#6aa8ff",
    accentSoft: "#eef7ff",
  },
  promotion: {
    glow: "#ddd6ff",
    shell: "#f2efff",
    core: "#4d3db3",
    accent: "#8b7cff",
    accentSoft: "#f5f2ff",
  },
  referrals: {
    glow: "#d7dcff",
    shell: "#eef1ff",
    core: "#3756b7",
    accent: "#88a6ff",
    accentSoft: "#f4f6ff",
  },
  prestige: {
    glow: "#ecd1ff",
    shell: "#f7ebff",
    core: "#6c2aa0",
    accent: "#f2c94c",
    accentSoft: "#fff4cf",
  },
};

const rarityRings: Record<string, string> = {
  common: "#f2eee7",
  rare: "#cfdcff",
  epic: "#dcc6ff",
  legendary: "#ffd7a8",
};

const glyphs = ["diamond", "hex", "star", "triangle", "crown", "orbit"] as const;

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const hexPoints = "50,8 85,28 85,68 50,88 15,68 15,28";
const diamondPoints = "50,18 72,40 50,62 28,40";
const trianglePoints = "50,19 70,58 30,58";
const crownPoints = "28,60 34,32 50,46 66,32 72,60 28,60";

export default function ProfileBadgeIcon({
  slug,
  category,
  rarity,
  size = 54,
  className = "",
}: BadgeIconProps) {
  const palette = categoryPalettes[category] ?? categoryPalettes.founders;
  const ring = rarityRings[rarity] ?? rarityRings.common;
  const seed = hashString(`${slug}:${category}:${rarity}`);
  const glyph = glyphs[seed % glyphs.length];
  const rotation = (seed % 6) * 60;
  const showSideShards = seed % 2 === 0;
  const showTopOrbit = seed % 3 === 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <filter id={`badge-shadow-${slug}`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor={palette.glow} floodOpacity="0.65" />
        </filter>
      </defs>

      <g filter={`url(#badge-shadow-${slug})`}>
        <circle cx="50" cy="50" r="41" fill={ring} opacity="0.9" />
        {showSideShards ? (
          <>
            <polygon points="8,52 24,40 26,63 11,72" fill={palette.glow} opacity="0.8" />
            <polygon points="92,52 76,40 74,63 89,72" fill={palette.glow} opacity="0.8" />
          </>
        ) : null}
        <polygon points={hexPoints} fill={palette.shell} />
        <polygon points="50,14 80,31 80,65 50,82 20,65 20,31" fill={palette.core} />
        <polygon points="50,22 72,35 72,61 50,74 28,61 28,35" fill={palette.accentSoft} opacity="0.18" />

        {glyph === "diamond" ? (
          <>
            <polygon points={diamondPoints} fill={palette.accentSoft} />
            <polygon points="50,26 64,40 50,54 36,40" fill={palette.accent} />
          </>
        ) : null}

        {glyph === "hex" ? (
          <>
            <polygon points="50,24 66,33 66,49 50,58 34,49 34,33" fill={palette.accentSoft} />
            <polygon points="50,31 59,36 59,46 50,51 41,46 41,36" fill={palette.accent} />
          </>
        ) : null}

        {glyph === "star" ? (
          <>
            <polygon points="50,23 55,35 68,36 58,44 61,57 50,49 39,57 42,44 32,36 45,35" fill={palette.accent} />
            <circle cx="50" cy="41" r="5" fill={palette.accentSoft} />
          </>
        ) : null}

        {glyph === "triangle" ? (
          <>
            <polygon points={trianglePoints} fill={palette.accentSoft} />
            <polygon points="50,30 62,54 38,54" fill={palette.accent} />
          </>
        ) : null}

        {glyph === "crown" ? (
          <>
            <polygon points={crownPoints} fill={palette.accent} />
            <circle cx="34" cy="33" r="3" fill={palette.accentSoft} />
            <circle cx="50" cy="46" r="3" fill={palette.accentSoft} />
            <circle cx="66" cy="33" r="3" fill={palette.accentSoft} />
          </>
        ) : null}

        {glyph === "orbit" ? (
          <>
            <circle cx="50" cy="41" r="12" fill="none" stroke={palette.accentSoft} strokeWidth="5" />
            <circle cx="50" cy="41" r="4" fill={palette.accent} />
            <circle cx="61" cy="34" r="3.5" fill={palette.accentSoft} />
          </>
        ) : null}

        <g transform={`rotate(${rotation} 50 50)`}>
          <path d="M50 11 L54 18 L46 18 Z" fill={palette.shell} opacity="0.9" />
        </g>

        {showTopOrbit ? (
          <path
            d="M24 29 C38 13, 62 13, 76 29"
            fill="none"
            stroke={palette.glow}
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.85"
          />
        ) : null}
      </g>
    </svg>
  );
}
