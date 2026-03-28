/**
 * Settings - Notifications Page
 *
 * Placeholder until Microsoft 365 integration is implemented.
 */

import { requireAuth } from "@/lib/auth/helpers";
import { ContentSection } from "@/components/content-section";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, MessageSquare } from "lucide-react";

export default async function SettingsNotificationsPage() {
  await requireAuth();

  return (
    <ContentSection
      title="Notificaciones"
      desc="Configura cómo y cuándo quieres recibir notificaciones."
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-600 dark:text-amber-400"
            >
              En desarrollo
            </Badge>
          </div>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            Las notificaciones estarán disponibles cuando se integre Microsoft
            365. Las preferencias que configures aquí se aplicarán
            automáticamente cuando el servicio esté activo.
          </p>
        </div>

        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="text-base">
              Canales disponibles próximamente
            </CardTitle>
            <CardDescription>
              Podrás elegir cómo recibir los avisos del sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <MessageSquare className="text-muted-foreground size-4" />
              <span>Bot de Microsoft Teams</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Mail className="text-muted-foreground size-4" />
              <span>Email vía Outlook</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Bell className="text-muted-foreground size-4" />
              <span>Resumen diario de actividad</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </ContentSection>
  );
}
