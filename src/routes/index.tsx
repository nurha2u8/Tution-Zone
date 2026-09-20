import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Presentation, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CLASS_LEVELS, DEPARTMENTS, generateStudentId, usesDepartment } from "@/lib/portal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Tution Zone Teacher & Student Portal" },
      {
        name: "description",
        content:
          "Sign in to Tution Zone to schedule classes, mark attendance and track your own attendance record.",
      },
      { property: "og:title", content: "Sign in — Tution Zone Teacher & Student Portal" },
      {
        property: "og:description",
        content: "Class scheduling and attendance for teachers and students.",
      },
    ],
  }),
  component: AuthPage,
});

type Portal = "student" | "teacher";

function AuthPage() {
  const navigate = useNavigate();
  const [portal, setPortal] = useState<Portal>("student");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentId] = useState(() => generateStudentId());
  const [phone, setPhone] = useState("");
  const [classSelected, setClassSelected] = useState(CLASS_LEVELS[0]!);
  const [subjectSelected, setSubjectSelected] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]!);
  const [teacherCode, setTeacherCode] = useState("");
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      if (data.user) {
        await routeByRole(data.user.id);
      } else {
        setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function routeByRole(userId: string) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isTeacher = (roles ?? []).some((r) => r.role === "teacher");
    navigate({ to: isTeacher ? "/teacher-dashboard" : "/student-dashboard", replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await routeByRole(data.user.id);
        return;
      }

      if (portal === "student") {
        const { data: found, error: lookupError } = await supabase.rpc("find_teacher_by_code", {
          _code: teacherCode.trim(),
        });
        if (lookupError) throw lookupError;
        if (!found || found.length === 0) {
          throw new Error("That teacher code is not valid. Ask your teacher for their code.");
        }
      }

      const metadata =
        portal === "student"
          ? {
              full_name: fullName,
              student_id: studentId,
              phone,
              class_selected: classSelected,
              subject_selected: usesDepartment(classSelected) ? "" : subjectSelected,
              department: usesDepartment(classSelected) ? department : "",

              teacher_code: teacherCode.trim(),
            }
          : { full_name: fullName, phone };

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata, emailRedirectTo: window.location.origin },
      });
      if (error) {
        throw new Error(
          /database error/i.test(error.message)
            ? "This student ID is already registered for that class."
            : error.message,
        );
      }
      if (!data.session) {
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
        return;
      }

      if (portal === "teacher") {
        const { data: ok, error: rpcError } = await supabase.rpc("claim_teacher_role", {
          _code: accessCode.trim(),
        });
        if (rpcError) throw rpcError;
        if (!ok) {
          toast.error("That teacher access code is not valid.");
          await supabase.auth.signOut();
          return;
        }
      }
      await routeByRole(data.user!.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-aqua" />
      </div>
    );
  }

  const isTeacherSignup = portal === "teacher" && mode === "signup";

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="aura -left-20 -top-24 size-64 bg-aqua/30" />
      <div className="aura -right-20 top-28 size-72 bg-violet/35" />
      <div className="aura bottom-0 left-1/2 size-72 -translate-x-1/2 bg-sky/25" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl glass-soft font-display font-bold text-aqua">
            S
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-semibold">Tution Zone</p>
            <p className="text-[11px] text-muted-foreground">শিক্ষক ও শিক্ষার্থী পোর্টাল</p>
          </div>
        </div>

        <div className="glass p-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl glass-soft p-1">
            {(["student", "teacher"] as Portal[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPortal(p)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  portal === p
                    ? "bg-[image:var(--gradient-key)] font-semibold text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {p === "student" ? (
                  <GraduationCap className="size-4" />
                ) : (
                  <Presentation className="size-4" />
                )}
                {p === "student" ? "Student" : "Teacher"}
              </button>
            ))}
          </div>

          <h1 className="mt-5 font-display text-2xl font-bold leading-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {portal === "teacher"
              ? "Teacher accounts are issued by the school. Registration needs an access code."
              : "Register with your class details so your schedule appears automatically."}
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            {mode === "signup" ? (
              <Field label="Full name">
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  placeholder="Rafiul Ahmed"
                />
              </Field>
            ) : null}

            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@school.edu"
              />
            </Field>

            <Field label="Password">
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </Field>

            {mode === "signup" && portal === "student" ? (
              <>
                <Field label="Teacher code">
                  <input
                    required
                    value={teacherCode}
                    onChange={(e) => setTeacherCode(e.target.value.toUpperCase())}
                    className={inputClass}
                    placeholder="T-XXXXXX"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Student ID (auto)">
                    <input readOnly value={studentId} className={`${inputClass} opacity-70`} />
                  </Field>
                  <Field label="Phone">
                    <input
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputClass}
                      placeholder="01XXXXXXXXX"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Class">
                    <select
                      value={classSelected}
                      onChange={(e) => setClassSelected(e.target.value)}
                      className={inputClass}
                    >
                      {CLASS_LEVELS.map((c) => (
                        <option key={c} value={c} className="bg-popover">
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {usesDepartment(classSelected) ? (
                    <Field label="Department">
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
                    </Field>
                  ) : (
                    <Field label="Subject (optional)">
                      <input
                        value={subjectSelected}
                        onChange={(e) => setSubjectSelected(e.target.value)}
                        className={inputClass}
                        placeholder="Physics"
                      />
                    </Field>
                  )}
                </div>

              </>
            ) : null}

            {mode === "signup" && portal === "teacher" ? (
              <Field label="Teacher access code">
                <input
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className={inputClass}
                  placeholder="TEACH-XXXX"
                />
              </Field>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-key)] px-4 py-2.5 font-display text-sm font-semibold text-primary-foreground transition-transform active:scale-[.99] disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "signin"
                ? "Sign in"
                : isTeacherSignup
                  ? "Register teacher account"
                  : "Create student account"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-muted-foreground transition-colors hover:text-aqua"
          >
            {mode === "signin"
              ? portal === "student"
                ? "New student? Register here"
                : "Have an access code? Register a teacher account"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
