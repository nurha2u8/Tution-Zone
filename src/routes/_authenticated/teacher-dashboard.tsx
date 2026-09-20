import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarPlus,
  ClipboardCheck,
  Pencil,
  Trash2,
  X,
  Users,
  Loader2,
  KeyRound,
  Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalShell } from "@/components/PortalShell";
import { useProfile } from "@/hooks/useProfile";
import {
  CLASS_LEVELS,
  DEPARTMENTS,
  formatDate,
  formatTime,
  isUpcoming,
  type ClassRow,
} from "@/lib/portal";
import { cn } from "@/lib/utils";

function TeacherCodeCard() {
  const { data: code } = useQuery({
    queryKey: ["my-teacher-code"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ensure_my_teacher_code");
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    staleTime: 5 * 60_000,
  });

  return (
    <section className="glass flex flex-wrap items-center gap-3 p-4">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl glass-soft text-aqua">
        <KeyRound className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="eyebrow text-aqua">Your student registration code</p>
        <p className="font-display text-xl font-bold tracking-widest">{code ?? "…"}</p>
        <p className="text-[11px] text-muted-foreground">
          Students register with this code to join your classes.
        </p>
      </div>
      <button
        type="button"
        disabled={!code}
        onClick={() => {
          void navigator.clipboard.writeText(code!);
          toast.success("Code copied.");
        }}
        className="ml-auto flex items-center gap-1.5 rounded-xl glass-soft px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <Copy className="size-3.5" /> Copy
      </button>
    </section>
  );
}

export const Route = createFileRoute("/_authenticated/teacher-dashboard")({
  head: () => ({
    meta: [
      { title: "Teacher dashboard — Tution Zone" },
      { name: "description", content: "Create, edit and review your scheduled classes." },
      { property: "og:title", content: "Teacher dashboard — Tution Zone" },
      { property: "og:description", content: "Create, edit and review your scheduled classes." },
    ],
  }),
  component: TeacherDashboard,
});

const inputClass =
  "w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";

function TeacherDashboard() {
  const { data: me, isLoading } = useProfile();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);

  const { data: classes = [] } = useQuery({
    queryKey: ["teacher-classes"],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", me!.userId)
        .order("scheduled_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as ClassRow[];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class deleted.");
      queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !me) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-aqua" />
      </div>
    );
  }

  const upcoming = classes.filter(isUpcoming);

  return (
    <PortalShell
      role="teacher"
      name={me.profile?.full_name || me.email || "Teacher"}
      subtitle={me.email ?? undefined}
    >
      <TeacherCodeCard />

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="glass p-4 text-left transition-colors hover:bg-accent"
        >
          <CalendarPlus className="size-5 text-aqua" />
          <p className="mt-3 font-display text-sm font-semibold">Create class</p>
          <p className="text-[11px] text-muted-foreground">Schedule a new session</p>
        </button>
        <div className="glass p-4">
          <Users className="size-5 text-violet" />
          <p className="mt-3 font-display text-2xl font-bold">{upcoming.length}</p>
          <p className="text-[11px] text-muted-foreground">Upcoming classes</p>
        </div>
        <Link to="/teacher-attendance" className="glass p-4 transition-colors hover:bg-accent">
          <ClipboardCheck className="size-5 text-sky" />
          <p className="mt-3 font-display text-sm font-semibold">Mark attendance</p>
          <p className="text-[11px] text-muted-foreground">Present / absent per student</p>
        </Link>
      </div>

      {formOpen ? (
        <ClassForm
          teacherId={me.userId}
          subjects={subjects.map((s) => s.name)}
          editing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      ) : null}

      <section className="mt-5 glass overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="font-display text-sm font-semibold">Your schedule</h2>
          <span className="text-[11px] text-muted-foreground">{classes.length} classes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-y border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Class</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Notes</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No classes scheduled yet.
                  </td>
                </tr>
              ) : (
                classes.map((c) => (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-border/60 transition-colors hover:bg-accent/60",
                      isUpcoming(c) ? "bg-aqua/5" : "opacity-70",
                    )}
                  >
                    <td className="px-4 py-3 font-medium">{c.subject_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.class_name}</td>
                    <td className="px-4 py-3">{formatDate(c.scheduled_date)}</td>
                    <td className="px-4 py-3">
                      {formatTime(c.start_time)}–{formatTime(c.end_time)}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {c.notes || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditing(c);
                            setFormOpen(true);
                          }}
                          className="grid size-8 place-items-center rounded-lg glass-soft text-muted-foreground hover:text-aqua"
                          aria-label="Edit class"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => remove.mutate(c.id)}
                          className="grid size-8 place-items-center rounded-lg glass-soft text-muted-foreground hover:text-destructive"
                          aria-label="Delete class"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
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

