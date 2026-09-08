import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userMicrosoftTokens } from "@/lib/db/schema";
import { decryptToken, encryptToken } from "@/lib/auth/token-crypto";

const REFRESH_MARGIN_MS = 60_000;

export class MicrosoftReauthorizationRequiredError extends Error {
  constructor() {
    super("La conexión con Microsoft ha caducado. Vuelve a conectarla.");
    this.name = "MicrosoftReauthorizationRequiredError";
  }
}

type TokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
};

/** Returns a usable Graph token and refreshes it shortly before expiry. */
export async function getMicrosoftAccessToken(userId: string): Promise<string> {
  const [stored] = await db
    .select({
      accessToken: userMicrosoftTokens.accessToken,
      refreshToken: userMicrosoftTokens.refreshToken,
      tokenExpiresAt: userMicrosoftTokens.tokenExpiresAt,
    })
    .from(userMicrosoftTokens)
    .where(eq(userMicrosoftTokens.userId, userId))
    .limit(1);

  if (!stored) {
    throw new Error(
      "No hay tokens de Microsoft. Conecta tu cuenta en Ajustes > Microsoft."
    );
  }

  const accessToken = decryptToken(stored.accessToken);
  if (
    stored.tokenExpiresAt &&
    stored.tokenExpiresAt.getTime() > Date.now() + REFRESH_MARGIN_MS
  ) {
    return accessToken;
  }

  const refreshToken = decryptToken(stored.refreshToken);
  if (!refreshToken) throw new MicrosoftReauthorizationRequiredError();

  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("La integración con Microsoft no está configurada.");
  }

  let response: Response;
  try {
    response = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
  } catch (error) {
    console.error("[microsoft] token refresh failed", {
      userId,
      error: error instanceof Error ? error.name : "unknown",
    });
    throw new Error("No se pudo renovar la conexión con Microsoft.");
  }

  if (!response.ok) {
    console.error("[microsoft] token refresh rejected", {
      userId,
      status: response.status,
    });
    if (response.status === 400 || response.status === 401) {
      throw new MicrosoftReauthorizationRequiredError();
    }
    throw new Error("No se pudo renovar la conexión con Microsoft.");
  }

  const payload = (await response.json()) as TokenResponse;
  if (
    typeof payload.access_token !== "string" ||
    typeof payload.expires_in !== "number"
  ) {
    throw new Error("Microsoft devolvió una respuesta de token no válida.");
  }

  const nextRefreshToken =
    typeof payload.refresh_token === "string"
      ? payload.refresh_token
      : refreshToken;
  const nextExpiresAt = new Date(Date.now() + payload.expires_in * 1000);

  await db
    .update(userMicrosoftTokens)
    .set({
      accessToken: encryptToken(payload.access_token),
      refreshToken: encryptToken(nextRefreshToken),
      tokenExpiresAt: nextExpiresAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userMicrosoftTokens.userId, userId),
        eq(userMicrosoftTokens.accessToken, stored.accessToken)
      )
    );

  return payload.access_token;
}
