// Preserve line boundaries so labeled fields and transcript rows do not merge.
export function textFromPdfItems(items: readonly unknown[]): string {
  let text = "";
  let previousY: number | undefined;
  for (const item of items) {
    if (!item || typeof item !== "object" || !("str" in item) || typeof item.str !== "string") continue;
    const value = item as { str: string; hasEOL?: boolean; transform?: number[] };
    const y = value.transform?.[5];
    if (previousY !== undefined && y !== undefined && Math.abs(y - previousY) > 2 && !text.endsWith("\n")) text += "\n";
    text += value.str + (value.hasEOL ? "\n" : " ");
    previousY = y;
  }
  return text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}
