import DashboardShell from "@/components/DashboardShell";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [initialData, initialUser] = await Promise.all([
    getDashboardData(),
    getCurrentUser(),
  ]);

  return <DashboardShell initialData={initialData} initialUser={initialUser} />;
}
