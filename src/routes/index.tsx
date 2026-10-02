import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileSignature, Mic, Plus, Presentation, Upload, Palette, Check, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/app-shell";
import { DeckCard } from "@/components/deck-card";
import { useBrandContext, usePresentations } from "@/lib/api/hooks";
import { firstName, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Home — VYRA" }] }),
  component: Home,
});

const quick = [
  { title: "Create Presentation", body: "Turn an idea into a complete deck.", icon: Presentation, to: "/presentations/new" },
  { title: "Create Proposal", body: "Generate a professional proposal using your company's branding.", icon: FileSignature, to: "/proposals/new" },
  { title: "Start Meeting", body: "Capture your meeting and turn it into structured notes or a presentation.", icon: Mic, to: "/meetings/new" },
  { title: "Use Company Brand", body: "Your brand system is already connected.", icon: Palette, to: "/brand" },
] as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Home() {
  const { me } = useAuth();
  const { data: decks, isLoading } = usePresentations({ limit: 6 });
  const { data: ctx } = useBrandContext();
  return (
    <div>
      <section className="border-b bg-gradient-hero">
        <Page className="pb-12 pt-14">
          <div className="eyebrow">{greeting()}, {firstName(me?.user.name)} · {me?.organization.name}</div>
          <h1 className="mt-4 max-w-3xl font-serif text-[56px] leading-[1.02] tracking-tight">Create presentations that look like your company.</h1>
          <p className="mt-4 max-w-xl text-[16px] text-muted-foreground">Turn prompts, company knowledge, meetings, and data into beautiful, on-brand business experiences.</p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Button asChild size="lg"><Link to="/presentations/new"><Plus />Create presentation</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/meetings/new"><Mic />Start a meeting</Link></Button>
            <div className="mx-2 h-5 w-px bg-border" />
            <Button asChild variant="ghost" size="sm"><Link to="/proposals/new"><FileSignature />Create proposal</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/ai-library"><Library />Add company knowledge</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/assets"><Upload />Upload asset</Link></Button>
          </div>
        </Page>
      </section>

      <Page className="space-y-14">
        <section className="grid gap-4 md:grid-cols-4">
          {quick.map((q, i) => (
            <Link key={q.title} to={q.to} className="group surface surface-hover flex flex-col p-5">
              <div className="flex items-center justify-between">
                <div className={i === 3 ? "grid size-9 place-items-center rounded-md bg-gradient-brand text-brand-foreground" : "grid size-9 place-items-center rounded-md border bg-muted/50"}>
                  <q.icon className="size-4" />
                </div>
                <ArrowRight className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </div>
              <div className="mt-8 text-[15px] font-medium">{q.title}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{q.body}</p>
              {i === 3 && ctx && (
                <div className="mt-4 flex items-center gap-2 text-[12px] text-success">
                  <Check className="size-3.5" />{ctx.company_name} · {ctx.colors.length} colors · {Object.keys(ctx.fonts).length || 3} fonts
                </div>
              )}
            </Link>
          ))}
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight">Recent work</h2>
              <p className="text-[13px] text-muted-foreground">Everything here uses the {ctx?.company_name ?? "company"} brand system.</p>
            </div>
            <Link to="/presentations" className="text-[13px] text-muted-foreground hover:text-foreground">View all →</Link>
          </div>
          <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-video animate-pulse rounded-lg bg-muted" />)}
            {decks?.slice(0, 6).map((d) => <DeckCard key={d.id} deck={d} />)}
          </div>
        </section>

        <section className="surface grid overflow-hidden md:grid-cols-[1.1fr_1fr]">
          <div className="p-8">
            <div className="eyebrow">How it works</div>
            <h3 className="mt-3 font-serif text-[32px] leading-tight">Define your brand once. AI applies it everywhere.</h3>
            <p className="mt-3 text-[14px] text-muted-foreground">Company profile, guidelines, templates and knowledge flow into every presentation, proposal and meeting output — automatically.</p>
          </div>
          <div className="border-t bg-muted/30 p-8 md:border-l md:border-t-0">
            <div className="space-y-2 font-mono text-[12px]">
              {["Company profile", "Brand guidelines", "Templates", "Visual identity", "Company knowledge"].map((s, i) => (
                <div key={s} className="flex items-center gap-3"><span className="text-muted-foreground">0{i + 1}</span><span className="h-px flex-1 bg-border" />{s}</div>
              ))}
              <div className="my-3 rounded-md bg-ink px-3 py-2.5 text-center text-ink-foreground">AI PRESENTATION INFRASTRUCTURE</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {["Presentations", "Proposals", "Meetings"].map((s) => <div key={s} className="rounded-md border bg-card py-2">{s}</div>)}
              </div>
              <div className="pt-2 text-center text-muted-foreground">↓ PPTX · PDF · Web · Share</div>
            </div>
          </div>
        </section>
      </Page>
    </div>
  );
}
