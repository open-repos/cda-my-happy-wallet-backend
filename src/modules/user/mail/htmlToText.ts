const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
};

const decodeEntities = (value: string): string =>
  value.replace(
    /&(amp|lt|gt|quot|#39|nbsp);/g,
    (_, name: string) => ENTITIES[name]
  );

/**
 * Plain-text alternative of the transactional emails, which are simple
 * hand-written HTML. Links keep their address in clear for text-only clients.
 */
export const htmlToText = (html: string): string => {
  const withLinks = html.replace(
    /<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, href: string, label: string) => {
      // Entities are decoded once, on the whole text below.
      const text = label.replace(/<[^>]*>/g, "").trim();
      return !text || text === href ? `<br>${href}` : `${text}<br>${href}`;
    }
  );
  const text = decodeEntities(
    // Source line breaks are plain whitespace in HTML: only <br> and </p> break lines.
    withLinks
      .replace(/\s+/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]*>/g, "")
  );
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
