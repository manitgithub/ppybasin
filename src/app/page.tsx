import DashboardShell from "@/components/DashboardShell";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialData = await getDashboardData();

  return <DashboardShell initialData={initialData} />;
}
