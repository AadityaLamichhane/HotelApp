import db from "@/config/db";
import logger from "@/config/logger";

export type ValidationReturnType = {
  isValid: boolean;
  errors: string[];
  data: any;
};

export const HTTP_ERROR_LITERALS = {
  GOOD: "SUCCESS: ",
  VALIDATIONERROR: "VALIDATION ERROR: ",
  BADREQUEST: "BADREQUEST: ",
  UNAUTHORIZED: "UNAUTHORIZED: ",
  FORBIDDEN: "FORBIDDEN: ",
  NOT_FOUND: "NOT FOUND: ",
  CONFLICT: "CONFLICT: ",
  VALIDATION_ERROR: "VALIDATION_ERROR: ",
  INTERNAL_SERVER_ERROR: "SOMETHING WENT WRONG: ",
} as const;

export const ErrorLiteral = {
  ALREADY_EXIST: "Error : Data already exists",
  UNAUTHORIZED: "UNAUTHORIZED:Cannot access the data ",
} as const;

export const doesExistCheck = async (tableName: any, whereArray: [any]) => {
  const exist = await db.select().from(tableName).where(...whereArray);
  return exist.length !== 0 && exist.length > 0;
};

export const generateRandomNumber = (length = 10): number => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const formatDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}:${minutes}:${seconds}`;
};

export function calculateAge(dob: string | Date | null): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  return hasHadBirthdayThisYear ? age : age - 1;
}

export function encodeCursor(c: { name: string; key: string }) {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(s: string): { name: string; key: string } {
  return JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
}

export const image_from_link = async (imagelink: string) => {
  try {
    const { readFileSync } = await import("fs");
    const image = readFileSync(imagelink, { encoding: "base64" });
    const extension = imagelink.split(".").pop();
    return { base64: image, extension };
  } catch (err) {
    logger.error(err);
    return imagelink;
  }
};

