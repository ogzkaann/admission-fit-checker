import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdfText {
  text: string;
  pages: ExtractedPdfPage[];
  pageCount: number;
}

async function toArrayBuffer(input: File | Blob | ArrayBuffer): Promise<ArrayBuffer> {
  if (input instanceof ArrayBuffer) return input;
  return input.arrayBuffer();
}

export async function extractPdfText(input: File | Blob | ArrayBuffer): Promise<ExtractedPdfText> {
  const data = await toArrayBuffer(input);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: ExtractedPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({ pageNumber, text });
  }

  return {
    pages,
    pageCount: pdf.numPages,
    text: pages.map((page) => page.text).join("\n\n"),
  };
}

// Renders the first `maxPages` pages of a PDF to canvases, for OCR fallback
// when a PDF has no (or too little) selectable text.
export async function renderPdfToImages(
  input: File | Blob | ArrayBuffer,
  maxPages = 5,
  scale = 2,
): Promise<HTMLCanvasElement[]> {
  const data = await toArrayBuffer(input);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const canvases: HTMLCanvasElement[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) continue;
    await page.render({ canvasContext: context, viewport }).promise;
    canvases.push(canvas);
  }

  return canvases;
}

export async function fetchAndExtractPdf(filePath: string): Promise<ExtractedPdfText> {
  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`PDF unavailable at ${filePath} (${response.status})`);
  }

  const blob = await response.blob();
  return extractPdfText(blob);
}

export async function fetchAndExtractText(filePath: string): Promise<ExtractedPdfText> {
  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`Text source unavailable at ${filePath} (${response.status})`);
  }

  const text = await response.text();
  return {
    pages: [{ pageNumber: 1, text }],
    pageCount: 1,
    text,
  };
}
