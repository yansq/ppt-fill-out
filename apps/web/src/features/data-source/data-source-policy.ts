import { z } from "zod";

export const createDataSourceSchema = z.object({
  name: z.string().trim().min(1).max(191),
  host: z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9_.:-]+$/, "主机名或 IP 地址无效"),
  port: z.number().int().min(1).max(65535).default(3306),
  databaseName: z.string().trim().min(1).max(191),
  username: z.string().trim().min(1).max(191),
  password: z.string().min(1).max(4096)
});
