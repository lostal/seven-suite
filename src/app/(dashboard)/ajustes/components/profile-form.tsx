"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "../actions";
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from "@/lib/validations";
import type { Profile } from "@/lib/supabase/types";

interface ProfileFormProps {
  profile: Pick<Profile, "id" | "email" | "full_name" | "avatar_url" | "role">;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      full_name: profile.full_name || "",
      avatar_url: profile.avatar_url || "",
    },
  });

  const onSubmit = async (data: UpdateProfileInput) => {
    setIsLoading(true);
    const result = await updateProfile(data);
    setIsLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Error al actualizar el perfil");
    } else {
      toast.success("Perfil actualizado correctamente");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Email (readonly) */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={profile.email}
          disabled
          className="bg-muted"
        />
        <p className="text-muted-foreground text-xs">
          Tu email corporativo no se puede modificar
        </p>
      </div>

      {/* Full Name */}
      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre Completo</Label>
        <Input
          id="full_name"
          type="text"
          placeholder="Tu nombre completo"
          {...register("full_name")}
        />
        {errors.full_name && (
          <p className="text-destructive text-sm">{errors.full_name.message}</p>
        )}
      </div>

      {/* Avatar URL */}
      <div className="space-y-2">
        <Label htmlFor="avatar_url">URL de Avatar (opcional)</Label>
        <Input
          id="avatar_url"
          type="text"
          placeholder="https://example.com/avatar.jpg"
          {...register("avatar_url")}
        />
        {errors.avatar_url && (
          <p className="text-destructive text-sm">
            {errors.avatar_url.message}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          Deja vacío para usar tu foto de Microsoft 365
        </p>
      </div>

      {/* Role (readonly) */}
      <div className="space-y-2">
        <Label htmlFor="role">Rol</Label>
        <Input
          id="role"
          type="text"
          value={profile.role === "admin" ? "Administrador" : "Empleado"}
          disabled
          className="bg-muted"
        />
        <p className="text-muted-foreground text-xs">
          Tu rol en la organización
        </p>
      </div>

      {/* Submit */}
      <Button type="submit" disabled={!isDirty || isLoading}>
        {isLoading ? "Guardando..." : "Guardar Cambios"}
      </Button>
    </form>
  );
}
