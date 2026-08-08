import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="min-h-screen ms-64 box-border p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
