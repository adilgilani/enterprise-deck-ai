import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Home, Presentation, FileSignature, Mic, LayoutTemplate, Palette, Images, Library, Users,
  BarChart3, Settings, Search, Bell, HelpCircle, ChevronsUpDown, PanelLeftClose, PanelLeft, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CommandPalette } from "@/components/command-palette";

const nav = [
  { title: "Home", to: "/", icon: Home },
  { title: "Presentations", to: "/presentations", icon: Presentation },
  { title: "Proposals", to: "/proposals", icon: FileSignature },
  { title: "Meetings", to: "/meetings", icon: Mic },
  { title: "Templates", to: "/templates", icon: LayoutTemplate },
  { title: "Brand Studio", to: "/brand", icon: Palette },
  { title: "Assets", to: "/assets", icon: Images },
  { title: "AI Library", to: "/library", icon: Library },
  { title: "Team", to: "/team", icon: Users },
  { title: "Analytics", to: "/analytics", icon: BarChart3 },
  { title: "Settings", to: "/settings", icon: Settings },
] as const;

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid size-7 shrink-0 place-items-center rounded-md bg-ink">
        <div className="absolute inset-[5px] rounded-[3px] border border-ink-foreground/40" />
        <div className="size-1.5 rounded-full bg-brand" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight">Enterprise AI</div>
          <div className="text-[11px] text-muted-foreground">Presentation Infrastructure</div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [cmd, setCmd] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));
  const focus = path.startsWith("/meetings/live") || path.startsWith("/editor");

  if (focus) return <TooltipProvider delayDuration={200}>{children}</TooltipProvider>;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen w-full">
        <aside
          className={cn(
            "sticky top-0 flex h-screen shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200",
            collapsed ? "w-[60px]" : "w-[244px]",
          )}
        >
          <div className="flex h-14 items-center justify-between px-3.5">
            <Link to="/"><Logo compact={collapsed} /></Link>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
            {nav.map((item) => {
              const active = isActive(item.to);
              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors",
                    active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                  )}
                >
                  <span className={cn("absolute -left-2.5 top-1.5 h-5 w-[2px] rounded-r bg-brand transition-all duration-300", active ? "opacity-100" : "opacity-0 scale-y-0")} />
                  <item.icon className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              ) : link;
            })}
          </nav>
          <div className="space-y-2 border-t p-2.5">
            {!collapsed && (
              <div className="rounded-md border bg-card p-2.5">
                <div className="flex items-center gap-1.5 text-[12px] font-medium"><Sparkles className="size-3.5 text-brand" />Enterprise plan</div>
                <div className="mt-1 text-[11px] text-muted-foreground">142 seats · Private AI enabled</div>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-sidebar-accent">
                <div className="grid size-7 shrink-0 place-items-center rounded-md bg-gradient-brand text-[11px] font-semibold text-brand-foreground">AC</div>
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-[12.5px] font-medium">Acme Corporation</div>
                      <div className="truncate text-[11px] text-muted-foreground">adil@acme.com</div>
                    </div>
                    <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                  </>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
                <DropdownMenuItem>Acme Corporation</DropdownMenuItem>
                <DropdownMenuItem>Acme EMEA</DropdownMenuItem>
                <DropdownMenuItem>Acme Ventures</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/settings">Workspace settings</Link></DropdownMenuItem>
                <DropdownMenuItem>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-sidebar-accent"
              aria-label="Toggle sidebar"
            >
              {collapsed ? <PanelLeft className="size-4" /> : <><PanelLeftClose className="size-4" />Collapse</>}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-6 backdrop-blur">
            <button
              onClick={() => setCmd(true)}
              className="flex h-8 w-full max-w-md items-center gap-2 rounded-md border bg-card px-2.5 text-[13px] text-muted-foreground shadow-card hover:border-input"
            >
              <Search className="size-3.5" />
              Search presentations, proposals, meetings…
              <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <Popover>
                <PopoverTrigger className="relative grid size-8 place-items-center rounded-md hover:bg-accent" aria-label="Notifications">
                  <Bell className="size-4" />
                  <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="border-b px-4 py-2.5 text-sm font-medium">Notifications</div>
                  {[
                    ["Sara approved", "Q3 Board Review is ready to present", "2h"],
                    ["Meeting processed", "Q4 Strategy Meeting notes are ready", "4h"],
                    ["Proposal viewed", "ABC Bank opened your proposal 3 times", "1d"],
                  ].map(([a, b, c]) => (
                    <div key={a} className="flex gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/50">
                      <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                      <div className="flex-1 text-[13px]"><div className="font-medium">{a}</div><div className="text-muted-foreground">{b}</div></div>
                      <span className="text-[11px] text-muted-foreground">{c}</span>
                    </div>
                  ))}
                </PopoverContent>
              </Popover>
              <Tooltip>
                <TooltipTrigger className="grid size-8 place-items-center rounded-md hover:bg-accent" aria-label="Help"><HelpCircle className="size-4" /></TooltipTrigger>
                <TooltipContent>Help & documentation</TooltipContent>
              </Tooltip>
              <div className="ml-2 grid size-8 place-items-center rounded-full bg-ink text-[11px] font-semibold text-ink-foreground">AG</div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
      <CommandPalette open={cmd} onOpenChange={setCmd} />
    </TooltipProvider>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-8">
      <div className="max-w-2xl">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[14.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1280px] animate-rise px-8 py-10", className)}>{children}</div>;
}
