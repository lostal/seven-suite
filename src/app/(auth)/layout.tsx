/**
 * Auth Layout
 *
 * Wraps authentication pages (login, callback).
 * Minimal layout — no sidebar, no nav.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-background flex min-h-svh items-center justify-center">
      {children}
    </div>
  );
}
