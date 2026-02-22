"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2, Users } from "lucide-react";
import Image from "next/image";

type UserType = "employee" | "management";

/**
 * Login Page - Development Mode
 *
 * Temporary login with email/password for local development.
 * Replace with Microsoft Teams OAuth when configured in production.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [userType, setUserType] = useState<UserType>("employee");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const supabase = createClient();
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${ROUTES.CALLBACK}`,
            data: {
              full_name: fullName,
              user_type: userType,
            },
          },
        });
        if (error) throw error;
        setError("Revisa tu email para confirmar la cuenta");
        setLoading(false);
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Redirigir a / para que la página raíz resuelva la ruta según el rol
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
              alt="GRUPOSIETE Parking"
              width={240}
              height={80}
              className="h-20 w-auto dark:hidden"
              priority
            />
            {/* Logo modo oscuro */}
            <Image
              src="/logo-dark.png"
              alt="GRUPOSIETE Parking"
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
              <div className="grid gap-2">
                <Label>Tipo de usuario</Label>
                <p className="text-muted-foreground text-xs">
                  Si perteneces a dirección, el administrador te asignará tu
                  plaza antes de que puedas cederla.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUserType("employee")}
                    disabled={loading}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-colors",
                      userType === "employee"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    <Users className="h-6 w-6" />
                    <span className="font-medium">General</span>
                    <span className="text-center text-xs opacity-70">
                      Acceso completo desde el inicio
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserType("management")}
                    disabled={loading}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-colors",
                      userType === "management"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    <Building2 className="h-6 w-6" />
                    <span className="font-medium">Dirección</span>
                    <span className="text-center text-xs opacity-70">
                      Requiere plaza asignada por admin
                    </span>
                  </button>
                </div>
              </div>
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

          <div className="bg-muted text-muted-foreground rounded-md p-3 text-xs">
            <strong>MODO DESARROLLO:</strong> En producción se usará Microsoft
            Teams para autenticación.
          </div>
        </div>
      </div>

      {/* Right Column - Mockup */}
      <div className="bg-muted relative hidden h-full overflow-hidden lg:block">
        {/* Mockup modo claro */}
        <Image
          src="/mockup-light.png"
          alt="GRUPOSIETE Parking"
          fill
          className="object-cover object-top select-none dark:hidden"
          priority
        />
        {/* Mockup modo oscuro */}
        <Image
          src="/mockup-dark.png"
          alt="GRUPOSIETE Parking"
          fill
          className="hidden object-cover object-top select-none dark:block"
          priority
        />
      </div>
    </div>
  );
}
