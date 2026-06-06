import { requireManagerOrAbove } from "@/lib/auth/helpers";

/**
 * Admin Layout
 *
 * Wraps administration pages. Accessible by managers and admins.
 */
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireManagerOrAbove();

  return children;
}
