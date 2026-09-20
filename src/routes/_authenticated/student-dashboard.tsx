import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Loader2, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalShell } from "@/components/PortalShell";
import { useProfile } from "@/hooks/useProfile";
import {
  countdown,
  formatDate,
  formatTime,
  isUpcoming,
  type AttendanceRow,
  type ClassRow,
} from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/student-dashboard")({
  head: () => ({
    meta: [
      { title: "Student dashboard — Tution Zone" },
      { name: "description", content: "See your next class, full schedule and attendance rate." },
      { property: "og:title", content: "Student dashboard — Tution Zone" },
      {
        property: "og:description",
        content: "See your next class, full schedule and attendance rate.",
      },
    ],
  }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { data: me } = useProfile();
  const queryClient = useQueryClient();
  const myClass = me?.profile?.class_selected ?? null;
  const myTeacher = me?.profile?.teacher_id ?? null;

  const { data: classes = [] } = useQuery({
    queryKey: ["student-classes", myClass, myTeacher],
    enabled: !!myClass && !!myTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("class_name", myClass!)
        .eq("teacher_id", myTeacher!)
        .order("scheduled_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as ClassRow[];
    },
  });


  const { data: attendance = [] } = useQuery({
    queryKey: ["my-attendance"],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*");
      if (error) throw error;
      return data as AttendanceRow[];
    },
  });

  const { data: notificationsData } = useQuery({
    queryKey: ["notifications"],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const notifications = notificationsData ?? [];

  useEffect(() => {
    const unread = (notificationsData ?? []).filter((n) => !n.read);
    if (unread.length === 0) return;
    void supabase
      .from("notifications")
      .update({ read: true })
      .in(
        "id",
        unread.map((n) => n.id),
      )
      .then(() => queryClient.invalidateQueries({ queryKey: ["unread-notifications"] }));
  }, [notificationsData, queryClient]);

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-aqua" />
      </div>
    );
  }

  const upcoming = classes.filter(isUpcoming);
  const next = upcoming[0] ?? null;
  const present = attendance.filter((a) => a.status === "present").length;
  const total = attendance.length;
  const rate = total ? Math.round((present / total) * 100) : 0;

  return (
    <PortalShell
      role="student"
      name={me.profile?.full_name || "Student"}
      subtitle={myClass ?? undefined}
    >
      {/* Next class hero */}
      <section className="glass p-4">
        <div className="flex items-center gap-2 text-aqua">
          <span className="eyebrow">পরবর্তী ক্লাস</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        {next ? (
          <>
            <h1 className="mt-2 font-display text-[26px] font-bold leading-tight">
              আপনার ক্লাস: {next.subject_name}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              ক্লাস: {next.class_name}
              {next.notes ? ` · ${next.notes}` : ""}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="তারিখ" value={formatDate(next.scheduled_date)} />
              <Stat
                label="সময়"
                value={`${formatTime(next.start_time)}–${formatTime(next.end_time)}`}
              />
              <Stat label="বাকি" value={countdown(next)} highlight />
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-display text-[22px] font-bold leading-tight">
              এখন কোনো ক্লাস নির্ধারিত নেই
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {myClass
                ? `${myClass}-এর জন্য নতুন ক্লাস যুক্ত হলে এখানে দেখা যাবে।`
                : "Add your class level to your profile to see a schedule."}
            </p>
          </>
        )}
      </section>

      {/* Attendance ring */}
      <section className="mt-3 flex items-center gap-3 glass p-3">
        <div className="relative grid size-14 shrink-0 place-items-center rounded-full">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from 0deg, var(--aqua) ${rate * 3.6}deg, oklch(0.985 0.005 250 / 10%) ${rate * 3.6}deg)`,
            }}
          />
          <div className="absolute inset-[5px] rounded-full bg-deep" />
          <span className="relative font-display text-sm font-bold">{rate}%</span>
        </div>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold">Attendance</p>
          <p className="text-[11px] text-muted-foreground">
            Present {present} of {total} classes
          </p>
        </div>
        <Link
          to="/student-attendance"
          className="ml-auto shrink-0 text-[11px] font-semibold text-aqua"
        >
          See all
        </Link>
      </section>

      {/* Your classes */}
      <div className="mt-4 flex items-center justify-between">
        <p className="font-display text-sm font-semibold">Your classes</p>
        <span className="text-[11px] text-muted-foreground">{upcoming.length} upcoming</span>
      </div>
      <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
        {upcoming.length === 0 ? (
          <div className="glass-soft flex w-full items-center gap-2 p-4 text-xs text-muted-foreground">
            <CalendarDays className="size-4" /> Nothing scheduled yet.
          </div>
        ) : (
          upcoming.map((c) => (
            <div key={c.id} className="w-44 shrink-0 glass-soft p-3">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-aqua/15 px-2 py-0.5 text-[9px] font-semibold text-aqua">
                  {formatDate(c.scheduled_date)}
                </span>
                <span className="text-[10px] text-muted-foreground">{formatTime(c.start_time)}</span>
              </div>
              <p className="mt-2 font-display text-sm font-semibold">{c.subject_name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {c.class_name} · {formatTime(c.start_time)}–{formatTime(c.end_time)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Notifications */}
      {notifications.length > 0 ? (
        <section className="mt-4 glass p-3">
          <p className="font-display text-sm font-semibold">Notifications</p>
          <div className="mt-2 space-y-1.5">
            {notifications.map((n) => (
              <div key={n.id} className="glass-soft px-3 py-2">
                <p className="text-[12px] font-medium">{n.title}</p>
                <p className="text-[10px] text-muted-foreground">{n.body}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </PortalShell>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="glass-soft p-3">
      <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-display text-sm font-semibold ${highlight ? "text-aqua" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
