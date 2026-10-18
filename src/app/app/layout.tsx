"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  Building2,
  CheckCircle,
  ChevronRight,
  ClipboardList,
  FileText,
  HeadphonesIcon,
  LayoutDashboard,
  Lock,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  Package,
  PieChart,
  PiggyBank,
  Plug,
  Rss,
  Scale,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { AIChatWidget } from "@/components/AIChatWidget";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  adminPortalNavGroups,
  clientPortalNavGroups,
  type PlatformNavGroup,
  type PlatformNavIcon,
} from "@/lib/platformNavigation";

const ADMIN_ROLES = new Set(["admin", "super_admin", "internal"]);

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  internal: "Internal Operations",
  analyst: "Review Team",
  client: "Client Workspace",
};

function navigationForRole(role: string | null): PlatformNavGroup[] {
  const allClientItems = clientPortalNavGroups.flatMap((group) => group.items);
  const allAdminItems = adminPortalNavGroups.flatMap((group) => group.items);
  const item = (href: string) => [...allAdminItems, ...allClientItems].find((candidate) => candidate.href === href);
  const items = (hrefs: string[]) => hrefs.map(item).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  if (ADMIN_ROLES.has(role ?? "")) {
    return [
      {
        label: role === "super_admin" ? "Platform governance" : "Administration",
        items: items([
          "/app/admin",
          ...(role === "super_admin" ? ["/app/admin/workspace-access"] : []),
          "/app/admin/organization-reports",
          "/app/admin/users",
        ]),
      },
      {
        label: "Operations",
        items: items([
          "/app/command-center",
          "/app/command-center/monitoring",
          "/app/ai-services",
          "/app/command-center/agents",
          "/app/command-center/integrations",
        ]),
      },
      {
        label: "Decisions & evidence",
        items: items(["/app/admin/intake", "/app/admin/kyc", "/app/admin/approvals", "/app/admin/audit"]),
      },
      { label: "Account", items: items(["/app/support", "/app/notifications", "/app/profile", "/app/settings"]) },
    ];
  }

  if (role === "analyst") {
    return [
      {
        label: "Review work",
        items: [
          { href: "/review/verification", icon: "ShieldCheck", label: "Verification Queue", description: "Open the assigned review queue." },
          { href: "/app/notifications", icon: "Bell", label: "Notifications", description: "Review assignment and decision updates." },
        ],
      },
      { label: "Account", items: items(["/app/support", "/app/profile", "/app/security"]) },
    ];
  }

  return [
    { label: "Workspace", items: items(["/app/workspace", "/app/dashboard", "/app/ai-services", "/app/integrations", "/app/services", "/app/social-media"]) },
    { label: "Project operations", items: items(["/app/requests", "/app/documents", "/app/meetings", "/app/messages"]) },
    { label: "Account", items: items(["/app/notifications", "/app/support", "/app/profile", "/app/security", "/app/settings"]) },
  ];
}

