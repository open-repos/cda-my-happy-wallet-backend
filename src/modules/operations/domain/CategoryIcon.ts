import allowlist from "./categoryIcons.json";

/**
 * Icône Font Awesome 6 Free d'une catégorie, au format `<style>:<nom>`.
 * La liste autorisée est l'intersection Web et mobile générée par
 * `scripts/generate-category-icons.js`.
 */
const allowed: Readonly<Record<string, ReadonlySet<string>>> = {
  solid: new Set(allowlist.solid),
  regular: new Set(allowlist.regular),
};

export const CATEGORY_ICON_PATTERN = /^(solid|regular):([a-z0-9-]+)$/;

export const isCategoryIcon = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const match = CATEGORY_ICON_PATTERN.exec(value);
  return match !== null && allowed[match[1]].has(match[2]);
};
