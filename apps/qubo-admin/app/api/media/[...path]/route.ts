import { serveMedia } from "@qubo/storage/server";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return serveMedia((await ctx.params).path);
}