function initials(email: string | null) {
  if (!email) return "GE";
  const local = email.split("@")[0] ?? "GE";
  return local.split(/[._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "GE";
}

function logoutPathForRole(role: string | null) {
  if (role === "super_admin") return "/super-admin-login?signedOut=1";
  if (role === "admin" || role === "internal") return "/admin-login?signedOut=1";
  if (role === "analyst") return "/team-login?signedOut=1";
  return "/client-login?signedOut=1";
}

const iconMap: Record<PlatformNavIcon, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Package,
  Briefcase,
  FileText,
  ClipboardList,
  HeadphonesIcon,
  MessageSquare,
  Bell,
  ShieldCheck,
  User,
  Settings,
  Lock,
  Shield,
  Users,
  CheckCircle,
  PieChart,
  UserCheck,
  Wallet,
  PiggyBank,
  Mail,
  Rss,
  Activity,
  BarChart3,
  ShieldAlert,
  Scale,
  BadgeDollarSign,
  Bot,
  Plug,
  Megaphone,
  Building2,
};

function isActivePath(pathname: string, href: string) {
  if (href === "/app/dashboard" || href === "/app/admin" || href === "/intel") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  pathname,
  viewerRole,
}: {
  pathname: string;
  viewerRole: string | null;
}) {
  const visibleGroups = navigationForRole(viewerRole);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-4 py-5">
        <Link href="/app/dashboard" className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "hsl(185 100% 45%)" }}
          >
            <span className="text-sm font-bold text-black">G</span>
          </div>
          <span className="truncate text-sm font-semibold text-white">GEM Enterprise</span>
        </Link>
        <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-400">Operations Online</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Client, intelligence, social media, compliance, and service workflows aligned.
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {visibleGroups.map(({ label, items }) => (
          <div key={label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(({ href, icon, label: itemLabel, description }) => {
                const Icon = iconMap[icon];
                const active = isActivePath(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={description}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      active ? "nav-active" : "text-slate-400 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active
                          ? "text-[hsl(var(--svc-cyber))]"
                          : "text-slate-500 group-hover:text-[hsl(var(--svc-cyber))]",
                      )}
                    />
                    <span className="truncate">{itemLabel}</span>
                    {active ? (
                      <span className="ml-auto h-1 w-1 rounded-full bg-[hsl(var(--svc-cyber))]" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Current access</p>
        <p className="mt-1 text-sm font-semibold text-white">{roleLabels[viewerRole ?? ""] ?? "Checking access…"}</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">Server-authoritative role and membership scope.</p>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const segment = pathname.split("/").filter(Boolean).pop() ?? "dashboard";
  const pageTitle = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
  const canAccessAdmin = ADMIN_ROLES.has(viewerRole ?? "");
  const isAdminSurface =
    pathname.startsWith("/app/admin") || pathname.startsWith("/app/command-center");
  const hideFloatingSupport =
    pathname.startsWith("/app/admin/workspace-access") ||
    pathname.startsWith("/app/admin/users") ||
    pathname.startsWith("/app/admin/allocations");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((session) => {
        if (active) {
          setViewerRole(session?.role ?? null);
          setViewerEmail(session?.email ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setViewerRole(null);
          setViewerEmail(null);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const sidebar = (
    <SidebarContent
      pathname={pathname}
      viewerRole={viewerRole}
    />
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="glass-panel sticky top-0 hidden h-screen w-56 shrink-0 overflow-hidden border-r border-white/10 lg:flex xl:w-64">
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-panel sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 border-white/10 bg-background p-0">
                {sidebar}
              </SheetContent>
            </Sheet>

            <nav className="hidden items-center gap-1.5 text-sm text-slate-400 sm:flex">
              <span className="text-slate-500">GEM Enterprise</span>
              <ChevronRight className="h-3 w-3" />
              <span className="font-medium text-white">{pageTitle}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {isAdminSurface && canAccessAdmin ? (
              <Badge className="hidden border-cyan-500/25 bg-cyan-500/10 text-xs text-cyan-400 md:inline-flex">
                {viewerRole === "super_admin" ? "Super Admin" : "Admin Ops"}
              </Badge>
            ) : null}
            {hideFloatingSupport ? (
              <Link href="/app/support" className="hidden sm:block">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-cyan-200" aria-label="Open support center">
                  <Bot className="h-5 w-5" />
                </Button>
              </Link>
            ) : null}
            <Link href="/app/notifications">
              <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-white">
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[hsl(var(--svc-cyber))] animate-pulse-slow" />
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 text-slate-300 hover:text-white">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-[hsl(var(--svc-cyber-muted))] text-xs font-semibold text-[hsl(var(--svc-cyber))]">
                      {initials(viewerEmail)}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronRight className="h-3 w-3 rotate-90 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 border-white/10 bg-background">
                <div className="border-b border-white/10 px-2 py-2">
                  <p className="truncate text-xs font-medium text-white">{viewerEmail ?? "Authenticated account"}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[.14em] text-cyan-300">{roleLabels[viewerRole ?? ""] ?? "Access pending"}</p>
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/app/profile" className="flex cursor-pointer items-center gap-2">
                    <User className="h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/settings" className="flex cursor-pointer items-center gap-2">
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                {canAccessAdmin ? (
                  <DropdownMenuItem asChild>
                    <Link href="/app/admin" className="flex cursor-pointer items-center gap-2">
                      <Shield className="h-4 w-4" /> Admin Center
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator className="bg-white/10" />
                 <div className="p-1">
                   <LogoutButton redirectPath={logoutPathForRole(viewerRole)} />
                 </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>

      {!hideFloatingSupport ? <AIChatWidget profileId="PRF-005" profileName="Platform Support" /> : null}
    </div>
  );
}
