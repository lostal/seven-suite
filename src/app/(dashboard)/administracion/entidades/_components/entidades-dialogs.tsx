"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUTONOMOUS_COMMUNITIES } from "@/lib/constants";
import {
  Loader2,
  ParkingCircle,
  Building2,
  Users,
  Palmtree,
  Megaphone,
} from "lucide-react";
import {
  createEntity,
  updateEntity,
  deleteEntity,
  toggleEntityModule,
  getEntityModuleStates,
} from "../actions";
import { useEntidades } from "./entidades-provider";
import { entidadFormSchema, type EntidadForm } from "./entidades-schema";
import type { EntityModuleKey } from "@/lib/validations";

// ─── Module configuration ─────────────────────────────────────

const MODULE_CONFIG: {
  key: EntityModuleKey;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    key: "parking",
    label: "Parking",
    description: "Gestión de plazas de aparcamiento",
    icon: ParkingCircle,
  },
  {
    key: "office",
    label: "Oficinas",
    description: "Reserva de puestos de oficina",
    icon: Building2,
  },
  {
    key: "visitors",
    label: "Visitantes",
    description: "Reservas para visitas externas",
    icon: Users,
  },
  {
    key: "vacaciones",
    label: "Vacaciones",
    description: "Solicitud y gestión de vacaciones",
    icon: Palmtree,
  },
  {
    key: "tablon",
    label: "Tablón",
    description: "Anuncios y comunicados internos",
    icon: Megaphone,
  },
];

// ─── Add Entity Dialog ────────────────────────────────────────

