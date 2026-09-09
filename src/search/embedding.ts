import { pipeline, env } from "@huggingface/transformers";
import path from "node:path";
export const MODEL = "Xenova/bge-small-en-v1.5";
export const DIMENSIONS = 384;
export const QUERY_PREFIX =
  "Represent this sentence for searching relevant passages: ";
env.cacheDir = path.resolve(process.env.MODEL_CACHE_DIR || "work/models");
let encoder: ReturnType<typeof pipeline<"feature-extraction">> | undefined;
export async function embed(
  text: string | string[],
  query = false,
): Promise<Float32Array> {
  encoder ||= pipeline("feature-extraction", MODEL, { dtype: "q8" });
  const model = await encoder;
  const input = query ? QUERY_PREFIX + text : text;
  const output = await model(input, { pooling: "cls", normalize: true });
  return Float32Array.from(output.data as Float32Array);
}
