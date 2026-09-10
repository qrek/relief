import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/** Dev-only helper: saves a base64 payload posted by the browser to .snapshots/ for inspection. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not available", { status: 404 });
  }
  const { name, dataUrl } = (await req.json()) as { name?: string; dataUrl?: string };
  if (!dataUrl?.startsWith("data:")) return new Response("Bad payload", { status: 400 });

  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  const ext = EXTENSIONS[mime];
  if (!ext) return new Response(`Unsupported type: ${mime}`, { status: 400 });

  const safe = (name ?? "snapshot").replace(/[^\w-]+/g, "_");
  const dir = path.join(process.cwd(), ".snapshots");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${safe}.${ext}`);
  await writeFile(file, Buffer.from(dataUrl.split(",")[1], "base64"));
  return Response.json({ file, bytes: Buffer.from(dataUrl.split(",")[1], "base64").length });
}
