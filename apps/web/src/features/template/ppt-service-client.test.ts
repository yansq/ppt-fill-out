import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateReport, parseTemplate, renderDraftPreview, renderStaticPreview, renderTemplate } from "./ppt-service-client";

const originalEnvironment = { ...process.env };

describe("PPT Service client", () => {
  beforeEach(() => {
    process.env.PPT_SERVICE_URL = "http://ppt-service.test";
    process.env.PPT_SERVICE_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    vi.restoreAllMocks();
  });

  it("accepts consistent parse metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          fileId: "file-1",
          parserVersion: "1.0.0",
          widthEmu: 100,
          heightEmu: 100,
          slides: [],
          warnings: []
        })
      )
    );

    await expect(
      parseTemplate({ fileId: "file-1", relativePath: "templates/a/a.pptx", sha256: "0".repeat(64) })
    ).resolves.toMatchObject({ fileId: "file-1", parserVersion: "1.0.0" });
  });

  it("rejects preview metadata for a different file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          fileId: "unexpected-file",
          outputFormat: "PNG",
          pageCount: 1,
          files: [
            {
              slideIndex: 0,
              relativePath: "previews/template/slide-1.png",
              mimeType: "image/png",
              sizeBytes: 100,
              sha256: "a".repeat(64)
            }
          ],
          warnings: []
        })
      )
    );

    await expect(
      renderTemplate({
        fileId: "file-1",
        templateId: "42c78fd1-4c8d-48af-94d7-ed0d874e9c40",
        relativePath: "templates/a/a.pptx",
        sha256: "0".repeat(64),
        idempotencyKey: "render-1"
      })
    ).rejects.toThrow("inconsistent preview metadata");
  });

  it("accepts only PNG bytes from the static preview endpoint", async () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(png, {
      headers: { "Content-Type": "image/png" }
    })));
    await expect(renderStaticPreview({
      relativePath: "templates/a/a.pptx", sha256: "0".repeat(64), slideIndex: 1
    })).resolves.toEqual(png);
    expect(fetch).toHaveBeenCalledWith(new URL("/ppt/render-static", "http://ppt-service.test"), expect.objectContaining({ method: "POST" }));
  });

  it("sends draft values to the PPT-native preview endpoint", async () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(png, {
      headers: { "Content-Type": "image/png" }
    })));
    await expect(renderDraftPreview({
      relativePath: "templates/a/a.pptx", sha256: "0".repeat(64), slideIndex: 1,
      values: [{ key: "accuracy", occurrenceIndex: 0, valueText: "95%" }]
    })).resolves.toEqual(png);
    expect(fetch).toHaveBeenCalledWith(new URL("/ppt/render-draft", "http://ppt-service.test"), expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"valueText":"95%"')
    }));
  });

  it("validates a complete generated artifact set", async () => {
    const generationId = "0476e23a-2145-47d4-a708-36cf46b006f9";
    const metadata = (type: string, name: string, slideIndex: number | null) => ({
      type, slideIndex, relativePath: `generated/${generationId}/${name}`,
      mimeType: type === "PPTX" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : type === "PDF" ? "application/pdf" : "image/png",
      sizeBytes: 10, sha256: "a".repeat(64)
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      generationId, pageCount: 1, warnings: [], files: [
        metadata("PPTX", "report.pptx", null), metadata("PDF", "report.pdf", null),
        metadata("PNG", "slide-1.png", 0)
      ]
    })));
    await expect(generateReport({
      relativePath: "templates/a/a.pptx", sha256: "0".repeat(64), generationId,
      values: [{ slideIndex: 0, key: "total", occurrenceIndex: 0, valueText: "128" }]
    })).resolves.toMatchObject({ pageCount: 1 });
  });
});
