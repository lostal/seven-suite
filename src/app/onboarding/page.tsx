import { requireAuth } from "@/lib/auth/helpers";
import { getAllEntities } from "@/lib/queries/entities";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./_components/onboarding-form";

export default async function OnboardingPage() {
  const user = await requireAuth();

  if (user.profile?.entityId) {
    redirect("/");
  }

  const entities =
    user.profile?.role === "admin"
      ? await getAllEntities().catch(() => [])
      : [];
  const activeEntities = entities.filter((e) => e.isActive);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Configura tu perfil
          </h1>
          <p className="text-muted-foreground">
            Completa tus datos para empezar a usar Seven Suite
          </p>
        </div>
        <OnboardingForm entities={activeEntities} userEmail={user.email} />
      </div>
    </div>
  );
}
