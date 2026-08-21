import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { badRequest } from "./http-errors.js";

const MIME_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"],
]);

const mediaRoot = (config) => path.resolve(config.mediaUploadDir, "media");

function resolveStoredPath(config, relativePath) {
  if (typeof relativePath !== "string" || !relativePath) return null;
  const root = mediaRoot(config);
  const resolved = path.resolve(config.mediaUploadDir, relativePath);
  return resolved === root || resolved.startsWith(root + path.sep) ? resolved : null;
}

export function publicMediaUrl(filePath) {
  return filePath ? "/uploads/" + filePath.replace(/^\/+/, "") : null;
}

export async function saveMediaUpload(file, config) {
  const extension = MIME_EXTENSIONS.get(file.mimetype);
  if (!extension) throw badRequest("INVALID_MEDIA_TYPE", "仅支持 JPG、PNG、WebP 或 SVG 图片。");
  await mkdir(mediaRoot(config), { recursive: true });

  const fileName = randomUUID() + extension;
  const temporaryPath = path.join(mediaRoot(config), "." + fileName + ".uploading");
  const storedPath = path.join(mediaRoot(config), fileName);
  try {
    await pipeline(file.file, createWriteStream(temporaryPath, { flags: "wx" }));
    const metadata = await stat(temporaryPath);
    if (metadata.size > config.mediaMaxBytes || file.file.truncated) {
      throw badRequest("MEDIA_TOO_LARGE", "图片大小不能超过 5 MB。");
    }
    await rename(temporaryPath, storedPath);
    return {
      filePath: "media/" + fileName,
      mimeType: file.mimetype,
      fileSize: metadata.size,
      absolutePath: storedPath,
    };
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    if (error.code === "FST_REQ_FILE_TOO_LARGE") throw badRequest("MEDIA_TOO_LARGE", "图片大小不能超过 5 MB。");
    throw error;
  }
}

export async function removeStoredMedia(config, filePath) {
  const absolutePath = resolveStoredPath(config, filePath);
  if (absolutePath) await rm(absolutePath, { force: true });
}

export async function storedMediaExists(config, filePath) {
  const absolutePath = resolveStoredPath(config, filePath);
  if (!absolutePath) return false;
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}
