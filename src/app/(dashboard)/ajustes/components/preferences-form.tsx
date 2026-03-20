"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { updateTheme } from "../actions";
import type { ValidatedUserPreferences } from "@/lib/db/helpers";

/**
 * Local schema for the preferences form.
 * Only light/dark — "system" is managed via the navbar dropdown.
 */
const preferencesFormSchema = z.object({
  theme: z.enum(["light", "dark"]),
});

type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

interface PreferencesFormProps {
  preferences: Pick<ValidatedUserPreferences, "theme">;
}

export function PreferencesForm({ preferences }: PreferencesFormProps) {
  const { theme, setTheme } = useTheme();

  // Initialise with current theme cast to light/dark (shadcn-admin pattern).
  // If theme is "system", we fall back to the DB preference cast, or "light".
  const defaultValues: PreferencesFormValues = {
    theme:
      theme === "light" || theme === "dark"
        ? theme
        : preferences.theme === "dark"
          ? "dark"
          : "light",
  };

  const { handleSubmit, control, setValue } = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues,
  });

  const themeValue = useWatch({ control, name: "theme" });

  async function onSubmit(data: PreferencesFormValues) {
    if (data.theme !== theme) setTheme(data.theme);
    const result = await updateTheme({ theme: data.theme });
    if (!result.success) {
      toast.error(result.error ?? "Error al actualizar las preferencias");
    } else {
      toast.success("Preferencias actualizadas correctamente");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Theme with Visual Previews */}
      <div className="space-y-3">
        <Label>Tema</Label>
        <p className="text-muted-foreground text-sm">
          Selecciona el tema para el dashboard
        </p>
        <RadioGroup
          value={themeValue}
          onValueChange={(value) =>
            setValue("theme", value as "light" | "dark")
          }
          className="grid max-w-md grid-cols-2 gap-8 pt-2"
        >
          {/* Light Theme Preview */}
          <Label
            htmlFor="theme-light"
            className="[&:has([data-state=checked])>div]:border-primary cursor-pointer"
          >
            <RadioGroupItem
              value="light"
              id="theme-light"
              className="sr-only"
            />
            <div className="border-muted hover:border-accent items-center rounded-md border-2 p-1">
              <div className="space-y-2 rounded-sm bg-[#ecedef] p-2">
                <div className="space-y-2 rounded-md bg-white p-2 shadow-xs">
                  <div className="h-2 w-20 rounded-lg bg-[#ecedef]" />
                  <div className="h-2 w-25 rounded-lg bg-[#ecedef]" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs">
                  <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                  <div className="h-2 w-25 rounded-lg bg-[#ecedef]" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs">
                  <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                  <div className="h-2 w-25 rounded-lg bg-[#ecedef]" />
                </div>
              </div>
            </div>
            <span className="block w-full p-2 text-center font-normal">
              Claro
            </span>
          </Label>

          {/* Dark Theme Preview */}
          <Label
            htmlFor="theme-dark"
            className="[&:has([data-state=checked])>div]:border-primary cursor-pointer"
          >
            <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
            <div className="border-muted bg-popover hover:bg-accent hover:text-accent-foreground items-center rounded-md border-2 p-1">
              <div className="space-y-2 rounded-sm bg-slate-950 p-2">
                <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-xs">
                  <div className="h-2 w-20 rounded-lg bg-slate-400" />
                  <div className="h-2 w-25 rounded-lg bg-slate-400" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs">
                  <div className="h-4 w-4 rounded-full bg-slate-400" />
                  <div className="h-2 w-25 rounded-lg bg-slate-400" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs">
                  <div className="h-4 w-4 rounded-full bg-slate-400" />
                  <div className="h-2 w-25 rounded-lg bg-slate-400" />
                </div>
              </div>
            </div>
            <span className="block w-full p-2 text-center font-normal">
              Oscuro
            </span>
          </Label>
        </RadioGroup>
      </div>

      <Button type="submit">Actualizar preferencias</Button>
    </form>
  );
}
