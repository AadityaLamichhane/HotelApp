import path from "path";
import fs from "fs";
import { ROOT_PATH } from "@/constant";
import logger from "@/config/logger";

type UploadImageInput = {
  fileName: string;
  base64: string;
  filePath: string;
};

/**
 * Minimal local upload helper with the same call signature the
 * salespro backend uses (`uploadImage({ fileName, base64, filePath })`).
 * Stores files under `<root>/uploads/<filePath>/` and returns the
 * relative path (e.g. `uploads/rooms/123.png`) so it also satisfies
 * `imageInputSchema`'s `uploads/...` string branch.
 *
 * Swap the body for S3/Cloudinary later without touching callers.
 */
const uploadImage = async ({ fileName, base64, filePath }: UploadImageInput) => {
  try {
    const dir = path.join(ROOT_PATH, "..", "uploads", filePath);
    fs.mkdirSync(dir, { recursive: true });
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const absPath = path.join(dir, safeName);
    const cleanBase64 = base64.includes(",") ? base64.split(",").pop()! : base64;
    fs.writeFileSync(absPath, Buffer.from(cleanBase64, "base64"));
    return path.join("uploads", filePath, safeName);
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to upload image: ${(err as Error).message}`);
  }
};

export default uploadImage;
