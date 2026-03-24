import { getUser } from "@/lib/auth";
import DropdownNavbar from "../DropdownNavbar";

export default async function LandingNavbar() {
  const user = await getUser();
  const role = user?.user_metadata?.role as string | undefined;

  return (
    <DropdownNavbar
      user={user ? { role } : null}
      variant="dark"
    />
  );
}
