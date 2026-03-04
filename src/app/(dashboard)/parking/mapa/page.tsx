import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants";

export default function ParkingMapRedirectPage() {
  redirect(ROUTES.OFFICES_MAP);
}
