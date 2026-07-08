import Tesseract from "tesseract.js";

// Client-side OCR. Everything runs locally in the browser via WebAssembly.
// No document bytes are ever sent to an AI provider or any backend of ours.
// (Tesseract's language model is fetched from a public CDN on first use.)

export type OcrProgress = (fraction: number) => void;

type OcrSource = File | Blob | HTMLCanvasElement | string;

export async function ocrImage(source: OcrSource, onProgress?: OcrProgress): Promise<string> {
  const { data } = await Tesseract.recognize(source, "eng", {
    logger: (message) => {
      if (message.status === "recognizing text" && onProgress) {
        onProgress(message.progress);
      }
    },
  });
  return (data.text ?? "").trim();
}
