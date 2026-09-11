import { useEditor } from "../store";
import { MAX_MODEL_BYTES, MODEL_EXTENSIONS, putAsset } from "./assets";
import { MAX_MEDIA_BYTES, mediaTypeOf } from "./media";
import { importEnvironmentFile } from "./hdri";
import { importFontFile } from "./fonts";

const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(0)} MB` : `${Math.ceil(n / 1024)} KB`);

export type ImportReport = { added: string[]; errors: string[] };

/**
 * Files dropped onto the editor, sorted by what they are: a model becomes an
 * object, an image or a video a cover, a map the environment, a font goes to
 * the library. One report for the lot, so a mixed drop tells what it did and
 * what it could not.
 */
export async function importDroppedFiles(files: File[]): Promise<ImportReport> {
  const report: ImportReport = { added: [], errors: [] };
  for (const file of files) {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    try {
      if (MODEL_EXTENSIONS.includes(ext)) {
        if (file.size > MAX_MODEL_BYTES) throw new Error(`${file.name} is ${formatBytes(file.size)}, over the ${formatBytes(MAX_MODEL_BYTES)} limit`);
        if (ext === "gltf") {
          // A .gltf alone points at files it does not carry; only the binary form is self-contained.
          throw new Error(`${file.name}: a .gltf refers to separate .bin and texture files. Export it as one .glb instead.`);
        }
        const meta = await putAsset(file, "model");
        useEditor.getState().addModel({ type: "asset", assetId: meta.id }, meta.name);
        report.added.push(meta.name);
      } else if (mediaTypeOf(ext)) {
        if (file.size > MAX_MEDIA_BYTES) throw new Error(`${file.name} is ${formatBytes(file.size)}, over the ${formatBytes(MAX_MEDIA_BYTES)} limit`);
        const meta = await putAsset(file, "media");
        useEditor.getState().addCover({ assetId: meta.id, mediaType: mediaTypeOf(ext) ?? "image" }, meta.name);
        report.added.push(meta.name);
      } else if (ext === "hdr" || ext === "exr") {
        const meta = await importEnvironmentFile(file);
        useEditor.getState().setStaging({ environment: `asset:${meta.id}` }, false);
        report.added.push(`${meta.name} as the environment`);
      } else if (ext === "ttf" || ext === "otf") {
        const meta = await importFontFile(file);
        report.added.push(`${meta.name} to the fonts`);
      } else {
        throw new Error(`${file.name}: not a file Relief knows. Models (.glb, .fbx, .obj), images, videos, .hdr, .exr, .ttf, .otf.`);
      }
    } catch (err) {
      report.errors.push(err instanceof Error ? err.message : `${file.name}: import failed`);
    }
  }
  return report;
}
