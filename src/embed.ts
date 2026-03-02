import type { Config } from "./config";

let pipeline: any = null;
let extractor: any = null;

async function getExtractor(config: Config) {
  if (extractor) return extractor;
  if (!pipeline) {
    const mod = await import("@huggingface/transformers");
    pipeline = mod.pipeline;
  }
  extractor = await pipeline("feature-extraction", config.embedding_model, {
    dtype: "fp32",
  });
  return extractor;
}

export async function embed(text: string, config: Config): Promise<Float32Array> {
  const ext = await getExtractor(config);
  const output = await ext(text, { pooling: "mean", normalize: true });
  return new Float32Array(output.data);
}

export async function embedBatch(texts: string[], config: Config): Promise<Float32Array[]> {
  const results: Float32Array[] = [];
  for (const text of texts) {
    results.push(await embed(text, config));
  }
  return results;
}
