import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { loadConfig } from "../config";
import { openDb, clearIndex, insertChunk } from "../db";
import { chunkText } from "../chunk";
import { embed } from "../embed";

function walkMd(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkMd(fullPath));
    } else if (entry.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

export async function rebuildCommand(): Promise<void> {
  const config = loadConfig();
  const memDir = config.memory_dir;

  if (!existsSync(memDir)) {
    console.error(`Memory directory not found: ${memDir}. Run 'memctl init' first.`);
    process.exit(1);
  }

  console.log("Rebuilding search index...");
  const db = openDb(config);

  try {
    clearIndex(db);

    const mdFiles = walkMd(memDir);
    console.log(`Found ${mdFiles.length} markdown file(s).`);

    let totalChunks = 0;
    for (const filePath of mdFiles) {
      const relativePath = relative(memDir, filePath);
      const content = readFileSync(filePath, "utf-8");
      const chunks = chunkText(content);

      for (let i = 0; i < chunks.length; i++) {
        let embedding: Float32Array | null = null;
        if (config.embeddings_enabled) {
          embedding = await embed(chunks[i].text, config);
        }
        insertChunk(db, relativePath, i, chunks[i].text, chunks[i].startLine, chunks[i].endLine, embedding);
        totalChunks++;
      }

      console.log(`  Indexed ${relativePath} (${chunks.length} chunks)`);
    }

    console.log(`\nRebuild complete. ${totalChunks} chunks indexed.`);
  } finally {
    db.close();
  }
}
