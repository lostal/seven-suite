"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  User,
  Bell,
  Cloud,
  Shield,
  Palette,
  Globe,
  Car,
  Building2,
} from "lucide-react";

const personalSections = [
  { id: "perfil", label: "Perfil", icon: User, href: "/ajustes/perfil" },
  {
    id: "notificaciones",
    label: "Notificaciones",
    icon: Bell,
    href: ROUTES.SETTINGS_NOTIFICATIONS,
  },
  {
    id: "apariencia",
    label: "Apariencia",
    icon: Palette,
    href: ROUTES.SETTINGS_APPEARANCE,
  },
  {
    id: "microsoft",
    label: "Microsoft 365",
    icon: Cloud,
    href: ROUTES.SETTINGS_MICROSOFT,
  },
  {
    id: "seguridad",
    label: "Seguridad",
    icon: Shield,
    href: ROUTES.SETTINGS_SECURITY,
  },
] as const;

const systemSections = [
  { id: "general", label: "General", icon: Globe, href: ROUTES.ADMIN_SETTINGS },
  {
    id: "parking",
    label: "Parking",
    icon: Car,
    href: ROUTES.ADMIN_SETTINGS_PARKING,
  },
  {
    id: "oficinas",
    label: "Oficinas",
    icon: Building2,
    href: ROUTES.ADMIN_SETTINGS_OFFICES,
  },
] as const;

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground px-2 pt-3 pb-1 text-[11px] font-medium">
      {children}
    </div>
  );
}

export function SettingsSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <div className="p-1 md:hidden">
        <Select
          value={pathname ?? ROUTES.SETTINGS}
          onValueChange={(href) => router.push(href)}
        >
          <SelectTrigger className="h-12 sm:w-48">
            <SelectValue placeholder="Seleccionar sección" />
          </SelectTrigger>
          <SelectContent>
            {!isAdmin ? (
              personalSections.map((s) => (
                <SelectItem key={s.id} value={s.href}>
                  <div className="flex gap-x-4 px-2 py-1">
                    <s.icon className="h-4 w-4" />
                    <span className="text-md">{s.label}</span>
                  </div>
                </SelectItem>
              ))
            ) : (
              <>
                {personalSections.map((s) => (
                  <SelectItem key={s.id} value={s.href}>
                    <div className="flex gap-x-4 px-2 py-1">
                      <s.icon className="h-4 w-4" />
                      <span className="text-md">{s.label}</span>
                    </div>
                  </SelectItem>
                ))}
                {systemSections.map((s) => (
                  <SelectItem key={`sys-${s.id}`} value={s.href}>
                    <div className="flex gap-x-4 px-2 py-1">
                      <s.icon className="h-4 w-4" />
                      <span className="text-md">{s.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="hidden max-h-200 w-full px-1 pb-2 md:block">
        <nav className="flex flex-col gap-y-0.5">
          {isAdmin && <SectionLabel>Personal</SectionLabel>}
          {personalSections.map((section) => {
            const Icon = section.icon;
            const isActive = pathname === section.href;
            return (
              <Link
                key={section.id}
                href={section.href}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "justify-start",
                  isActive && "bg-muted hover:bg-muted font-medium"
                )}
              >
                <Icon className="mr-2 h-4 w-4" />
                {section.label}
              </Link>
            );
          })}
          {isAdmin && (
            <>
              <div className="py-1.5">
                <Separator />
              </div>
              <SectionLabel>Sistema</SectionLabel>
              {systemSections.map((section) => {
                const Icon = section.icon;
                const isActive = pathname === section.href;
                return (
                  <Link
                    key={`sys-${section.id}`}
                    href={section.href}
                    className={cn(
                      buttonVariants({ variant: "ghost" }),
                      "justify-start",
                      isActive && "bg-muted hover:bg-muted font-medium"
                    )}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {section.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
      </ScrollArea>
    </>
  );
}
