import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const encryptionSecret = process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY;
  if (process.env.NODE_ENV === "production" && !encryptionSecret) {
    throw new Error("MICROSOFT_TOKEN_ENCRYPTION_KEY is required in production");
  }
  if (
    process.env.NODE_ENV === "production" &&
    encryptionSecret === process.env.AUTH_SECRET
  ) {
    throw new Error(
      "MICROSOFT_TOKEN_ENCRYPTION_KEY must be independent from AUTH_SECRET"
    );
  }

  const secret = encryptionSecret ?? process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("Missing token encryption key");
  }

  return createHash("sha256")
    .update("seven-suite:microsoft-token-encryption:v1:")
    .update(secret)
    .digest();
}

export function encryptToken(token: string): string {
  if (token.startsWith(PREFIX)) return token;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptToken(value: string): string {
  if (!value.startsWith(PREFIX)) return value;

  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted token");

  const [ivEncoded, tagEncoded, encryptedEncoded] = parts;
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error("Invalid encrypted token");
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(ivEncoded, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt token");
  }
}
