import path from "path";

const ROOT_PATH = path.join(__dirname);
export { ROOT_PATH };

export const imageValidationExtensions = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "heic",
  "heif",
  "webp",
] as const;

export const videoValidationExtensions = [
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm",
] as const;

// NOTE (hotelmanagement): this is a fresh project starter on purpose.
// There is no `admin` / `retailer` / `customer` / `ops` module, no
// PERMISSIONS_MODULES, and no `roles` map here. Define hotel-specific
// roles/enums inside the feature module that owns them (e.g.
// src/modules/staff, src/modules/booking) once the domain is decided.

