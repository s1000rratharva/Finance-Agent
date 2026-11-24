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

/** Muted, print-inspired series palette: stable across comparisons. */
export const CHART_COLORS = [
  "#B73C21", // vermilion
  "#1F4E79", // ink blue
  "#8A6200", // ochre
  "#176B4C", // forest
  "#6B3E6B", // plum
  "#4B5560", // slate
  "#9A4F2C", // sienna
  "#2F6F6B", // teal
];

export function colorForIndex(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]!;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
