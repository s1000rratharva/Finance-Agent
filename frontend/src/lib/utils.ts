import { clsx, type ClassValue } from "clsx";

/** Merge Tailwind classes (shadcn-style `cn` helper). */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Initials for avatar fallbacks: "Reliance Industries" -> "RI". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/** Deterministic hue for a company slug so chart colours stay stable. */
export function slugHue(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 360;
  }
  return hash;
}

export const CHART_COLORS = [
  "#34d3aa", // brand green
  "#60a5fa", // blue
  "#fbbf24", // amber
  "#c084fc", // violet
  "#fb7185", // rose
  "#22d3ee", // cyan
  "#a3e635", // lime
  "#f472b6", // pink
];

export function colorForIndex(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]!;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
