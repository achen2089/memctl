import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import type { Config } from "./config";
import { getDbPath, getIndexDir } from "./config";

export function openDb(config: Config): Database {
  const indexDir = getIndexDir(config);
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }

  const db = new Database(getDbPath(config));
  db.run("PRAGMA journal_mode = WAL");

  // Chunks table: stores text chunks with their file path and embedding
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

  // FTS5 virtual table for full-text search
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      content,
      file_path,
      content_rowid='id'
    )
  `);

  // Triggers to keep FTS in sync
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

export function clearIndex(db: Database): void {
  db.run("DELETE FROM chunks");
}

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

export interface ChunkRow {
  id: number;
  file_path: string;
  chunk_index: number;
  content: string;
  start_line: number;
  end_line: number;
  embedding: Buffer | null;
}

export function searchFts(db: Database, query: string, limit: number, scopePrefix?: string): ChunkRow[] {
  // Escape FTS5 special characters and create a simple query
  const safeQuery = query.replace(/['"*()]/g, " ").trim();
  if (!safeQuery) return [];

  let sql = `
    SELECT c.id, c.file_path, c.chunk_index, c.content, c.start_line, c.end_line, c.embedding
    FROM chunks_fts f
    JOIN chunks c ON c.id = f.rowid
    WHERE chunks_fts MATCH ?
  `;
  const params: any[] = [safeQuery];

  if (scopePrefix) {
    sql += ` AND c.file_path LIKE ?`;
    params.push(`${scopePrefix}%`);
  }

  sql += ` ORDER BY rank LIMIT ?`;
  params.push(limit);

  return db.query(sql).all(...params) as ChunkRow[];
}

export function getAllChunksWithEmbeddings(db: Database, scopePrefix?: string): ChunkRow[] {
  let sql = `SELECT id, file_path, chunk_index, content, start_line, end_line, embedding FROM chunks WHERE embedding IS NOT NULL`;
  const params: any[] = [];

  if (scopePrefix) {
    sql += ` AND file_path LIKE ?`;
    params.push(`${scopePrefix}%`);
  }

  return db.query(sql).all(...params) as ChunkRow[];
}
