/**
 * CommandMenu Component
 *
 * Command palette dialog (⌘K) with navigation and theme switching.
 * Based on shadcn-admin CommandMenu pattern.
 */

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSearch } from "@/context/search-context";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSidebarData } from "@/components/layout/data/sidebar-data";
import { updateTheme } from "@/app/(dashboard)/ajustes/actions";

export function CommandMenu() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { open, setOpen, role, visitorBookingEnabled } = useSearch();

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false);
      command();
    },
    [setOpen]
  );

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    setTheme(theme);
    void updateTheme({ theme });
  };

  // Filter nav items by role, same logic as AppSidebar.
  // Spot params default to false — command menu shows all reservable routes.
  const filteredNavGroups = React.useMemo(() => {
    const data = getSidebarData({
      hasParkingSpot: false,
      hasOfficeSpot: false,
      visitorBookingEnabled,
    });
    return data.navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.roles || item.roles.includes(role)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [role, visitorBookingEnabled]);

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Escribe un comando o busca..." />
      <CommandList>
        <ScrollArea type="hover" className="h-72 pe-1">
          <CommandEmpty>No se encontraron resultados.</CommandEmpty>
          {filteredNavGroups.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((navItem, i) => {
                if (navItem.url)
                  return (
                    <CommandItem
                      key={`${navItem.url}-${i}`}
                      value={navItem.title}
                      onSelect={() => {
                        runCommand(() => router.push(navItem.url));
                      }}
                    >
                      <div className="flex size-4 items-center justify-center">
                        <ArrowRight className="text-muted-foreground/80 size-2" />
                      </div>
                      {navItem.title}
                    </CommandItem>
                  );

                return navItem.items?.map((subItem, j) => (
                  <CommandItem
                    key={`${navItem.title}-${subItem.url}-${j}`}
                    value={`${navItem.title}-${subItem.url}`}
                    onSelect={() => {
                      runCommand(() => router.push(subItem.url));
                    }}
                  >
                    <div className="flex size-4 items-center justify-center">
                      <ArrowRight className="text-muted-foreground/80 size-2" />
                    </div>
                    {navItem.title} <ChevronRight /> {subItem.title}
                  </CommandItem>
                ));
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Tema">
            <CommandItem
              onSelect={() => runCommand(() => handleThemeChange("light"))}
            >
              <Sun /> <span>Claro</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => handleThemeChange("dark"))}
            >
              <Moon className="scale-90" />
              <span>Oscuro</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => handleThemeChange("system"))}
            >
              <Laptop />
              <span>Sistema</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  );
}
