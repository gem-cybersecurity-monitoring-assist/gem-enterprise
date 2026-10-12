import { redirect } from "next/navigation";

/** Short, memorable entry point; real API and dashboard permissions remain unchanged. */
export default function SentinelShortcut() {
  redirect("/app/admin/sentinel");
}
