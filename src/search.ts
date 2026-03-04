import type { Database } from "bun:sqlite";
import type { Config } from "./config";
import type { ChunkRow } from "./db";
import { getAllChunksWithEmbeddings, searchFts } from "./db";
import { embed } from "./embed";

/** A search result with file path, matching content, score, and location. */
export interface SearchResult {
  filePath: string;
  content: string;
  score: number;
  startLine: number;
  endLine: number;
}

/** Search options for hybridSearch. */
export interface SearchOptions {
  limit: number;
  scope?: string;
  keywordOnly?: boolean;
}

/**
 * Compute cosine similarity between two embedding vectors.
 * Both vectors should be L2-normalized, so this is equivalent to dot product.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Perform hybrid search combining FTS5 keyword search and vector similarity.
 *
 * Scoring:
 * - FTS5 BM25 scores are normalized to 0-1 using rank inversion
 * - Vector cosine similarity (already -1 to 1 for normalized vectors) is mapped to 0-1
 * - Final score: 0.4 * fts + 0.6 * vector, scaled to 0-100%
 *
 * Deduplication: when multiple chunks from the same file match, only the
 * highest-scoring chunk is returned.
 */
export async function hybridSearch(
  db: Database,
  query: string,
  config: Config,
  options: SearchOptions
): Promise<SearchResult[]> {
  const scopePrefix = options.scope ? `scopes/${options.scope}/` : undefined;

  // FTS search — fetch more than needed for merging
  const ftsResults = searchFts(db, query, options.limit * 3, scopePrefix);
  const ftsMap = new Map<string, { content: string; score: number; startLine: number; endLine: number; filePath: string }>();

  // Normalize FTS BM25 ranks to 0-1.
  // FTS5 rank is negative (lower = better match). We invert and normalize.
  if (ftsResults.length > 0) {
    const ranks = ftsResults.map((r) => r.rank);
    const minRank = Math.min(...ranks); // best match (most negative)
    const maxRank = Math.max(...ranks); // worst match
    const range = maxRank - minRank;

    for (const r of ftsResults) {
      const key = `${r.file_path}:${r.chunk_index}`;
      // Invert: best rank (most negative) gets score 1.0
      const score = range === 0 ? 1.0 : (maxRank - r.rank) / range;
      ftsMap.set(key, {
        content: r.content,
        score,
        startLine: r.start_line,
        endLine: r.end_line,
        filePath: r.file_path,
      });
    }
  }

  if (options.keywordOnly || !config.embeddings_enabled) {
    return dedup(
      Array.from(ftsMap.entries()).map(([, val]) => ({
        filePath: val.filePath,
        content: val.content,
        score: val.score * 100,
        startLine: val.startLine,
        endLine: val.endLine,
      })),
      options.limit
    );
  }

  // Vector search
  const queryEmbedding = await embed(query, config);
  const allChunks = getAllChunksWithEmbeddings(db, scopePrefix);

  const vectorScores = new Map<string, { filePath: string; content: string; score: number; startLine: number; endLine: number }>();
  for (const chunk of allChunks) {
    if (!chunk.embedding) continue;
    const chunkEmbedding = new Float32Array(
      chunk.embedding.buffer,
      chunk.embedding.byteOffset,
      chunk.embedding.byteLength / 4
    );
    const sim = cosineSimilarity(queryEmbedding, chunkEmbedding);
    // Map cosine similarity from [-1, 1] to [0, 1]
    const normalizedSim = (sim + 1) / 2;
    const key = `${chunk.file_path}:${chunk.chunk_index}`;
    vectorScores.set(key, {
      filePath: chunk.file_path,
      content: chunk.content,
      score: normalizedSim,
      startLine: chunk.start_line,
      endLine: chunk.end_line,
    });
  }

  // Combine scores: 0.4 * FTS + 0.6 * vector
  const combined = new Map<string, SearchResult>();

  for (const [key, fts] of ftsMap) {
    const vec = vectorScores.get(key);
    const vecScore = vec ? vec.score : 0;
    const hybridScore = (0.4 * fts.score + 0.6 * vecScore) * 100;
    combined.set(key, {
      filePath: fts.filePath,
      content: fts.content,
      score: hybridScore,
      startLine: fts.startLine,
      endLine: fts.endLine,
    });
  }

  for (const [key, vec] of vectorScores) {
    if (!combined.has(key)) {
      const hybridScore = 0.6 * vec.score * 100;
      combined.set(key, {
        filePath: vec.filePath,
        content: vec.content,
        score: hybridScore,
        startLine: vec.startLine,
        endLine: vec.endLine,
      });
    }
  }

  const results = Array.from(combined.values());
  return dedup(results, options.limit);
}

/**
 * Deduplicate results: keep only the highest-scoring chunk per file,
 * then sort by score descending and limit.
 */
function dedup(results: SearchResult[], limit: number): SearchResult[] {
  const bestPerFile = new Map<string, SearchResult>();
  for (const r of results) {
    const existing = bestPerFile.get(r.filePath);
    if (!existing || r.score > existing.score) {
      bestPerFile.set(r.filePath, r);
    }
  }
  const sorted = Array.from(bestPerFile.values());
  sorted.sort((a, b) => b.score - a.score);
  return sorted.slice(0, limit);
}
