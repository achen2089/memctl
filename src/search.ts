import type { Database } from "bun:sqlite";
import type { Config } from "./config";
import type { ChunkRow } from "./db";
import { getAllChunksWithEmbeddings, searchFts } from "./db";
import { embed } from "./embed";

export interface SearchResult {
  filePath: string;
  content: string;
  score: number;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function hybridSearch(
  db: Database,
  query: string,
  config: Config,
  options: { limit: number; scope?: string; keywordOnly?: boolean }
): Promise<SearchResult[]> {
  const scopePrefix = options.scope ? `scopes/${options.scope}/` : undefined;

  // FTS search
  const ftsResults = searchFts(db, query, options.limit * 2, scopePrefix);
  const ftsMap = new Map<string, { content: string; score: number }>();

  // Normalize FTS scores to 0-1 range
  const maxFtsRank = ftsResults.length > 0 ? Math.max(...ftsResults.map((_, i) => ftsResults.length - i)) : 1;
  for (let i = 0; i < ftsResults.length; i++) {
    const r = ftsResults[i];
    const key = `${r.file_path}:${r.chunk_index}`;
    const score = (ftsResults.length - i) / maxFtsRank;
    ftsMap.set(key, { content: r.content, score });
  }

  if (options.keywordOnly || !config.embeddings_enabled) {
    // Return FTS-only results
    const results: SearchResult[] = [];
    for (const [, value] of ftsMap) {
      results.push({
        filePath: ftsResults[results.length]?.file_path ?? "",
        content: value.content,
        score: value.score * 100,
      });
    }
    return results.slice(0, options.limit);
  }

  // Vector search
  const queryEmbedding = await embed(query, config);
  const allChunks = getAllChunksWithEmbeddings(db, scopePrefix);

  const vectorScores = new Map<string, { filePath: string; content: string; score: number }>();
  for (const chunk of allChunks) {
    if (!chunk.embedding) continue;
    const chunkEmbedding = new Float32Array(
      chunk.embedding.buffer,
      chunk.embedding.byteOffset,
      chunk.embedding.byteLength / 4
    );
    const sim = cosineSimilarity(queryEmbedding, chunkEmbedding);
    const key = `${chunk.file_path}:${chunk.chunk_index}`;
    vectorScores.set(key, {
      filePath: chunk.file_path,
      content: chunk.content,
      score: sim,
    });
  }

  // Combine scores: 0.4 * FTS + 0.6 * vector
  const combined = new Map<string, SearchResult>();

  for (const [key, fts] of ftsMap) {
    const vec = vectorScores.get(key);
    const ftsScore = fts.score;
    const vecScore = vec ? vec.score : 0;
    const hybridScore = 0.4 * ftsScore + 0.6 * vecScore;
    combined.set(key, {
      filePath: ftsResults.find((r) => `${r.file_path}:${r.chunk_index}` === key)?.file_path ?? "",
      content: fts.content,
      score: hybridScore * 100,
    });
  }

  for (const [key, vec] of vectorScores) {
    if (!combined.has(key)) {
      const hybridScore = 0.6 * vec.score;
      combined.set(key, {
        filePath: vec.filePath,
        content: vec.content,
        score: hybridScore * 100,
      });
    }
  }

  const results = Array.from(combined.values());
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, options.limit);
}
