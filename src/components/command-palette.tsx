import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useMeetings, usePresentations, useProposals } from "@/lib/api/hooks";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { data: decks } = usePresentations();
  const { data: proposals } = useProposals();
  const { data: meetings } = useMeetings();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onOpenChange]);
  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go(() => void navigate({ to: "/presentations/new" }))}>Create presentation</CommandItem>
          <CommandItem onSelect={() => go(() => void navigate({ to: "/proposals/new" }))}>Create proposal</CommandItem>
          <CommandItem onSelect={() => go(() => void navigate({ to: "/meetings/new" }))}>Start meeting</CommandItem>
          <CommandItem onSelect={() => go(() => void navigate({ to: "/brand" }))}>Open Brand Studio</CommandItem>
          <CommandItem onSelect={() => go(() => void navigate({ to: "/ai-library" }))}>Upload company knowledge</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Presentations">
          {(decks ?? []).slice(0, 40).map((d) => (
            <CommandItem key={d.id} value={`deck ${d.title}`} onSelect={() => go(() => void navigate({ to: "/editor/$id", params: { id: d.id } }))}>{d.title}</CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Proposals">
          {(proposals ?? []).slice(0, 30).map((p) => (
            <CommandItem key={p.id} value={`proposal ${p.title} ${p.client}`} onSelect={() => go(() => void navigate({ to: "/proposals/$id", params: { id: p.id } }))}>{p.title} — {p.client}</CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Meetings">
          {(meetings ?? []).slice(0, 30).map((m) => (
            <CommandItem key={m.id} value={`meeting ${m.title}`} onSelect={() => go(() => void navigate({ to: "/meetings/$id", params: { id: m.id } }))}>{m.title}</CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
