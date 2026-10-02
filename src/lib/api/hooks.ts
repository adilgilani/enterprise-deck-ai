import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api, downloadFile } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import type {
  AISettings,
  Analytics,
  ApiKey,
  Asset,
  AuditEntry,
  Brand,
  BrandContext,
  DocumentDetail,
  DocumentItem,
  Folder,
  Invitation,
  Job,
  MeetingFull,
  MeetingSummary,
  Member,
  PresentationFull,
  PresentationSummary,
  ProposalFull,
  ProposalSummary,
  SessionInfo,
  Share,
  Template,
  TemplateDetail,
  TranscriptSegment,
  ActionItem,
} from "@/lib/api/types";

/** Authenticated query: disabled until the session is known. Keys are scoped by workspace. */
export function useApi<T>(key: QueryKey, path: string | null, query?: Record<string, string | number | boolean | null | undefined>, opts: { refetchInterval?: number | false } = {}) {
  const { status, me } = useAuth();
  return useQuery<T>({
    queryKey: [me?.organization.id, ...key, query ?? {}],
    queryFn: ({ signal }) => api<T>(path as string, { ...(query ? { query } : {}), signal }),
    enabled: status === "authenticated" && path !== null,
    refetchInterval: opts.refetchInterval ?? false,
  });
}

export const usePresentations = (q?: Record<string, string | number | boolean | null | undefined>) => useApi<PresentationSummary[]>(["presentations"], "/presentations", q);
export const usePresentation = (id: string | undefined) => useApi<PresentationFull>(["presentation", id], id ? `/presentations/${id}` : null);
export const useFolders = (kind = "presentations") => useApi<Folder[]>(["folders", kind], "/folders", { kind });
export const useProposals = (q?: Record<string, string | number | boolean | null | undefined>) => useApi<ProposalSummary[]>(["proposals"], "/proposals", q);
export const useProposal = (id: string | undefined) => useApi<ProposalFull>(["proposal", id], id ? `/proposals/${id}` : null);
export const useMeetings = () => useApi<MeetingSummary[]>(["meetings"], "/meetings");
export const useMeeting = (id: string | undefined, poll = false) => useApi<MeetingFull>(["meeting", id], id ? `/meetings/${id}` : null, undefined, { refetchInterval: poll ? 2000 : false });
export const useTranscript = (id: string | undefined) => useApi<TranscriptSegment[]>(["transcript", id], id ? `/meetings/${id}/transcript` : null);
export const useActionItems = (status?: string) => useApi<ActionItem[]>(["action-items"], "/action-items", status ? { status } : undefined);
export const useBrand = () => useApi<Brand>(["brand"], "/brand");
export const useBrands = () => useApi<Brand[]>(["brands"], "/brand/systems");
export const useBrandContext = () => useApi<BrandContext>(["brand-context"], "/brand/context/summary");
export const useTemplates = (q?: Record<string, string | number | boolean | null | undefined>) => useApi<Template[]>(["templates"], "/templates", q);
export const useTemplate = (id: string | null) => useApi<TemplateDetail>(["template", id], id ? `/templates/${id}` : null);
export const useAssets = (q?: Record<string, string | number | boolean | null | undefined>) => useApi<Asset[]>(["assets"], "/assets", q);
export const useDocuments = (q?: Record<string, string | number | boolean | null | undefined>, poll = false) => useApi<DocumentItem[]>(["documents"], "/documents", q, { refetchInterval: poll ? 1500 : false });
export const useDocument = (id: string | null) => useApi<DocumentDetail>(["document", id], id ? `/documents/${id}` : null);
export const useMembers = () => useApi<Member[]>(["members"], "/team/members");
export const useInvitations = (enabled = true) => useApi<Invitation[]>(["invitations"], enabled ? "/team/invitations" : null);
export const useActivity = () => useApi<AuditEntry[]>(["activity"], "/team/activity", { limit: 30 });
export const useAuditLogs = (enabled = true) => useApi<AuditEntry[]>(["audit"], enabled ? "/audit-logs" : null, { limit: 200 });
export const useAnalytics = (days = 90) => useApi<Analytics>(["analytics"], "/analytics", { days });
export const useAISettings = () => useApi<AISettings>(["ai-settings"], "/settings/ai");
export const useApiKeys = (enabled = true) => useApi<ApiKey[]>(["api-keys"], enabled ? "/settings/api-keys" : null);
export const useSessions = () => useApi<SessionInfo[]>(["sessions"], "/auth/sessions");
export const useShares = (kind: "presentations" | "proposals" | "meetings", id: string | undefined) => useApi<Share[]>(["shares", kind, id], id ? `/${kind}/${id}/shares` : null);

/** Invalidate every cached query whose key (after the org id) starts with one of `names`. */
export function useInvalidate() {
  const qc = useQueryClient();
  return (...names: string[]) =>
    qc.invalidateQueries({ predicate: (q) => names.includes(String((q.queryKey as unknown[])[1])) });
}

export function useApiMutation<TBody, TOut>(fn: (body: TBody) => Promise<TOut>, invalidate: string[] = []) {
  const inv = useInvalidate();
  return useMutation<TOut, Error, TBody>({
    mutationFn: fn,
    onSuccess: () => {
      if (invalidate.length) void inv(...invalidate);
    },
  });
}

/** Poll a background job until it completes or fails. */
export function useJob(jobId: string | null | undefined, intervalMs = 700) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const j = await api<Job>(`/jobs/${jobId}`);
        if (cancelled) return;
        setJob(j);
        if (j.status === "completed" || j.status === "failed") return;
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
      timer.current = setTimeout(tick, intervalMs);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [jobId, intervalMs]);
  return { job, error };
}

/** Await a job imperatively (exports). */
export async function waitForJob(jobId: string, onProgress?: (j: Job) => void, timeoutMs = 180_000): Promise<Job> {
  const started = Date.now();
  for (;;) {
    const j = await api<Job>(`/jobs/${jobId}`);
    onProgress?.(j);
    if (j.status === "completed") return j;
    if (j.status === "failed") throw new Error(j.error ?? "Job failed");
    if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for the job");
    await new Promise((r) => setTimeout(r, 600));
  }
}

export async function runExport(path: string, body: unknown, fallbackName: string, onProgress?: (j: Job) => void) {
  const job = await api<Job>(path, { method: "POST", body: body ?? {} });
  const done = await waitForJob(job.id, onProgress);
  await downloadFile(`/jobs/${done.id}/download`, String(done.result["filename"] ?? fallbackName));
}
