"use client";

import { signIn } from "next-auth/react";

const DEMO_USERS = [
  {
    role: "Administrador",
    email: "admin@gruposiete.es",
    description: "Acceso total — analíticas, CRUD, configuración",
  },
  {
    role: "Manager",
    email: "manager@gruposiete.es",
    description: "Plazas asignadas — cede parking, aprueba ausencias",
  },
  {
    role: "RRHH",
    email: "rrhh@gruposiete.es",
    description: "Valida vacaciones, publica anuncios",
  },
  {
    role: "Empleado",
    email: "empleado@gruposiete.es",
    description: "Reserva plazas, solicita vacaciones",
  },
];

export function DevLoginClient() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-950 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white">Dev Login</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Selecciona un rol para iniciar sesión sin Microsoft Entra ID
        </p>
      </div>

      <div className="grid w-full max-w-sm gap-3">
        {DEMO_USERS.map((user) => (
          <button
            key={user.email}
            onClick={() =>
              signIn("dev-credentials", {
                email: user.email,
                callbackUrl: "/",
              })
            }
            className="flex flex-col items-start gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800"
          >
            <span className="text-sm font-medium text-white">{user.role}</span>
            <span className="text-xs text-zinc-500">{user.email}</span>
            <span className="text-xs text-zinc-600">{user.description}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-zinc-600">
        Esta página solo está disponible en desarrollo
      </p>
    </div>
  );
}
