import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileRow } from "@/lib/portal";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      const isTeacher = (roles ?? []).some((r) => r.role === "teacher");
      return {
        userId: user.id,
        email: user.email ?? null,
        role: isTeacher ? ("teacher" as const) : ("student" as const),
        profile: (profile ?? null) as ProfileRow | null,
      };
    },
    staleTime: 30_000,
  });
}
