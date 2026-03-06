/**
 * Header Component
 *
 * Page header with SidebarTrigger, separator and children slots.
 * Supports sticky positioning with scroll-aware shadow.
 * Based on shadcn-admin Header pattern.
 */

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

type HeaderProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean;
};

export function Header({ className, fixed, children, ...props }: HeaderProps) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!fixed) return;
    const onScroll = () => {
      setOffset(document.body.scrollTop || document.documentElement.scrollTop);
    };

    document.addEventListener("scroll", onScroll, { passive: true });
    return () => document.removeEventListener("scroll", onScroll);
  }, [fixed]);

  const scrolled = fixed && offset > 10;

  return (
    <header
      className={cn(
        "z-50 h-16 transition-shadow duration-300",
        fixed && "header-fixed peer/header sticky top-0 w-[inherit]",
        scrolled ? "shadow" : "shadow-none",
        className
      )}
      {...props}
    >
      <div className="relative flex h-full items-center gap-3 p-4 sm:gap-4">
        {/* Overlay de blur que aparece suavemente al hacer scroll */}
        <div
          className={cn(
            "bg-background/20 pointer-events-none absolute inset-0 -z-10 backdrop-blur-lg transition-opacity duration-300",
            scrolled ? "opacity-100" : "opacity-0"
          )}
        />
        <SidebarTrigger
          variant="outline"
          className="max-md:scale-125"
          aria-label="Alternar barra lateral"
        />
        <Separator orientation="vertical" className="h-6" />
        {children}
      </div>
    </header>
  );
}
