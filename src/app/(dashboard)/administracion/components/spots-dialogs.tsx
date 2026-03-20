"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
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
import { SelectDropdown } from "@/components/select-dropdown";
import { Loader2 } from "lucide-react";
import { createSpot, updateSpot, deleteSpot } from "../actions";
import { useSpots } from "./spots-provider";

// ─── Shared ───────────────────────────────────────────────────────────────────

// Los labels dependen del resource_type seleccionado; estas listas se usan
// en getSpotTypeItems() que recibe el recurso activo.
function getSpotTypeItems(resourceType: "parking" | "office") {
  return [
    { label: "Fija", value: "standard" },
    {
      label: resourceType === "office" ? "Flexible" : "Visitas",
      value: "visitor",
    },
  ];
}

const resourceTypeItems = [
  { label: "Parking", value: "parking" },
  { label: "Oficina", value: "office" },
];

// ─── Add Spot Dialog ──────────────────────────────────────────────────────────

const addSchema = z.object({
  label: z.string().min(1, "Etiqueta requerida").max(20),
  type: z.enum(["standard", "visitor"]),
  resource_type: z.enum(["parking", "office"]),
});
type AddForm = z.infer<typeof addSchema>;

function AddSpotDialog() {
  const { open, setOpen, activeResourceType } = useSpots();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: {
      label: "",
      type: "standard",
      resource_type: activeResourceType,
    },
  });

  const addResourceType = useWatch({
    control: form.control,
    name: "resource_type",
  });

  const closeDialog = () => {
    setOpen(null);
    form.reset({
      label: "",
      type: "standard",
      resource_type: activeResourceType,
    });
  };

  const onSubmit = (values: AddForm) => {
    startTransition(async () => {
      const result = await createSpot(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Plaza creada correctamente");
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
            label: "",
            type: "standard",
            resource_type: activeResourceType,
          });
        } else {
          closeDialog();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva plaza</DialogTitle>
          <DialogDescription>
            Rellena los datos para crear una nueva plaza.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etiqueta</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: P-15, OF-03..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="resource_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recurso</FormLabel>
                    <FormControl>
                      <SelectDropdown
                        defaultValue={field.value}
                        onValueChange={field.onChange}
                        items={resourceTypeItems}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <FormControl>
                      <SelectDropdown
                        defaultValue={field.value}
                        onValueChange={field.onChange}
                        items={getSpotTypeItems(addResourceType)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear plaza
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Spot Dialog ─────────────────────────────────────────────────────────

const editSchema = z.object({
  label: z.string().min(1, "Etiqueta requerida").max(20),
  type: z.enum(["standard", "visitor"]),
  resource_type: z.enum(["parking", "office"]),
  is_active: z.boolean(),
});
type EditForm = z.infer<typeof editSchema>;

const ACTIVE_SENTINEL = "__active__";
const INACTIVE_SENTINEL = "__inactive__";

function EditSpotDialog() {
  const { open, setOpen, currentRow, setCurrentRow } = useSpots();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: {
      label: currentRow?.label ?? "",
      type: (currentRow?.type as EditForm["type"]) ?? "standard",
      resource_type:
        (currentRow?.resourceType as EditForm["resource_type"]) ?? "parking",
      is_active: currentRow?.isActive ?? true,
    },
  });

  const editResourceType = useWatch({
    control: form.control,
    name: "resource_type",
  });

  const closeDialog = () => {
    setOpen(null);
    setCurrentRow(null);
  };

  const onSubmit = (values: EditForm) => {
    if (!currentRow) return;
    startTransition(async () => {
      const result = await updateSpot({ id: currentRow.id, ...values });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Plaza actualizada correctamente");
      closeDialog();
      router.refresh();
    });
  };

  return (
    <Dialog open={open === "edit"} onOpenChange={(o) => !o && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar plaza</DialogTitle>
          <DialogDescription>
            Modifica los datos de la plaza{" "}
            <strong className="font-mono">{currentRow?.label}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etiqueta</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="resource_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recurso</FormLabel>
                    <FormControl>
                      <SelectDropdown
                        defaultValue={field.value}
                        onValueChange={field.onChange}
                        items={resourceTypeItems}
                        isControlled
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <FormControl>
                      <SelectDropdown
                        defaultValue={field.value}
                        onValueChange={field.onChange}
                        items={getSpotTypeItems(editResourceType)}
                        isControlled
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <SelectDropdown
                      defaultValue={
                        field.value ? ACTIVE_SENTINEL : INACTIVE_SENTINEL
                      }
                      onValueChange={(v) =>
                        field.onChange(v === ACTIVE_SENTINEL)
                      }
                      items={[
                        { label: "Activa", value: ACTIVE_SENTINEL },
                        { label: "Inactiva", value: INACTIVE_SENTINEL },
                      ]}
                      isControlled
                    />
                  </FormControl>
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

// ─── Delete Spot Dialog ───────────────────────────────────────────────────────

function DeleteSpotDialog() {
  const { open, setOpen, currentRow, setCurrentRow } = useSpots();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const closeDialog = () => {
    setOpen(null);
    setCurrentRow(null);
  };

  const handleDelete = () => {
    if (!currentRow) return;
    startTransition(async () => {
      const result = await deleteSpot({ id: currentRow.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Plaza ${currentRow.label} eliminada`);
      closeDialog();
      router.refresh();
    });
  };

  return (
    <Dialog open={open === "delete"} onOpenChange={(o) => !o && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar plaza</DialogTitle>
          <DialogDescription>
            ¿Seguro que quieres eliminar la plaza{" "}
            <strong className="font-mono">{currentRow?.label}</strong>? Esta
            acción no se puede deshacer y eliminará todas las reservas y
            cesiones asociadas.
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

// ─── Combined wrapper ─────────────────────────────────────────────────────────

export function SpotsDialogs() {
  return (
    <>
      <AddSpotDialog />
      <EditSpotDialog />
      <DeleteSpotDialog />
    </>
  );
}
