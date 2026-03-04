import type { Config } from "./config";
import type { Pipeline } from "@huggingface/transformers";

let pipelineFn: typeof import("@huggingface/transformers").pipeline | null = null;
let extractor: Pipeline | null = null;

/** Lazy-load the HuggingFace feature-extraction pipeline. */
async function getExtractor(config: Config): Promise<Pipeline> {
  if (extractor) return extractor;
  if (!pipelineFn) {
    const mod = await import("@huggingface/transformers");
    pipelineFn = mod.pipeline;
  }
  extractor = await pipelineFn("feature-extraction", config.embedding_model, {
    dtype: "fp32",
  });
  return extractor;
}

/**
 * Generate an embedding vector for a single text string.
 * Uses mean pooling and L2 normalization via the configured model.
 */
export async function embed(text: string, config: Config): Promise<Float32Array> {
  const ext = await getExtractor(config);
  const output = await ext(text, { pooling: "mean", normalize: true });
  return new Float32Array(output.data as Float32Array);
}

/**
 * Generate embeddings for multiple texts sequentially.
 * Each text is embedded independently to avoid memory pressure.
 */
export async function embedBatch(texts: string[], config: Config): Promise<Float32Array[]> {
  const results: Float32Array[] = [];
  for (const text of texts) {
    results.push(await embed(text, config));
  }
  return results;
}