function ClassForm({
  teacherId,
  subjects,
  editing,
  onClose,
}: {
  teacherId: string;
  subjects: string[];
  editing: ClassRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [className, setClassName] = useState(editing?.class_name ?? CLASS_LEVELS[0]!);
  const [department, setDepartment] = useState(editing?.department ?? DEPARTMENTS[0]!);
  const [subject, setSubject] = useState(editing?.subject_name ?? subjects[0] ?? "");
  const [newSubject, setNewSubject] = useState("");
  const [date, setDate] = useState(editing?.scheduled_date ?? "");
  const [start, setStart] = useState(editing?.start_time?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(editing?.end_time?.slice(0, 5) ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const subjectName = (newSubject.trim() || subject).trim();
      if (!subjectName) throw new Error("Pick or add a subject.");
      if (end <= start) throw new Error("End time must be after the start time.");

      // Block a class that clashes with another class on the same date.
      const { data: sameDay, error: clashError } = await supabase
        .from("classes")
        .select("id,subject_name,class_name,start_time,end_time")
        .eq("teacher_id", teacherId)
        .eq("scheduled_date", date);
      if (clashError) throw clashError;

      const clash = (sameDay ?? [])
        .filter((c) => c.id !== editing?.id)
        .find((c) => start < c.end_time.slice(0, 5) && end > c.start_time.slice(0, 5));
      if (clash) {
        throw new Error(
          `Already exists: ${clash.subject_name} (${clash.class_name}) is scheduled ${clash.start_time.slice(0, 5)}–${clash.end_time.slice(0, 5)} on this date. Please change the time or the date.`,
        );
      }


      if (newSubject.trim()) {
        await supabase
          .from("subjects")
          .insert({ name: subjectName, created_by: teacherId })
          .select()
          .maybeSingle();
      }

      const payload = {
        teacher_id: teacherId,
        class_name: className,
        subject_name: subjectName,
        department,
        scheduled_date: date,
        start_time: start,
        end_time: end,
        notes: notes.trim() || null,
      };

      const overlapMessage =
        "Already exists: another class is scheduled at this date and time. Please change the time or the date.";

      if (editing) {
        const { error } = await supabase.from("classes").update(payload).eq("id", editing.id);
        if (error) throw new Error(/overlap|exclusion/i.test(error.message) ? overlapMessage : error.message);
      } else {
        const { error } = await supabase.from("classes").insert(payload);
        if (error) throw new Error(/overlap|exclusion/i.test(error.message) ? overlapMessage : error.message);
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Class updated." : "Class scheduled — students notified.");
      queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-5 glass p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold">
          {editing ? "Edit class" : "Create a class"}
        </h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Class level</span>
          <select
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className={inputClass}
          >
            {CLASS_LEVELS.map((c) => (
              <option key={c} value={c} className="bg-popover">
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Department</span>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className={inputClass}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d} className="bg-popover">
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Subject name</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass}>
            {subjects.map((s) => (
              <option key={s} value={s} className="bg-popover">
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] text-muted-foreground">Or add a new subject</span>
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            className={inputClass}
            placeholder="e.g. Higher Math"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Date</span>
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">Start</span>
            <input
              required
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">End</span>
            <input
              required
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] text-muted-foreground">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Bring lab notebook"
          />
        </label>
        <button
          type="submit"
          disabled={save.isPending}
          className="flex items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-key)] px-4 py-2.5 font-display text-sm font-semibold text-primary-foreground sm:col-span-2 disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {editing ? "Save changes" : "Schedule class"}
        </button>
      </form>
    </section>
  );
}
