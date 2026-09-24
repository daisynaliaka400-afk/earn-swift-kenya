import { supabase } from "@/integrations/supabase/client";

export async function getMyRole(): Promise<"admin" | "customer" | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  if (data?.some((r) => r.role === "admin")) return "admin";
  return "customer";
}
