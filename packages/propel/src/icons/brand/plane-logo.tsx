/**
 * DBW Care Board – Brand Logo
 * Replaces the original Plane logo SVG component with the DBW Media logo image.
 * Uses public/ assets with dynamic base path for compatibility across all apps.
 */

import type { ISvgIcons } from "../type";

function getBasePath() {
  try {
    return import.meta.env?.BASE_URL ?? "/";
  } catch {
    return "/";
  }
}

export function PlaneLogo({ height = "52", className }: ISvgIcons) {
  const h = typeof height === "string" ? height : String(height);
  const base = getBasePath();
  const black = `${base}logo_black_croped.webp`;
  const white = `${base}logo_white_croped.webp`;
  return (
    <>
      <img
        src={black}
        alt="DBW Care Board"
        style={{ height: `${h}px`, width: "auto" }}
        className={`dark:hidden ${className ?? ""}`}
      />
      <img
        src={white}
        alt="DBW Care Board"
        style={{ height: `${h}px`, width: "auto" }}
        className={`hidden dark:block ${className ?? ""}`}
      />
    </>
  );
}
