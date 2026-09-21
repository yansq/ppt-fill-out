import { describe, expect, it } from "vitest";

import { createDataSourceSchema } from "./data-source-policy";

const valid = {
  name: "财务指标库",
  host: "metrics.internal",
  databaseName: "metrics",
  username: "report_reader",
  password: "private"
};

describe("data-source config validation", () => {
  it("defaults the MySQL port", () => {
    expect(createDataSourceSchema.parse(valid).port).toBe(3306);
  });

  it("rejects URLs, invalid ports and empty credentials", () => {
    expect(createDataSourceSchema.safeParse({ ...valid, host: "http://metadata.local" }).success).toBe(false);
    expect(createDataSourceSchema.safeParse({ ...valid, port: 65536 }).success).toBe(false);
    expect(createDataSourceSchema.safeParse({ ...valid, password: "" }).success).toBe(false);
  });
});
