import {
  AutoProcessor,
  AutoTokenizer,
  CLIPVisionModelWithProjection,
  CLIPTextModelWithProjection,
  RawImage,
  env,
} from "@huggingface/transformers";
import path from "node:path";
export const VISUAL_MODEL = "Xenova/clip-vit-base-patch32";
export const VISUAL_DIMENSIONS = 512;
env.cacheDir = path.resolve(process.env.MODEL_CACHE_DIR || "work/models");
let vision:
  | Promise<{
      processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
      model: CLIPVisionModelWithProjection;
    }>
  | undefined;
let text:
  | Promise<{
      tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
      model: CLIPTextModelWithProjection;
    }>
  | undefined;
export function normalizedRows(
  data: Float32Array,
  dimensions = VISUAL_DIMENSIONS,
) {
  const output = Float32Array.from(data);
  for (let start = 0; start < output.length; start += dimensions) {
    let norm = 0;
    for (let d = 0; d < dimensions; d++) norm += output[start + d] ** 2;
    norm = Math.sqrt(norm) || 1;
    for (let d = 0; d < dimensions; d++) output[start + d] /= norm;
  }
  return output;
}
export async function embedImage(source: string) {
  vision ||= Promise.all([
    AutoProcessor.from_pretrained(VISUAL_MODEL),
    CLIPVisionModelWithProjection.from_pretrained(VISUAL_MODEL, {
      dtype: "q8",
    }),
  ]).then(([processor, model]) => ({ processor, model }));
  const { processor, model } = await vision;
  const image = await RawImage.read(source);
  const result = await model(await processor(image));
  return normalizedRows(result.image_embeds.data as Float32Array);
}
export async function embedVisualText(queries: string[]) {
  text ||= Promise.all([
    AutoTokenizer.from_pretrained(VISUAL_MODEL),
    CLIPTextModelWithProjection.from_pretrained(VISUAL_MODEL, { dtype: "q8" }),
  ]).then(([tokenizer, model]) => ({ tokenizer, model }));
  const { tokenizer, model } = await text;
  const result = await model(
    tokenizer(queries, { padding: true, truncation: true }),
  );
  return normalizedRows(result.text_embeds.data as Float32Array);
}
