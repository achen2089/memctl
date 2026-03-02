import { readFileSync } from "fs";
import { extname } from "path";
import { $ } from "bun";

export async function extractText(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    return extractPdf(filePath);
  }

  // For .md, .txt, and any other text file
  return readFileSync(filePath, "utf-8");
}

async function extractPdf(filePath: string): Promise<string> {
  // Use pdftotext (poppler) — most reliable text extraction
  try {
    const result = await $`pdftotext -layout "${filePath}" -`.text();
    if (result.trim().length > 0) return result;
  } catch {}

  // Fallback to pdf-parse if pdftotext not available
  try {
    const { PDFParse } = await import("pdf-parse");
    const buffer = readFileSync(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    await parser.load();
    const result = await parser.getText();
    parser.destroy();

    if (result?.pages && Array.isArray(result.pages)) {
      return result.pages.map((p: any) => p.text).join("\n\n");
    }
  } catch {}

  throw new Error("Failed to extract text from PDF. Install poppler: brew install poppler");
}
