import DashboardShell from "@/components/DashboardShell";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";
import { headers } from "next/headers";
import { allowsLocalPreview } from "@/lib/local-preview";
import LocalPreviewSwitcher from "@/components/LocalPreviewSwitcher";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [initialData, initialUser] = await Promise.all([
    getDashboardData(),
    getCurrentUser(),
  ]);

  const headerStore = await headers();
  const dashboard = <DashboardShell initialData={initialData} initialUser={initialUser} />;
  if (allowsLocalPreview(process.env.NODE_ENV, headerStore.get("host"), headerStore.get("x-forwarded-host"))) {
    return <LocalPreviewSwitcher loggedIn={Boolean(initialUser)}>{dashboard}</LocalPreviewSwitcher>;
  }
  return dashboard;
}
