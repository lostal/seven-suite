"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

const MicrosoftIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 21 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
);

export function LoginForm() {
  const handleSignIn = () => {
    signIn("microsoft-entra-id", { callbackUrl: "/" });
  };

  return (
    <div className="relative container grid h-svh flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:w-120 sm:p-8">
          <div className="mb-4 flex items-center justify-center">
            <Image
              src="/logo-light.png"
              alt="GRUPOSIETE"
              width={200}
              height={80}
              className="dark:hidden"
              priority
            />
            <Image
              src="/logo-dark.png"
              alt="GRUPOSIETE"
              width={200}
              height={80}
              className="hidden dark:block"
              priority
            />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-col justify-center space-y-6">
          <div className="flex flex-col space-y-2 text-center">
            <h2 className="text-lg font-semibold tracking-tight">
              Bienvenido a Seven Suite
            </h2>
            <p className="text-muted-foreground text-sm">
              Inicia sesión con tu cuenta de Microsoft 365
            </p>
          </div>

          <Button onClick={handleSignIn} className="w-full" size="lg">
            <MicrosoftIcon />
            Iniciar sesión con Microsoft
          </Button>

          <p className="text-muted-foreground text-center text-xs">
            Usa tu cuenta corporativa de Microsoft 365 para acceder. Contacta
            con tu administrador si no tienes acceso.
          </p>
        </div>
      </div>

      <div className="bg-muted relative hidden h-full overflow-hidden lg:block">
        <Image
          src="/mockup-light.png"
          alt="Seven Suite"
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover object-top select-none dark:hidden"
          priority
        />
        <Image
          src="/mockup-dark.png"
          alt="Seven Suite"
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="hidden object-cover object-top select-none dark:block"
          priority
        />
      </div>
    </div>
  );
}
