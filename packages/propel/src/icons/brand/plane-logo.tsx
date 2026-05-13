/**
 * DBW Care Board – Brand Logo (three gradient dots)
 * Replaces the original Plane logo SVG component.
 */

import * as React from "react";

import type { ISvgIcons } from "../type";

export function PlaneLogo({ width = "85", height = "52", className }: ISvgIcons) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 85 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="16" cy="26" r="13" fill="url(#dbw-dot1)" />
      <circle cx="43" cy="26" r="13" fill="url(#dbw-dot2)" />
      <circle cx="70" cy="26" r="13" fill="url(#dbw-dot3)" />
      <defs>
        <linearGradient id="dbw-dot1" x1="3" y1="13" x2="29" y2="39">
          <stop stopColor="#ea2b1f" />
          <stop offset="1" stopColor="#ff3c6f" />
        </linearGradient>
        <linearGradient id="dbw-dot2" x1="30" y1="13" x2="56" y2="39">
          <stop stopColor="#ff3c6f" />
          <stop offset="1" stopColor="#ff4fdd" />
        </linearGradient>
        <linearGradient id="dbw-dot3" x1="57" y1="13" x2="83" y2="39">
          <stop stopColor="#7e56ff" />
          <stop offset="1" stopColor="#00b2ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}
