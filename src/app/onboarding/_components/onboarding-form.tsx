"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Car, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeOnboarding } from "../actions";
import { uuidString } from "@/lib/validations";
import type { Entity } from "@/lib/db/types";

const formSchema = z.object({
  entityId: uuidString("Selecciona tu sede"),
  phone: z.string().optional(),
  hasFixedParking: z.boolean(),
  hasFixedOffice: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface OnboardingFormProps {
  entities: Entity[];
  userEmail: string;
}

export function OnboardingForm({ entities, userEmail }: OnboardingFormProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entityId: "",
      phone: "",
      hasFixedParking: false,
      hasFixedOffice: false,
    },
  });

  const hasFixedParking = useWatch({ control, name: "hasFixedParking" });
  const hasFixedOffice = useWatch({ control, name: "hasFixedOffice" });
  const entityId = useWatch({ control, name: "entityId" });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    const result = await completeOnboarding(data);
    if (!result.success) {
      toast.error(result.error ?? "Error al guardar");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Email (readonly) */}
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={userEmail} disabled className="bg-muted" />
        <p className="text-muted-foreground text-xs">
          Vinculado a tu cuenta de Microsoft 365
        </p>
      </div>

      {/* Entity */}
      <div className="space-y-2">
        <Label htmlFor="entityId">Sede</Label>
        <Select
          value={entityId}
          onValueChange={(v) =>
            setValue("entityId", v, { shouldValidate: true })
          }
          disabled={loading}
        >
          <SelectTrigger id="entityId">
            <SelectValue placeholder="Selecciona tu sede" />
          </SelectTrigger>
          <SelectContent>
            {entities.length === 0 ? (
              <SelectItem value="__none" disabled>
                Sin sedes disponibles
              </SelectItem>
            ) : (
              entities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>
                  {entity.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {errors.entityId && (
          <p className="text-destructive text-sm">{errors.entityId.message}</p>
        )}
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">
          Teléfono{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+34 600 000 000"
          {...register("phone")}
          disabled={loading}
        />
      </div>

      {/* Fixed spots */}
      <div className="space-y-3">
        <Label>Plazas fijas asignadas</Label>
        <p className="text-muted-foreground text-xs">
          Marca si ya tienes plaza fija. El administrador te la asignará para
          que puedas gestionarla.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Checkbox
              id="hasFixedParking"
              checked={hasFixedParking}
              onCheckedChange={(v) => setValue("hasFixedParking", !!v)}
              disabled={loading}
            />
            <label
              htmlFor="hasFixedParking"
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Car className="text-muted-foreground h-4 w-4" />
              Tengo plaza de parking fija
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="hasFixedOffice"
              checked={hasFixedOffice}
              onCheckedChange={(v) => setValue("hasFixedOffice", !!v)}
              disabled={loading}
            />
            <label
              htmlFor="hasFixedOffice"
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Building2 className="text-muted-foreground h-4 w-4" />
              Tengo puesto de oficina fijo
            </label>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="animate-spin" />}
        Completar configuración
      </Button>
    </form>
  );
}
