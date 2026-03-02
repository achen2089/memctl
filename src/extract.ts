import { readFileSync } from "fs";
import { extname } from "path";

export async function extractText(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    return extractPdf(filePath);
  }

  // For .md, .txt, and any other text file
  return readFileSync(filePath, "utf-8");
}

async function extractPdf(filePath: string): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const buffer = readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}
