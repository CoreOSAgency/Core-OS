import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../logout/actions";
import DashboardShell from "./DashboardShell";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="min-h-screen bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4 sm:px-10">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">CoreOS</h1>
          <p className="text-xs text-neutral-500">{user.email}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="px-6 py-8 sm:px-10">
        <DashboardShell />
      </div>
    </main>
  );
}
