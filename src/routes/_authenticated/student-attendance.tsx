import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalShell } from "@/components/PortalShell";
import { useProfile } from "@/hooks/useProfile";
import { formatDate, formatTime, type AttendanceRow, type ClassRow } from "@/lib/portal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/student-attendance")({
  head: () => ({
    meta: [
      { title: "My attendance — Tution Zone" },
      { name: "description", content: "Your full attendance history with present days and rate." },
      { property: "og:title", content: "My attendance — Tution Zone" },
      {
        property: "og:description",
        content: "Your full attendance history with present days and rate.",
      },
    ],
  }),
  component: StudentAttendance,
});

type Record_ = AttendanceRow & { classes: ClassRow | null };

function StudentAttendance() {
  const { data: me } = useProfile();

  const { data: records = [] } = useQuery({
    queryKey: ["my-attendance-history"],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, classes(*)")
        .order("marked_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Record_[];
    },
  });

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-aqua" />
      </div>
    );
  }

  const present = records.filter((r) => r.status === "present").length;
  const absent = records.length - present;
  const rate = records.length ? Math.round((present / records.length) * 100) : 0;

  return (
    <PortalShell
      role="student"
      name={me.profile?.full_name || "Student"}
      subtitle={me.profile?.class_selected ?? undefined}
    >
      <section className="grid grid-cols-3 gap-3">
        <Metric label="উপস্থিত" value={present} tone="text-aqua" />
        <Metric label="অনুপস্থিত" value={absent} tone="text-absent" />
        <Metric label="হাজিরা" value={`${rate}%`} tone="text-sky" />
      </section>

      <section className="mt-4 glass overflow-hidden">
        <div className="px-4 py-3">
          <h1 className="font-display text-sm font-semibold">হাজিরার ইতিহাস</h1>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead>
              <tr className="border-y border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Class</th>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No attendance recorded yet.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 hover:bg-accent/60">
                    <td className="px-4 py-3">
                      {r.classes ? formatDate(r.classes.scheduled_date) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.classes
                        ? `${formatTime(r.classes.start_time)}–${formatTime(r.classes.end_time)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{r.classes?.class_name ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">{r.classes?.subject_name ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          r.status === "present"
                            ? "bg-aqua/15 text-aqua"
                            : "bg-absent/15 text-absent",
                        )}
                      >
                        {r.status === "present" ? "উপস্থিত" : "অনুপস্থিত"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PortalShell>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="glass p-3 text-center">
      <p className={cn("font-display text-xl font-semibold", tone)}>{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
