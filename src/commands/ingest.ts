import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "fs";
import { basename, extname, join } from "path";
import { loadConfig } from "../config";
import { openDb, insertChunk } from "../db";
import { extractText } from "../extract";
import { chunkText } from "../chunk";
import { embed } from "../embed";

export async function ingestCommand(
  filePath: string,
  options: { scope?: string }
): Promise<void> {
  const config = loadConfig();

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath, ext);
  const isPdf = ext === ".pdf";

  // Determine target directory
  let targetDir: string;
  if (options.scope) {
    targetDir = join(config.memory_dir, "scopes", options.scope, "documents");
  } else {
    targetDir = join(config.memory_dir, "documents");
  }

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Extract text
  console.log(`Extracting text from ${basename(filePath)}...`);
  const text = await extractText(filePath);

  // For PDFs, copy the original and create markdown sidecar
  if (isPdf) {
    const pdfDest = join(targetDir, `${name}.pdf`);
    copyFileSync(filePath, pdfDest);
    console.log(`Copied PDF to ${pdfDest}`);
  }

  const mdPath = join(targetDir, `${name}.md`);
  writeFileSync(mdPath, `# ${name}\n\n${text}`, "utf-8");
  console.log(`Created ${mdPath}`);

  // Index the content
  const db = openDb(config);
  try {
    const relativePath = mdPath.replace(config.memory_dir + "/", "");
    const chunks = chunkText(text);
    console.log(`Indexing ${chunks.length} chunk(s)...`);

    for (let i = 0; i < chunks.length; i++) {
      let embedding: Float32Array | null = null;
      if (config.embeddings_enabled) {
        embedding = await embed(chunks[i].text, config);
      }
      insertChunk(db, relativePath, i, chunks[i].text, chunks[i].startLine, chunks[i].endLine, embedding);
    }

    console.log("Ingestion complete.");
  } finally {
    db.close();
  }
}
