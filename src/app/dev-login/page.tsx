import { DevLoginClient } from "./dev-login-client";

export default function DevLoginPage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.DEV_LOGIN_ENABLED !== "true"
  )
    return null;
  return <DevLoginClient />;
}
