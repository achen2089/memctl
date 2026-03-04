/** A single chunk of text with its source location. */
export interface Chunk {
  text: string;
  startLine: number;
  endLine: number;
}

/**
 * Chunk text into granular, search-friendly pieces.
 *
 * Splitting strategy (in priority order):
 * 1. Daily log bullets (`- **HH:MM** ...`) — each entry is its own chunk
 * 2. Markdown headings (`# `, `## `, etc.) — each section is its own chunk
 * 3. Horizontal rules (`---`) — split on separators
 * 4. Paragraph boundaries — split long prose at blank lines (~800 chars)
 * 5. Force split — if a chunk exceeds 1600 chars
 *
 * Heading context is prefixed to chunks so embeddings understand the section.
 * Small chunks (even single sentences) are valid — don't merge just for size.
 */
export function chunkText(text: string): Chunk[] {
  const lines = text.split("\n");
  const chunks: Chunk[] = [];

  // First pass: identify the structure
  const isDailyLog = lines.some((l) => /^- \*\*\d{1,2}:\d{2}\*\*/.test(l));

  if (isDailyLog) {
    return chunkDailyLog(lines);
  }

  return chunkGeneral(lines);
}

/**
 * Chunk a daily log file where each `- **HH:MM** ...` bullet is its own chunk.
 * The date heading (e.g. `# 2026-03-01`) is prefixed to each chunk for context.
 */
function chunkDailyLog(lines: string[]): Chunk[] {
  const chunks: Chunk[] = [];
  let dateContext = "";

  // Find the date heading
  for (const line of lines) {
    if (line.startsWith("# ")) {
      dateContext = line.replace(/^#+\s*/, "").trim();
      break;
    }
  }

  let currentEntry = "";
  let startLine = 0;
  let inEntry = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip the date heading line itself
    if (line.startsWith("# ") && !inEntry) {
      continue;
    }

    // New bullet entry starts
    if (/^- \*\*\d{1,2}:\d{2}\*\*/.test(line)) {
      // Flush previous entry
      if (inEntry && currentEntry.trim().length > 0) {
        const chunkText = dateContext
          ? `${dateContext}: ${currentEntry.trim()}`
          : currentEntry.trim();
        chunks.push({ text: chunkText, startLine, endLine: i - 1 });
      }
      currentEntry = line;
      startLine = i;
      inEntry = true;
      continue;
    }

    // Continuation line (indented or blank within an entry)
    if (inEntry) {
      currentEntry += "\n" + line;
    }
  }

  // Flush last entry
  if (inEntry && currentEntry.trim().length > 0) {
    const chunkText = dateContext
      ? `${dateContext}: ${currentEntry.trim()}`
      : currentEntry.trim();
    chunks.push({ text: chunkText, startLine, endLine: lines.length - 1 });
  }

  return chunks;
}

/**
 * Chunk general markdown files by headings, horizontal rules, and paragraph boundaries.
 * Each heading section becomes its own chunk, with the heading prefixed for context.
 */
function chunkGeneral(lines: string[]): Chunk[] {
  const TARGET_SIZE = 800;
  const MAX_SIZE = 1600;
  const chunks: Chunk[] = [];

  // Track current heading context for prefixing
  let currentHeading = "";
  let currentLines: string[] = [];
  let startLine = 0;

  function flush(endLine: number): void {
    const raw = currentLines.join("\n").trim();
    if (raw.length === 0) return;

    // Prefix with heading context if the chunk doesn't already start with it
    let chunkText = raw;
    if (currentHeading && !raw.startsWith(currentHeading)) {
      const headingPlain = currentHeading.replace(/^#+\s*/, "");
      if (!raw.startsWith(headingPlain)) {
        chunkText = `${headingPlain}: ${raw}`;
      }
    }

    chunks.push({ text: chunkText, startLine, endLine });
    currentLines = [];
    startLine = endLine + 1;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Split on headings
    if (/^#{1,6}\s/.test(line)) {
      flush(i - 1);
      currentHeading = line;
      currentLines = [line];
      startLine = i;
      continue;
    }

    // Split on horizontal rules (---, ***, ___)
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush(i - 1);
      startLine = i + 1;
      continue;
    }

    currentLines.push(line);

    // Split on paragraph boundaries when exceeding target size
    const currentSize = currentLines.join("\n").length;
    if (currentSize >= TARGET_SIZE && line.trim() === "") {
      flush(i);
      continue;
    }

    // Force split if too large
    if (currentSize >= MAX_SIZE) {
      flush(i);
    }
  }

  flush(lines.length - 1);
  return chunks;
}
