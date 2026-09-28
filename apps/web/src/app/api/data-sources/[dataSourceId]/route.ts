import { deleteDataSource } from "@/features/data-source/data-source-service";
import { dataSourceErrorResponse } from "@/features/data-source/http-error";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ dataSourceId: string }> }) {
  try {
    const { dataSourceId } = await context.params;
    await deleteDataSource(dataSourceId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return dataSourceErrorResponse(error);
  }
}
