import { notFound } from "next/navigation";

import { AdminPageContent } from "@/app/admin/AdminPageContent";
import { isAdminAccessAllowed } from "@/server/auth/admin";
import { getCurrentUser } from "@/server/auth/session";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!isAdminAccessAllowed(user)) {
    notFound();
  }

  return <AdminPageContent />;
}