function AddEntidadDialog() {
  const { open, setOpen } = useEntidades();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<EntidadForm>({
    resolver: zodResolver(entidadFormSchema),
    defaultValues: {
      name: "",
      is_active: true,
      autonomous_community: null,
    },
  });

  const closeDialog = () => {
    setOpen(null);
    form.reset({
      name: "",
      is_active: true,
      autonomous_community: null,
    });
  };

  const onSubmit = (values: EntidadForm) => {
    startTransition(async () => {
      const result = await createEntity(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Sede creada correctamente");
      closeDialog();
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open === "add"}
      onOpenChange={(o) => {
        if (o) {
          form.reset({
            name: "",
            is_active: true,
            autonomous_community: null,
          });
        } else {
          closeDialog();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva sede</DialogTitle>
          <DialogDescription>
            Rellena los datos para crear una nueva sede.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: GRUPOSIETE Madrid Centro"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="autonomous_community"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comunidad autónoma</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v === "" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una comunidad" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {AUTONOMOUS_COMMUNITIES.map((cc) => (
                        <SelectItem key={cc.code} value={cc.code}>
                          {cc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Activa</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear sede
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Entity Dialog ───────────────────────────────────────

function EditEntidadDialog() {
  const { open, setOpen, currentRow, setCurrentRow } = useEntidades();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<EntidadForm>({
    resolver: zodResolver(entidadFormSchema),
    values: {
      name: currentRow?.name ?? "",
      is_active: currentRow?.is_active ?? true,
      autonomous_community: currentRow?.autonomous_community ?? null,
    },
  });

  const closeDialog = () => {
    setOpen(null);
    setCurrentRow(null);
  };

  const onSubmit = (values: EntidadForm) => {
    if (!currentRow) return;
    startTransition(async () => {
      const result = await updateEntity({ id: currentRow.id, ...values });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Sede actualizada correctamente");
      closeDialog();
      router.refresh();
    });
  };

  return (
    <Dialog open={open === "edit"} onOpenChange={(o) => !o && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar sede</DialogTitle>
          <DialogDescription>
            Modifica los datos de la sede <strong>{currentRow?.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="autonomous_community"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comunidad autónoma</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v === "" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una comunidad" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {AUTONOMOUS_COMMUNITIES.map((cc) => (
                        <SelectItem key={cc.code} value={cc.code}>
                          {cc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Activa</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Entity Dialog ─────────────────────────────────────

function DeleteEntidadDialog() {
  const { open, setOpen, currentRow, setCurrentRow } = useEntidades();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const closeDialog = () => {
    setOpen(null);
    setCurrentRow(null);
  };

  const handleDelete = () => {
    if (!currentRow) return;
    startTransition(async () => {
      const result = await deleteEntity({ id: currentRow.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Sede ${currentRow.name} eliminada`);
      closeDialog();
      router.refresh();
    });
  };

  return (
    <Dialog open={open === "delete"} onOpenChange={(o) => !o && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar sede</DialogTitle>
          <DialogDescription>
            ¿Seguro que quieres eliminar la sede{" "}
            <strong>{currentRow?.name}</strong>? Esta acción no se puede
            deshacer y eliminará todos los módulos y configuraciones asociadas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeDialog}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Entity Modules Dialog ────────────────────────────────────

interface EntidadModulesDialogInnerProps {
  entityId: string;
  entityName: string;
  onClose: () => void;
}

/** Inner component — mounts fresh each time the dialog opens, so initial state is always correct. */
function EntidadModulesDialogInner({
  entityId,
  entityName,
  onClose,
}: EntidadModulesDialogInnerProps) {
  const router = useRouter();
  const [moduleStates, setModuleStates] = useState<Record<string, boolean>>(
    () => Object.fromEntries(MODULE_CONFIG.map((m) => [m.key, true]))
  );
  const [pendingModule, setPendingModule] = useState<string | null>(null);

  useEffect(() => {
    getEntityModuleStates(entityId)
      .then(setModuleStates)
      .catch((error: unknown) => {
        console.error("Error loading entity module states:", error);
      });
  }, [entityId]);

  const handleToggle = (moduleKey: EntityModuleKey, enabled: boolean) => {
    setPendingModule(moduleKey);
    toggleEntityModule({ entity_id: entityId, module: moduleKey, enabled })
      .then((result) => {
        if (!result.success) {
          toast.error(result.error ?? "Error al actualizar módulo");
          return;
        }
        setModuleStates((prev) => ({ ...prev, [moduleKey]: enabled }));
        router.refresh();
      })
      .finally(() => setPendingModule(null));
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Módulos de {entityName}</DialogTitle>
        <DialogDescription>
          Activa o desactiva los módulos disponibles para esta sede.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
        {MODULE_CONFIG.map((mod) => {
          const Icon = mod.icon;
          const enabled = moduleStates[mod.key] ?? true;
          const isPending = pendingModule === mod.key;

          return (
            <div
              key={mod.key}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
                <Icon className="text-muted-foreground size-4" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <Label className="text-sm font-medium">{mod.label}</Label>
                <p className="text-muted-foreground text-xs">
                  {mod.description}
                </p>
              </div>
              <Switch
                checked={enabled}
                disabled={isPending}
                onCheckedChange={(checked) => handleToggle(mod.key, checked)}
              />
            </div>
          );
        })}
      </div>
      <DialogFooter>
        <Button type="button" onClick={onClose}>
          Cerrar
        </Button>
      </DialogFooter>
    </>
  );
}

function EntidadModulesDialog() {
  const { open, setOpen, currentRow, setCurrentRow } = useEntidades();

  const closeDialog = () => {
    setOpen(null);
    setCurrentRow(null);
  };

  return (
    <Dialog open={open === "modules"} onOpenChange={(o) => !o && closeDialog()}>
      <DialogContent className="sm:max-w-lg">
        {open === "modules" && currentRow && (
          <EntidadModulesDialogInner
            key={currentRow.id}
            entityId={currentRow.id}
            entityName={currentRow.name}
            onClose={closeDialog}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Combined wrapper ─────────────────────────────────────────

export function EntidadesDialogs() {
  return (
    <>
      <AddEntidadDialog />
      <EditEntidadDialog />
      <DeleteEntidadDialog />
      <EntidadModulesDialog />
    </>
  );
}
