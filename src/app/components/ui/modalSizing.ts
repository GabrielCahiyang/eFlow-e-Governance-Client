const widths: Record<string, number> = {
  xs: 320, sm: 384, md: 448, lg: 512, xl: 576,
  '2xl': 672, '3xl': 768, '4xl': 896, '5xl': 1024, '6xl': 1152, '7xl': 1280,
};

/** Respect the feature's requested form width; the shell clamps it to the viewport. */
export function modalWidth(width: string): number {
  const custom = width.match(/max-w-\[(\d+)px\]/);
  if (custom) return Math.min(1600, Math.max(280, Number(custom[1])));
  const preset = width.match(/max-w-(7xl|6xl|5xl|4xl|3xl|2xl|xl|lg|md|sm|xs)\b/);
  return preset ? widths[preset[1]] : 512;
}
