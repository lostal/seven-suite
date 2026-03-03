"use client";

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
import { cn } from "@/lib/utils";
import { Globe, Car, Building2 } from "lucide-react";

const adminSettingsSections = [
  {
    id: "general",
    label: "General",
    icon: Globe,
    href: ROUTES.ADMIN_SETTINGS,
  },
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

export function AdminSettingsSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/* Mobile: Select Dropdown */}
      <div className="p-1 md:hidden">
        <Select
          value={pathname ?? ROUTES.ADMIN_SETTINGS}
          onValueChange={(href) => router.push(href)}
        >
          <SelectTrigger className="h-12 sm:w-48">
            <SelectValue placeholder="Seleccionar sección" />
          </SelectTrigger>
          <SelectContent>
            {adminSettingsSections.map((section) => {
              const Icon = section.icon;
              return (
                <SelectItem key={section.id} value={section.href}>
                  <div className="flex gap-x-4 px-2 py-1">
                    <span className="scale-125">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-md">{section.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Link List */}
      <ScrollArea className="hidden max-h-200 w-full px-1 pb-2 md:block">
        <nav className="flex flex-col gap-y-1">
          {adminSettingsSections.map((section) => {
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
        </nav>
      </ScrollArea>
    </>
  );
}
