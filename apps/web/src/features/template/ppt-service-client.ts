import { z } from "zod";

const geometrySchema = z.object({
  xEmu: z.number().int(),
  yEmu: z.number().int(),
  widthEmu: z.number().int(),
  heightEmu: z.number().int()
});

const styleSchema = z.object({
  fontFamily: z.string().nullable(),
  fontSizePoints: z.number().nullable(),
  fontColor: z.string().nullable(),
  bold: z.boolean(),
  italic: z.boolean(),
  underlined: z.boolean(),
  textAlign: z.string().nullable(),
  lineSpacing: z.number().nullable()
});

const placeholderSchema = z.object({
  key: z.string().min(1),
  occurrenceIndex: z.number().int().nonnegative(),
  shapeId: z.number().int(),
  shapeName: z.string().nullable(),
  shapeType: z.string(),
  containerType: z.enum(["TEXT_SHAPE", "TABLE_CELL"]),
  paragraphIndex: z.number().int().nonnegative(),
  startRunIndex: z.number().int().nonnegative(),
  startOffset: z.number().int().nonnegative(),
  endRunIndex: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  tableRow: z.number().int().nonnegative().nullable(),
  tableColumn: z.number().int().nonnegative().nullable(),
  originalText: z.string(),
  geometry: geometrySchema,
  style: styleSchema
});

const shapeSchema = z.object({
  shapeId: z.number().int(),
  shapeName: z.string().nullable(),
  shapeType: z.string(),
  geometry: geometrySchema,
  text: z.string().nullable()
});

const parseResponseSchema = z.object({
  fileId: z.string(),
  parserVersion: z.string(),
  widthEmu: z.number().int().positive(),
  heightEmu: z.number().int().positive(),
  slides: z.array(
    z.object({
      slideIndex: z.number().int().nonnegative(),
      widthEmu: z.number().int().positive(),
      heightEmu: z.number().int().positive(),
      shapes: z.array(shapeSchema),
      placeholders: z.array(placeholderSchema)
    })
  ),
  warnings: z.array(z.string())
});

export type PptParseResponse = z.infer<typeof parseResponseSchema>;

const renderResponseSchema = z.object({
  fileId: z.string(),
  outputFormat: z.literal("PNG"),
  pageCount: z.number().int().positive(),
  files: z.array(
    z.object({
      slideIndex: z.number().int().nonnegative(),
      relativePath: z.string().startsWith("previews/"),
      mimeType: z.literal("image/png"),
      sizeBytes: z.number().int().positive(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/)
    })
  ),
  warnings: z.array(z.string())
});

export type PptRenderResponse = z.infer<typeof renderResponseSchema>;

function serviceConfiguration() {
  const serviceUrl = process.env.PPT_SERVICE_URL?.trim();
  const apiKey = process.env.PPT_SERVICE_API_KEY?.trim();
  if (!serviceUrl || !apiKey) {
    throw new Error("PPT Service connection is not configured");
  }
  return { serviceUrl, apiKey };
}

export async function parseTemplate(params: {
  fileId: string;
  relativePath: string;
  sha256: string;
}): Promise<PptParseResponse> {
  const { serviceUrl, apiKey } = serviceConfiguration();

  const response = await fetch(new URL("/ppt/parse", serviceUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Api-Key": apiKey
    },
    body: JSON.stringify(params),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000)
  });

  if (!response.ok) {
    const responseText = (await response.text()).slice(0, 1_000);
    throw new Error(`PPT Service parse failed (${response.status}): ${responseText}`);
  }

  const result = parseResponseSchema.parse(await response.json());
  if (result.fileId !== params.fileId) {
    throw new Error("PPT Service returned metadata for an unexpected file");
  }
  return result;
}

export async function renderTemplate(params: {
  fileId: string;
  templateId: string;
  relativePath: string;
  sha256: string;
  idempotencyKey: string;
}): Promise<PptRenderResponse> {
  const { serviceUrl, apiKey } = serviceConfiguration();
  const response = await fetch(new URL("/ppt/render", serviceUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Api-Key": apiKey
    },
    body: JSON.stringify({ ...params, outputFormat: "PNG" }),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000)
  });

  if (!response.ok) {
    const responseText = (await response.text()).slice(0, 1_000);
    throw new Error(`PPT Service render failed (${response.status}): ${responseText}`);
  }

  const result = renderResponseSchema.parse(await response.json());
  if (result.fileId !== params.fileId || result.pageCount !== result.files.length) {
    throw new Error("PPT Service returned inconsistent preview metadata");
  }
  return result;
}

export async function renderStaticPreview(params: {
  relativePath: string;
  sha256: string;
  slideIndex: number;
}): Promise<Buffer> {
  return renderPngPreview("/ppt/render-static", params);
}

export async function renderDraftPreview(params: {
  relativePath: string;
  sha256: string;
  slideIndex: number;
  values: { key: string; occurrenceIndex: number; valueText: string }[];
}): Promise<Buffer> {
  return renderPngPreview("/ppt/render-draft", params);
}

async function renderPngPreview(endpoint: string, params: object): Promise<Buffer> {
  const { serviceUrl, apiKey } = serviceConfiguration();
  const response = await fetch(new URL(endpoint, serviceUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Api-Key": apiKey
    },
    body: JSON.stringify(params),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000)
  });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png")) {
    throw new Error(`PPT Service preview failed (${response.status})`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error("PPT Service returned an invalid PNG");
  }
  return bytes;
}
