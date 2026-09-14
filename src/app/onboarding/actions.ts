"use server";

import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { actionClient } from "@/lib/actions";
import { db } from "@/lib/db";
import { entities, profiles } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants";

import { uuidString } from "@/lib/validations";

const onboardingSchema = z.object({
  entityId: uuidString("Selecciona una sede"),
  phone: z.string().optional(),
  hasFixedParking: z.boolean().optional(),
  hasFixedOffice: z.boolean().optional(),
});

export const completeOnboarding = actionClient
  .schema(onboardingSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireAuth();

    // A profile is provisioned at sign-in; onboarding only completes it.
    if (!user.profile) {
      redirect(ROUTES.LOGIN);
    }

    if (user.profile.role !== "admin") {
      if (!user.profile.entityId) {
        throw new Error("Tu usuario no tiene una sede asignada");
      }
      if (user.profile.entityId !== parsedInput.entityId) {
        throw new Error("No puedes seleccionar otra sede");
      }
    }

    const [entity] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(
        and(eq(entities.id, parsedInput.entityId), eq(entities.isActive, true))
      )
      .limit(1);

    if (!entity)
      throw new Error("La sede seleccionada no existe o no está activa");

    await db
      .update(profiles)
      .set({
        entityId: parsedInput.entityId,
        phone: parsedInput.phone || null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, user.id));

    revalidatePath("/", "layout");
    redirect(
      user.profile?.role === "admin" ? ROUTES.DASHBOARD : ROUTES.PARKING
    );
  });
