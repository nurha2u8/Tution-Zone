import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalShell } from "@/components/PortalShell";
import { useProfile } from "@/hooks/useProfile";
import { type NoticeRow } from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/student-notices")({
  head: () => ({
    meta: [
      { title: "Notices — Tution Zone" },
      { name: "description", content: "Notices published by your teacher." },
      { property: "og:title", content: "Notices — Tution Zone" },
      { property: "og:description", content: "Notices published by your teacher." },
    ],
  }),
  component: StudentNotices,
});

function StudentNotices() {
  const { data: me } = useProfile();

  const { data: notices = [] } = useQuery({
    queryKey: ["student-notices"],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as NoticeRow[];
    },
  });

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-aqua" />
      </div>
    );
  }

  const myClass = me.profile?.class_selected ?? null;
  const visible = notices.filter((n) => !n.class_name || n.class_name === myClass);

  return (
    <PortalShell
      role="student"
      name={me.profile?.full_name || "Student"}
      subtitle={myClass ?? undefined}
    >
      <section className="glass p-4">
        <div className="flex items-center gap-2 text-aqua">
          <Megaphone className="size-5" />
          <h1 className="font-display text-sm font-semibold text-foreground">নোটিশ বোর্ড</h1>
        </div>
        <div className="mt-3 space-y-2">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              এখনো কোনো নোটিশ নেই।
            </p>
          ) : (
            visible.map((n) => (
              <div key={n.id} className="glass-soft px-3 py-2.5">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{n.body}</p>
                ) : null}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("en-GB")}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </PortalShell>
  );
}
