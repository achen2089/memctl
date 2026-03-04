import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import type { Config } from "./config";
import { getDbPath, getIndexDir } from "./config";

/** A row from the chunks table, including optional embedding blob. */
export interface ChunkRow {
  id: number;
  file_path: string;
  chunk_index: number;
  content: string;
  start_line: number;
  end_line: number;
  embedding: Buffer | null;
}

/** FTS5 search result with BM25 rank score. */
export interface FtsRow extends ChunkRow {
  rank: number;
}

/**
 * Open (or create) the SQLite database with FTS5 and vector storage.
 * Sets up WAL mode, chunks table, FTS5 virtual table, and sync triggers.
 */
export function openDb(config: Config): Database {
  const indexDir = getIndexDir(config);
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }

  const db = new Database(getDbPath(config));
  db.run("PRAGMA journal_mode = WAL");

  db.run(`
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      embedding BLOB,
      UNIQUE(file_path, chunk_index)
    )
  `);

  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      content,
      file_path,
      content_rowid='id'
    )
  `);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, content, file_path) VALUES (new.id, new.content, new.file_path);
    END
  `);
  db.run(`
    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, content, file_path) VALUES ('delete', old.id, old.content, old.file_path);
    END
  `);
  db.run(`
    CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, content, file_path) VALUES ('delete', old.id, old.content, old.file_path);
      INSERT INTO chunks_fts(rowid, content, file_path) VALUES (new.id, new.content, new.file_path);
    END
  `);

  return db;
}

/** Drop all tables and triggers to prepare for a full rebuild. */
export function clearIndex(db: Database): void {
  db.run("DROP TRIGGER IF EXISTS chunks_ai");
  db.run("DROP TRIGGER IF EXISTS chunks_ad");
  db.run("DROP TRIGGER IF EXISTS chunks_au");
  db.run("DROP TABLE IF EXISTS chunks_fts");
  db.run("DROP TABLE IF EXISTS chunks");
}

/** Insert or replace a chunk in the database with optional embedding. */
export function insertChunk(
  db: Database,
  filePath: string,
  chunkIndex: number,
  content: string,
  startLine: number,
  endLine: number,
  embedding: Float32Array | null
): void {
  const embeddingBlob = embedding ? Buffer.from(embedding.buffer) : null;
  db.run(
    `INSERT OR REPLACE INTO chunks (file_path, chunk_index, content, start_line, end_line, embedding)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [filePath, chunkIndex, content, startLine, endLine, embeddingBlob]
  );
}

/**
 * Full-text search using FTS5 with prefix matching.
 * Each query term gets a `*` suffix for prefix matching (e.g. "det" matches "determinant").
 * Returns results ordered by BM25 rank.
 */
export function searchFts(db: Database, query: string, limit: number, scopePrefix?: string): FtsRow[] {
  // Tokenize, strip FTS5 special chars, add prefix matching
  const tokens = query
    .replace(/['"(){}[\]^~@!:]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t}"*`);
  if (tokens.length === 0) return [];
  const ftsQuery = tokens.join(" ");

  let sql = `
    SELECT c.id, c.file_path, c.chunk_index, c.content, c.start_line, c.end_line, c.embedding, f.rank
    FROM chunks_fts f
    JOIN chunks c ON c.id = f.rowid
    WHERE chunks_fts MATCH ?
  `;
  const params: (string | number)[] = [ftsQuery];

  if (scopePrefix) {
    sql += ` AND c.file_path LIKE ?`;
    params.push(`${scopePrefix}%`);
  }

  sql += ` ORDER BY f.rank LIMIT ?`;
  params.push(limit);

  return db.query(sql).all(...params) as FtsRow[];
}

/** Retrieve all chunks that have embeddings, optionally filtered by scope prefix. */
export function getAllChunksWithEmbeddings(db: Database, scopePrefix?: string): ChunkRow[] {
  let sql = `SELECT id, file_path, chunk_index, content, start_line, end_line, embedding FROM chunks WHERE embedding IS NOT NULL`;
  const params: string[] = [];

  if (scopePrefix) {
    sql += ` AND file_path LIKE ?`;
    params.push(`${scopePrefix}%`);
  }

  return db.query(sql).all(...params) as ChunkRow[];
}
