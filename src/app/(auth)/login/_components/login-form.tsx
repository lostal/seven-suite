"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/lib/auth/sign-in";
import { signUpAction } from "@/lib/auth/sign-up";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Car, Building2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Entity } from "@/lib/db/types";

type LoginFormProps = {
  entities: Entity[];
};

export function LoginForm({ entities }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [entityId, setEntityId] = useState<string>("");
  const [hasFixedParking, setHasFixedParking] = useState(false);
  const [hasFixedOffice, setHasFixedOffice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        const result = await signUpAction({
          email,
          password,
          fullName,
          entityId,
          phone,
          hasFixedParking,
          hasFixedOffice,
        });

        if (!result.success) {
          throw new Error(result.error ?? "Error al crear la cuenta");
        }

        setError("Cuenta creada correctamente. Ya puedes iniciar sesión.");
        setMode("login");
        setPassword("");
        setLoading(false);
        return;
      } else {
        const result = await signInAction({
          email,
          password,
        });

        if (!result.success) {
          throw new Error(result.error ?? "Error al autenticar");
        }

        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al autenticar");
      setLoading(false);
    }
  };

  return (
    <div className="relative container grid h-svh flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
      {/* Left Column - Login Form */}
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:w-120 sm:p-8">
          <div className="mb-4 flex items-center justify-center">
            {/* Logo modo claro */}
            <Image
              src="/logo-light.png"
              alt="GRUPOSIETE"
              width={240}
              height={80}
              className="h-20 w-auto dark:hidden"
              priority
            />
            {/* Logo modo oscuro */}
            <Image
              src="/logo-dark.png"
              alt="GRUPOSIETE"
              width={240}
              height={80}
              className="hidden h-20 w-auto dark:block"
              priority
            />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-col justify-center space-y-6">
          <div className="flex flex-col space-y-2 text-start">
            <h2 className="text-lg font-semibold tracking-tight">
              {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {mode === "login"
                ? "Introduce tu email y contraseña para acceder"
                : "Introduce tus datos para crear una cuenta"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="grid gap-4">
            {mode === "signup" && (
              <div className="grid gap-2">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan García López"
                  required
                  disabled={loading}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@gruposiete.com"
                required
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                disabled={loading}
              />
            </div>

            {mode === "signup" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="entityId">Sede</Label>
                  <Select
                    value={entityId}
                    onValueChange={setEntityId}
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
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone">
                    Teléfono{" "}
                    <span className="text-muted-foreground font-normal">
                      (opcional)
                    </span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-3">
                  <Label>Plazas fijas asignadas</Label>
                  <p className="text-muted-foreground text-xs">
                    Marca si ya tienes plaza fija. El administrador te la
                    asignará tras el registro para que puedas gestionarla.
                  </p>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="hasFixedParking"
                        checked={hasFixedParking}
                        onCheckedChange={(v) => setHasFixedParking(!!v)}
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
                        onCheckedChange={(v) => setHasFixedOffice(!!v)}
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
              </>
            )}

            {error && (
              <div
                className={cn(
                  "rounded-md p-3 text-sm",
                  error.includes("Revisa tu email")
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="animate-spin" />}
              {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </Button>
          </form>

          <div className="text-center">
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
              }}
              className="text-muted-foreground hover:text-primary text-sm hover:underline"
              type="button"
            >
              {mode === "login"
                ? "¿No tienes cuenta? Créala"
                : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
          </div>

          {process.env.NODE_ENV === "development" && (
            <div className="bg-muted text-muted-foreground rounded-md p-3 text-xs">
              <strong>MODO DESARROLLO:</strong> En producción se usará Microsoft
              Teams para autenticación.
            </div>
          )}
        </div>
      </div>

      {/* Right Column - Mockup */}
      <div className="bg-muted relative hidden h-full overflow-hidden lg:block">
        {/* Mockup modo claro */}
        <Image
          src="/mockup-light.png"
          alt="Seven Suite"
          fill
          className="object-cover object-top select-none dark:hidden"
          priority
        />
        {/* Mockup modo oscuro */}
        <Image
          src="/mockup-dark.png"
          alt="Seven Suite"
          fill
          className="hidden object-cover object-top select-none dark:block"
          priority
        />
      </div>
    </div>
  );
}
