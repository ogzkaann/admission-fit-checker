import { extractPdfText, renderPdfToImages } from "./pdf";
import { ocrImage } from "./ocr";

// Below this many non-whitespace characters a PDF is treated as "scanned"
// and we fall back to OCR.
const OCR_MIN_CHARS = 120;
// Keep OCR bounded for MVP performance.
const OCR_MAX_PAGES = 5;

export interface DocumentExtractionResult {
  text: string;
  pageCount: number;
  usedOcr: boolean;
}

export type ExtractionStatus =
  | "reading-text"
  | "ocr-start"
  | "ocr-progress"
  | "done";

export interface ExtractionEvent {
  status: ExtractionStatus;
  message: string;
  page?: number;
  totalPages?: number;
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name);
}

function meaningfulLength(text: string): number {
  return text.replace(/\s/g, "").length;
}

// Extracts text from an uploaded document, falling back to local OCR when a
// PDF has no selectable text or when the upload is an image. Never contacts a
// backend or AI provider — OCR is fully client-side.
export async function extractDocument(
  file: File,
  onEvent?: (event: ExtractionEvent) => void,
): Promise<DocumentExtractionResult> {
  if (isImageFile(file)) {
    onEvent?.({ status: "ocr-start", message: "Image detected. Running OCR…" });
    const text = await ocrImage(file, (fraction) =>
      onEvent?.({ status: "ocr-progress", message: `Running OCR… ${Math.round(fraction * 100)}%` }),
    );
    onEvent?.({ status: "done", message: "OCR complete. Review extracted fields." });
    return { text, pageCount: 1, usedOcr: true };
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Unsupported file type. Upload a PDF, PNG, or JPG.");
  }

  onEvent?.({ status: "reading-text", message: "Reading selectable text…" });
  const extracted = await extractPdfText(file);
  if (meaningfulLength(extracted.text) >= OCR_MIN_CHARS) {
    onEvent?.({ status: "done", message: "Text extracted. Review fields below." });
    return { text: extracted.text, pageCount: extracted.pageCount, usedOcr: false };
  }

  onEvent?.({ status: "ocr-start", message: "No selectable text found. Running OCR…" });
  const canvases = await renderPdfToImages(file, OCR_MAX_PAGES);
  const parts: string[] = [];
  for (let index = 0; index < canvases.length; index += 1) {
    onEvent?.({
      status: "ocr-progress",
      message: `Running OCR… page ${index + 1} of ${canvases.length}`,
      page: index + 1,
      totalPages: canvases.length,
    });
    parts.push(await ocrImage(canvases[index]));
  }

  const text = parts.join("\n").trim();
  onEvent?.({ status: "done", message: "OCR complete. Review extracted fields." });
  return { text, pageCount: canvases.length, usedOcr: true };
}
