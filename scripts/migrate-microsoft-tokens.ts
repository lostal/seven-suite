import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { userMicrosoftTokens } = await import("../src/lib/db/schema");
  const { decryptToken, encryptToken } =
    await import("../src/lib/auth/token-crypto");

  const rows = await db
    .select({
      userId: userMicrosoftTokens.userId,
      accessToken: userMicrosoftTokens.accessToken,
      refreshToken: userMicrosoftTokens.refreshToken,
    })
    .from(userMicrosoftTokens);

  let migrated = 0;

  for (const row of rows) {
    const accessToken = decryptToken(row.accessToken);
    const refreshToken = decryptToken(row.refreshToken);
    const nextAccessToken = encryptToken(accessToken);
    const nextRefreshToken = encryptToken(refreshToken);

    if (
      nextAccessToken !== row.accessToken ||
      nextRefreshToken !== row.refreshToken
    ) {
      await db
        .update(userMicrosoftTokens)
        .set({
          accessToken: nextAccessToken,
          refreshToken: nextRefreshToken,
          updatedAt: new Date(),
        })
        .where(eq(userMicrosoftTokens.userId, row.userId));
      migrated += 1;
    }
  }

  process.stdout.write(`Migrated ${migrated} Microsoft token rows.\n`);
}

main().catch((error: unknown) => {
  console.error("Microsoft token migration failed", {
    error: error instanceof Error ? error.message : "unknown",
  });
  process.exitCode = 1;
});
