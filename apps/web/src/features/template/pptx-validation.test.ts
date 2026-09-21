import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";

import { PptxValidationError, validatePptxPackage } from "./pptx-validation";

describe("validatePptxPackage", () => {
  it("accepts a package with the required PPTX parts", async () => {
    const archive = Buffer.from(
      zipSync({
        "[Content_Types].xml": strToU8("<Types />"),
        "ppt/presentation.xml": strToU8("<p:presentation />"),
        "ppt/slides/slide1.xml": strToU8("<p:sld />")
      })
    );

    await expect(validatePptxPackage(archive)).resolves.toBeUndefined();
  });

  it("rejects a zip that is not a PPTX package", async () => {
    const archive = Buffer.from(zipSync({ "notes.txt": strToU8("not a presentation") }));

    await expect(validatePptxPackage(archive)).rejects.toThrow(PptxValidationError);
    await expect(validatePptxPackage(archive)).rejects.toThrow("缺少必要部件");
  });

  it("rejects malformed input", async () => {
    await expect(validatePptxPackage(Buffer.from("not-a-zip"))).rejects.toThrow("有效的 PPTX/ZIP 包");
  });
});

