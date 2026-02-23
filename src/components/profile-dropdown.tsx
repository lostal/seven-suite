/**
 * ProfileDropdown Component
 *
 * Header profile avatar with dropdown menu.
 * Shows user info, quick links, and sign out option.
 * Based on shadcn-admin ProfileDropdown pattern.
 */

"use client";

import Link from "next/link";
import { CalendarCheck, Repeat2, User } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import useDialogState from "@/hooks/use-dialog-state";
import { ROUTES } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignOutDialog } from "@/components/sign-out-dialog";

export function ProfileDropdown() {
  const { profile, loading } = useUser();
  const [open, setOpen] = useDialogState();

  const displayName = profile?.full_name ?? "";
  const displayEmail = profile?.email || "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const role = profile?.role;

  // Reservation/cession link depends on role (mirrors nav-user.tsx)
  const reservationLink =
    role === "management"
      ? { href: ROUTES.MIS_RESERVAS, label: "Mis Cesiones", icon: Repeat2 }
      : role === "employee"
        ? {
            href: ROUTES.MIS_RESERVAS,
            label: "Mis Reservas",
            icon: CalendarCheck,
          }
        : null;

  if (loading) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm leading-none font-medium">{displayName}</p>
              <p className="text-muted-foreground text-xs leading-none">
                {displayEmail}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={ROUTES.SETTINGS}>
                <User />
                Perfil
                <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
              </Link>
            </DropdownMenuItem>
            {reservationLink && (
              <DropdownMenuItem asChild>
                <Link href={reservationLink.href}>
                  <reservationLink.icon />
                  {reservationLink.label}
                  <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setOpen(true)}>
            Cerrar sesión
            <DropdownMenuShortcut className="text-current">
              ⇧⌘Q
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  );
}
