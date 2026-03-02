import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
import { parse, stringify } from "yaml";

export interface Config {
  memory_dir: string;
  embedding_model: string;
  embedding_dimensions: number;
  embeddings_enabled: boolean;
}

const CONFIG_DIR = join(homedir(), ".memctl");
const CONFIG_PATH = join(CONFIG_DIR, "config.yaml");

const DEFAULTS: Config = {
  memory_dir: join(homedir(), ".memctl", "memory"),
  embedding_model: "Xenova/all-MiniLM-L6-v2",
  embedding_dimensions: 384,
  embeddings_enabled: true,
};

function expandHome(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULTS };
  }
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = parse(raw) || {};
  return {
    memory_dir: resolve(expandHome(parsed.memory_dir ?? DEFAULTS.memory_dir)),
    embedding_model: parsed.embedding_model ?? DEFAULTS.embedding_model,
    embedding_dimensions: parsed.embedding_dimensions ?? DEFAULTS.embedding_dimensions,
    embeddings_enabled: parsed.embeddings_enabled ?? DEFAULTS.embeddings_enabled,
  };
}

export function saveConfig(config: Config): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const data = stringify({
    memory_dir: config.memory_dir,
    embedding_model: config.embedding_model,
    embedding_dimensions: config.embedding_dimensions,
    embeddings_enabled: config.embeddings_enabled,
  });
  writeFileSync(CONFIG_PATH, data, "utf-8");
}

export function getIndexDir(config: Config): string {
  return join(config.memory_dir, ".index");
}

export function getDbPath(config: Config): string {
  return join(getIndexDir(config), "memctl.db");
}
