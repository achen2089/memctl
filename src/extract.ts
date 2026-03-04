import { readFileSync } from "fs";
import { extname } from "path";
import { $ } from "bun";

/**
 * Extract text content from a file.
 * Supports PDF (via pdftotext or pdf-parse fallback) and any text file.
 */
export async function extractText(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    return extractPdf(filePath);
  }

  return readFileSync(filePath, "utf-8");
}

/** Extract text from a PDF using pdftotext (poppler) with pdf-parse fallback. */
async function extractPdf(filePath: string): Promise<string> {
  // Use pdftotext (poppler) — most reliable text extraction
  try {
    const result = await $`pdftotext -layout "${filePath}" -`.text();
    if (result.trim().length > 0) return result;
  } catch {
    // pdftotext not available, try fallback
  }

  // Fallback to pdf-parse if pdftotext not available
  try {
    const { PDFParse } = await import("pdf-parse");
    const buffer = readFileSync(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    await parser.load();
    const result = await parser.getText();
    parser.destroy();

    if (result?.pages && Array.isArray(result.pages)) {
      return result.pages
        .map((p: { text: string }) => p.text)
        .join("\n\n");
    }
  } catch {
    // pdf-parse also failed
  }

  throw new Error("Failed to extract text from PDF. Install poppler: brew install poppler");
}
