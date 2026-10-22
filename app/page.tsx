import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { DASHBOARD_PATH, LOGIN_PATH } from "@/lib/auth/routes";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? DASHBOARD_PATH : LOGIN_PATH);
}
