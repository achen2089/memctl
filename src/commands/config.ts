import { loadConfig, getConfigPath } from "../config";

export async function configCommand(): Promise<void> {
  const config = loadConfig();
  const configPath = getConfigPath();

  console.log(`Config file: ${configPath}`);
  console.log();
  console.log(`  memory_dir:           ${config.memory_dir}`);
  console.log(`  embedding_model:      ${config.embedding_model}`);
  console.log(`  embedding_dimensions: ${config.embedding_dimensions}`);
  console.log(`  embeddings_enabled:   ${config.embeddings_enabled}`);
}
