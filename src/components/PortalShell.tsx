import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ClipboardCheck,
  BookOpen,
  Home,
  History,
  LogOut,
  Bell,
  Megaphone,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveNotifications } from "@/hooks/useLiveNotifications";
import { initials } from "@/lib/portal";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Home };

const TEACHER_NAV: NavItem[] = [
  { to: "/teacher-dashboard", label: "Schedule", icon: CalendarDays },
  { to: "/teacher-attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/teacher-notices", label: "Notices", icon: Megaphone },
  { to: "/teacher-subjects", label: "Subjects", icon: BookOpen },
];

const STUDENT_NAV: NavItem[] = [
  { to: "/student-dashboard", label: "Home", icon: Home },
  { to: "/student-notices", label: "Notices", icon: Megaphone },
  { to: "/student-attendance", label: "History", icon: History },
];

export function PortalShell({
  role,
  name,
  subtitle,
  children,
}: {
  role: "teacher" | "student";
  name: string;
  subtitle?: string | undefined;
  children: ReactNode;
}) {
  const nav = role === "teacher" ? TEACHER_NAV : STUDENT_NAV;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useLiveNotifications(role === "student");

  const { data: unread = 0 } = useQuery({
    queryKey: ["unread-notifications"],
    enabled: role === "student",
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="aura -left-24 -top-28 size-72 bg-aqua/25" />
      <div className="aura -right-24 top-40 size-80 bg-violet/30" />
      <div className="aura bottom-0 left-1/3 size-72 bg-sky/20" />

      <div className="relative mx-auto flex w-full max-w-6xl gap-6 px-4 pb-28 pt-4 md:pb-8">
        {/* Sidebar */}
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-56 shrink-0 flex-col glass p-4 md:flex">
          <Brand role={role} />
          <nav className="mt-6 flex flex-1 flex-col gap-1">
            {nav.map((item) => (
              <SideLink key={item.to} item={item} active={pathname === item.to} />
            ))}
          </nav>
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1">
          <header className="mb-4 flex items-center justify-between">
            <div className="md:hidden">
              <Brand role={role} />
            </div>
            <div className="hidden md:block">
              <p className="eyebrow text-aqua">{role === "teacher" ? "Teacher portal" : "Student portal"}</p>
              <p className="font-display text-lg font-semibold">{name}</p>
              {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              {role === "student" ? (
                <Link
                  to="/student-dashboard"
                  className="relative grid size-9 place-items-center rounded-full glass-soft"
                  aria-label="Notifications"
                >
                  <Bell className="size-4" />
                  {unread > 0 ? (
                    <span className="absolute right-1 top-1 size-2 rounded-full bg-aqua ring-2 ring-deep" />
                  ) : null}
                </Link>
              ) : null}
              <div className="grid size-9 place-items-center rounded-full bg-[image:var(--gradient-key)] font-display text-xs font-bold text-primary-foreground">
                {initials(name)}
              </div>
              <button
                onClick={signOut}
                className="grid size-9 place-items-center rounded-full glass-soft text-muted-foreground transition-colors hover:text-foreground md:hidden"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </header>
          {children}
        </main>
      </div>

      {/* Mobile nav */}
      <nav className="fixed inset-x-3 bottom-3 z-20 flex items-center justify-around glass px-2 py-1.5 md:hidden">
        {nav.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-colors",
                active ? "bg-accent text-aqua" : "text-muted-foreground",
              )}
            >
              <Icon className="size-[18px]" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Brand({ role }: { role: "teacher" | "student" }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid size-9 place-items-center rounded-xl glass-soft font-display font-bold text-aqua">
        S
      </div>
      <div className="leading-tight">
        <p className="font-display text-sm font-semibold tracking-tight">Tution Zone</p>
        <p className="text-[10px] text-muted-foreground">
          {role === "teacher" ? "Teacher Portal" : "Student Portal"}
        </p>
      </div>
    </div>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
        active ? "bg-accent font-semibold text-aqua" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {item.label}
    </Link>
  );
}
