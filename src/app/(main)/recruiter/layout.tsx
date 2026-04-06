import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export default async function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  const role = user?.user_metadata?.role;

  if (!user || (role !== "recruiter" && role !== "admin")) {
    redirect("/sign-in");
  }

  return <>{children}</>;
}
