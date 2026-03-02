export interface Chunk {
  text: string;
  startLine: number;
  endLine: number;
}

const TARGET_SIZE = 800;
const MIN_SIZE = 50;

export function chunkText(text: string): Chunk[] {
  const lines = text.split("\n");
  const chunks: Chunk[] = [];
  let current = "";
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Split on headings if current chunk has content
    if (line.startsWith("#") && current.trim().length >= MIN_SIZE) {
      chunks.push({
        text: current.trim(),
        startLine,
        endLine: i - 1,
      });
      current = "";
      startLine = i;
    }

    // Split on daily log entries (lines starting with "- **")
    // Each bullet entry becomes its own chunk for granular search
    if (line.startsWith("- **") && current.trim().length >= MIN_SIZE) {
      chunks.push({
        text: current.trim(),
        startLine,
        endLine: i - 1,
      });
      current = "";
      startLine = i;
    }

    current += line + "\n";

    // Split on paragraph boundaries when exceeding target
    if (current.length >= TARGET_SIZE && line.trim() === "") {
      chunks.push({
        text: current.trim(),
        startLine,
        endLine: i,
      });
      current = "";
      startLine = i + 1;
    }

    // Force split if a single chunk gets too big (2x target)
    if (current.length >= TARGET_SIZE * 2) {
      chunks.push({
        text: current.trim(),
        startLine,
        endLine: i,
      });
      current = "";
      startLine = i + 1;
    }
  }

  if (current.trim().length > 0) {
    chunks.push({
      text: current.trim(),
      startLine,
      endLine: lines.length - 1,
    });
  }

  return chunks;
}
