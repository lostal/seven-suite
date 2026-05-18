import { DevLoginClient } from "./dev-login-client";

export default function DevLoginPage() {
  if (process.env.NODE_ENV === "production") return null;
  return <DevLoginClient />;
}
