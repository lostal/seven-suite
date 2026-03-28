"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { signOutAction } from "@/lib/auth/sign-out";
import { deleteSelfAccount } from "../actions";
import { ROUTES } from "@/lib/constants";
import { toast } from "sonner";

interface SecuritySectionProps {
  user: {
    email: string;
    created_at: string;
  };
}

export function SecuritySection({ user }: SecuritySectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = () => {
    startTransition(async () => {
      await signOutAction();
    });
  };

  const handleSignOutAll = () => {
    if (!confirm("¿Cerrar sesión en todos los dispositivos?")) return;
    startTransition(async () => {
      await signOutAction();
    });
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    const result = await deleteSelfAccount({});
    setIsDeleting(false);
    if (result.success) {
      router.push(ROUTES.LOGIN);
    } else {
      toast.error(result.error ?? "No se pudo eliminar la cuenta");
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Cuenta</CardTitle>
          <CardDescription>
            Detalles de tu autenticación y sesión
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Autenticación</p>
              <p className="text-muted-foreground text-sm">
                Microsoft Entra ID
              </p>
            </div>
            <Badge variant="default">Activa</Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Email</p>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Miembro desde</p>
              <p className="text-muted-foreground text-sm">
                {new Date(user.created_at).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Sesiones Activas</CardTitle>
          <CardDescription>
            Gestiona tus sesiones en diferentes dispositivos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Sesión Actual</p>
                <p className="text-muted-foreground text-xs">
                  Windows · Chrome · Ahora
                </p>
              </div>
              <Badge variant="default">Activa</Badge>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            No se muestran otras sesiones activas
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSignOut}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Cerrando...
                </>
              ) : (
                "Cerrar Sesión"
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={handleSignOutAll}
              disabled={isPending}
            >
              Cerrar Todas las Sesiones
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
          <CardDescription>Acciones irreversibles en tu cuenta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Eliminar Cuenta</p>
            <p className="text-muted-foreground text-sm">
              Eliminar permanentemente tu cuenta y todos tus datos (reservas,
              cesiones, alertas). Esta acción no se puede deshacer.
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  "Eliminar Mi Cuenta"
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán permanentemente tu cuenta y todos tus datos
                  asociados: reservas, cesiones y alertas. Esta acción{" "}
                  <strong>no se puede deshacer</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sí, eliminar mi cuenta
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
