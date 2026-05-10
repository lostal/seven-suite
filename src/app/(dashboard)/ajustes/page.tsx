import { requireAuth } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";

export default async function ConfiguracionPage() {
  const user = await requireAuth();
  const isAdmin = user.profile?.role === "admin";
  redirect(isAdmin ? "/ajustes/general" : "/ajustes/perfil");
}
