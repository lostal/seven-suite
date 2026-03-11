"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckCircle2, XCircle, Calendar, MessageSquare } from "lucide-react";
import { disconnectMicrosoftAccount } from "../actions";

interface MicrosoftConnectionCardProps {
  status: {
    connected: boolean;
    scopes: string[];
    lastSync: string | null;
    lastOOOCheck: string | null;
    currentOOOStatus: boolean;
    teamsConnected: boolean;
    outlookConnected: boolean;
  } | null;
}

const SCOPE_LABELS: Record<string, string> = {
  "Calendars.ReadWrite": "Outlook Calendar (lectura y escritura)",
  offline_access: "Mantener sesión activa",
  "User.Read": "Perfil de usuario",
  "ChannelMessage.Send": "Enviar mensajes en Teams",
};

export function MicrosoftConnectionCard({
  status,
}: MicrosoftConnectionCardProps) {
  const connected = status?.connected || false;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Stub: OAuth flow not yet implemented
  const handleConnect = () => {
    toast.info(
      "La integración con Microsoft 365 estará disponible próximamente."
    );
  };

  const handleDisconnectConfirmed = () => {
    startTransition(async () => {
      const result = await disconnectMicrosoftAccount({});
      setConfirmOpen(false);
      if (result?.success) {
        toast.success("Cuenta de Microsoft desvinculada correctamente.");
      } else {
        toast.error("No se pudo desvincular la cuenta. Inténtalo de nuevo.");
      }
    });
  };

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Desvincular cuenta de Microsoft"
        desc="Se desactivarán las notificaciones de Teams y la sincronización con Outlook. Podrás volver a conectar tu cuenta en cualquier momento."
        confirmText="Desvincular"
        destructive
        isLoading={isPending}
        handleConfirm={handleDisconnectConfirmed}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Conexión con Microsoft 365</CardTitle>
              <CardDescription>
                Integración con Teams y Outlook Calendar
              </CardDescription>
            </div>
            {connected ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" />
                No conectado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!connected ? (
            <>
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  Conecta tu cuenta de Microsoft 365 para habilitar:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <MessageSquare className="text-primary h-4 w-4" />
                    <span>Notificaciones a través del bot de Teams</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Calendar className="text-primary h-4 w-4" />
                    <span>Sincronización con Outlook Calendar</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="text-primary h-4 w-4" />
                    <span>
                      Detección automática de &quot;Fuera de Oficina&quot;
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Función en desarrollo
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  La integración con Microsoft 365 estará disponible
                  próximamente
                </p>
              </div>

              <Button onClick={handleConnect} disabled>
                Conectar con Microsoft 365
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Microsoft Teams
                    </span>
                    {status?.teamsConnected ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Conectado
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No configurado</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Outlook Calendar
                    </span>
                    {status?.outlookConnected ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Sincronizado
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No configurado</Badge>
                    )}
                  </div>
                </div>

                {status?.lastSync && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      Última sincronización:
                    </span>{" "}
                    <span>
                      {new Date(status.lastSync).toLocaleString("es-ES", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}

                {status?.currentOOOStatus && (
                  <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Fuera de Oficina detectado
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Tu plaza se está cediendo automáticamente
                    </p>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <h4 className="text-sm font-medium">Permisos otorgados:</h4>
                  <div className="flex flex-wrap gap-2">
                    {status?.scopes.map((scope) => (
                      <Badge key={scope} variant="outline" className="text-xs">
                        {SCOPE_LABELS[scope] ?? scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleConnect} disabled>
                  Reconectar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                  disabled={isPending}
                >
                  Desvincular cuenta
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
