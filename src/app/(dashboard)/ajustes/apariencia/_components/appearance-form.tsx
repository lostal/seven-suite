"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ValidatedUserPreferences } from "@/lib/db/helpers";
import { updateTheme } from "@/app/(dashboard)/ajustes/actions";

interface AppearanceFormProps {
  preferences: Pick<ValidatedUserPreferences, "theme">;
}

export function AppearanceForm({ preferences }: AppearanceFormProps) {
  const { setTheme } = useTheme();
  const [themeValue, setThemeValue] = useState<string>(
    preferences.theme ?? "light"
  );
  const [saving, setSaving] = useState(false);

  const handleThemeChange = async (value: string) => {
    setThemeValue(value);
    setTheme(value);
    setSaving(true);
    try {
      await updateTheme({ theme: value as "light" | "dark" });
    } catch (error) {
      console.error("Error saving theme:", error);
      toast.error("Error al guardar el tema");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h4 className="text-sm leading-none font-medium">Tema</h4>
          <p className="text-muted-foreground mt-1 text-sm">
            Elige entre modo claro u oscuro. Se aplica al instante.
          </p>
        </div>

        <RadioGroup
          value={themeValue}
          onValueChange={handleThemeChange}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Label
            htmlFor="theme-light"
            className={cn(
              "hover:bg-accent flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 p-4 transition-colors",
              themeValue === "light" ? "border-primary" : "border-muted"
            )}
          >
            <RadioGroupItem
              value="light"
              id="theme-light"
              className="sr-only"
            />
            <div className="w-full rounded-md border bg-white p-2">
              <div className="space-y-1.5">
                <div className="h-2 w-3/4 rounded-sm bg-gray-200" />
                <div className="h-2 w-1/2 rounded-sm bg-gray-200" />
              </div>
              <div className="mt-2 flex gap-1.5">
                <div className="h-6 w-6 rounded-sm bg-blue-500" />
                <div className="h-6 flex-1 rounded-sm bg-gray-100" />
              </div>
            </div>
            <span className="text-sm font-medium">Claro</span>
          </Label>

          <Label
            htmlFor="theme-dark"
            className={cn(
              "hover:bg-accent flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 p-4 transition-colors",
              themeValue === "dark" ? "border-primary" : "border-muted"
            )}
          >
            <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
            <div className="w-full rounded-md border border-gray-700 bg-slate-950 p-2">
              <div className="space-y-1.5">
                <div className="h-2 w-3/4 rounded-sm bg-slate-700" />
                <div className="h-2 w-1/2 rounded-sm bg-slate-700" />
              </div>
              <div className="mt-2 flex gap-1.5">
                <div className="h-6 w-6 rounded-sm bg-purple-500" />
                <div className="h-6 flex-1 rounded-sm bg-slate-800" />
              </div>
            </div>
            <span className="text-sm font-medium">Oscuro</span>
          </Label>
        </RadioGroup>

        {saving && (
          <p className="text-muted-foreground text-xs">Guardando...</p>
        )}
      </div>
    </div>
  );
}
