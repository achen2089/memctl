export interface Chunk {
  text: string;
  startLine: number;
  endLine: number;
}

const TARGET_SIZE = 1000;
const MIN_SIZE = 200;

export function chunkText(text: string): Chunk[] {
  const lines = text.split("\n");
  const chunks: Chunk[] = [];
  let current = "";
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start a new chunk on heading boundaries if current is big enough
    if (line.startsWith("#") && current.length >= MIN_SIZE) {
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
