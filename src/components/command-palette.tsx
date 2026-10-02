import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { decks, proposals } from "@/lib/mock-data";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onOpenChange(!open); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onOpenChange]);
  const go = (fn: () => void) => { onOpenChange(false); fn(); };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go(() => navigate({ to: "/presentations/new" }))}>Create presentation</CommandItem>
          <CommandItem onSelect={() => go(() => navigate({ to: "/proposals/new" }))}>Create proposal</CommandItem>
          <CommandItem onSelect={() => go(() => navigate({ to: "/meetings" }))}>Start meeting</CommandItem>
          <CommandItem onSelect={() => go(() => navigate({ to: "/brand" }))}>Open Brand Studio</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Presentations">
          {decks.map((d) => (
            <CommandItem key={d.id} onSelect={() => go(() => navigate({ to: "/presentations/$id", params: { id: d.id } }))}>{d.title}</CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Proposals">
          {proposals.map((p) => (
            <CommandItem key={p.id} onSelect={() => go(() => navigate({ to: "/proposals" }))}>{p.title} — {p.client}</CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
