import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Youtube
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemDetail, ItemStatus, ItemSummary, SourceType } from "../shared/types.js";
import { createItem, deleteItem, getItem, listItems, reprocessItem, type ItemFilters } from "./api.js";

const statusOptions: Array<ItemStatus | "all"> = ["all", "queued", "processing", "complete", "failed"];
const sourceOptions: Array<SourceType | "all"> = ["all", "youtube", "podcast", "audio", "unknown"];

export default function App({ authEnabled = false }: { authEnabled?: boolean }) {
  const [filters, setFilters] = useState<ItemFilters>({ query: "", status: "all", source: "all" });
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [captureUrl, setCaptureUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sharedUrl = extractSharedUrl(new URL(window.location.href));
    if (sharedUrl) setCaptureUrl(sharedUrl);
  }, []);

  const refreshItems = useCallback(async () => {
    const nextItems = await listItems(filters);
    setItems(nextItems);
    if (!selectedId && nextItems[0]) setSelectedId(nextItems[0].id);
  }, [filters, selectedId]);

  const refreshDetail = useCallback(async () => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetail(await getItem(selectedId));
  }, [selectedId]);

  useEffect(() => {
    setLoading(true);
    refreshItems()
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [refreshItems]);

  useEffect(() => {
    refreshDetail().catch((err: unknown) => setError(errorMessage(err)));
  }, [refreshDetail]);

  const hasActiveJobs = useMemo(
    () => items.some((item) => item.status === "queued" || item.status === "processing") || detail?.status === "queued" || detail?.status === "processing",
    [detail?.status, items]
  );

  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = window.setInterval(() => {
      void refreshItems().catch((err: unknown) => setError(errorMessage(err)));
      void refreshDetail().catch((err: unknown) => setError(errorMessage(err)));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, refreshDetail, refreshItems]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captureUrl.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createItem(captureUrl);
      setCaptureUrl("");
      setSelectedId(result.item.id);
      await refreshItems();
      setDetail(await getItem(result.item.id));
      if (result.duplicate) setError("Already in the inbox.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onReprocess() {
    if (!detail) return;
    setError(null);
    const next = await reprocessItem(detail.id);
    setDetail(next);
    await refreshItems();
  }

  async function onDelete() {
    if (!detail) return;
    const deletedId = detail.id;
    await deleteItem(deletedId);
    setDetail(null);
    setSelectedId(items.find((item) => item.id !== deletedId)?.id ?? null);
    await refreshItems();
  }

  return (
    <main className="app-shell">
      <section className="sidebar">
        <form className="capture" onSubmit={onSubmit}>
          <Youtube aria-hidden="true" />
          <input
            value={captureUrl}
            onChange={(event) => setCaptureUrl(event.target.value)}
            placeholder="Paste a YouTube or podcast URL"
            aria-label="Capture URL"
          />
          <button className="icon-button primary" type="submit" disabled={submitting || !captureUrl.trim()} title="Capture">
            {submitting ? <Loader2 className="spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          </button>
        </form>

        <div className="filters">
          <label className="search-box">
            <Search aria-hidden="true" />
            <input
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="Search"
            />
          </label>

          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as ItemStatus | "all" }))}>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {titleCase(status)}
              </option>
            ))}
          </select>

          <select value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value as SourceType | "all" }))}>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {titleCase(source)}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="notice">
            <AlertCircle aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="item-list" aria-busy={loading}>
          {items.map((item) => (
            <button key={item.id} className={`item-row ${item.id === selectedId ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}>
              <StatusIcon status={item.status} />
              <span className="item-main">
                <span className="item-title">{item.title || item.canonicalUrl}</span>
                <span className="item-meta">
                  {titleCase(item.sourceType)}
                  {item.creator ? ` · ${item.creator}` : ""}
                </span>
              </span>
            </button>
          ))}
          {!loading && items.length === 0 && <div className="empty">No saved items yet.</div>}
        </div>
      </section>

      <section className="detail-pane">
        {detail ? (
          <DetailView
            detail={detail}
            authEnabled={authEnabled}
            onReprocess={() => void onReprocess().catch((err: unknown) => setError(errorMessage(err)))}
            onDelete={() => void onDelete().catch((err: unknown) => setError(errorMessage(err)))}
          />
        ) : (
          <div className="blank-state">
            <FileText aria-hidden="true" />
            <span>Select an item.</span>
          </div>
        )}
      </section>
    </main>
  );
}

function DetailView({
  detail,
  authEnabled,
  onReprocess,
  onDelete
}: {
  detail: ItemDetail;
  authEnabled: boolean;
  onReprocess: () => void;
  onDelete: () => void;
}) {
  const thumbnailSrc = detail.thumbnailPath ? `/api/items/${detail.id}/thumbnail` : detail.thumbnailUrl;
  return (
    <article className="detail">
      <header className="detail-header">
        <div>
          <div className="source-line">
            <StatusIcon status={detail.status} />
            <span>{titleCase(detail.status)}</span>
            <span>{titleCase(detail.sourceType)}</span>
          </div>
          <h1>{detail.title || detail.canonicalUrl}</h1>
          <p>{detail.creator || detail.canonicalUrl}</p>
        </div>

        <div className="actions">
          <a className="icon-button" href={`/api/items/${detail.id}/export.md`} title="Export Markdown">
            <Download aria-hidden="true" />
          </a>
          <a className="icon-button" href={`/api/items/${detail.id}/export.json`} title="Export JSON">
            <FileJson aria-hidden="true" />
          </a>
          <a className="icon-button" href={`/api/items/${detail.id}/export.zip`} title="Export ZIP">
            <Archive aria-hidden="true" />
          </a>
          <button className="icon-button" onClick={onReprocess} title="Reprocess">
            <RefreshCw aria-hidden="true" />
          </button>
          <button className="icon-button danger" onClick={onDelete} title="Delete">
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="source-card">
        {thumbnailSrc ? (
          <img src={thumbnailSrc} alt="" loading="lazy" />
        ) : (
          <div className="source-thumb-placeholder">
            <FileText aria-hidden="true" />
          </div>
        )}
        <div className="source-card-main">
          <div className="section-heading">Source</div>
          <h2>{detail.title || detail.canonicalUrl}</h2>
          <div className="source-facts">
            <span>{titleCase(detail.sourceType)}</span>
            {detail.creator && <span>{detail.creator}</span>}
            {detail.durationSeconds !== null && <span>{formatTimestamp(detail.durationSeconds)}</span>}
            <span>{titleCase(detail.status)}</span>
            {detail.summary?.model && <span>{detail.summary.model}</span>}
            {authEnabled && <span>Protected</span>}
          </div>
          <div className="source-links">
            <a href={detail.canonicalUrl} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              Open source
            </a>
            {detail.url !== detail.canonicalUrl && (
              <a href={detail.url} target="_blank" rel="noreferrer">
                Original link
              </a>
            )}
          </div>
        </div>
      </section>

      {detail.error && (
        <div className="notice error">
          <AlertCircle aria-hidden="true" />
          <span>{detail.error}</span>
        </div>
      )}

      {detail.summary ? (
        <section className="notes">
          <div className="section-heading">TL;DR</div>
          <p className="tldr">{detail.summary.notes.tldr}</p>

          <div className="section-heading">Key Ideas</div>
          <ul>
            {detail.summary.notes.keyIdeas.map((idea) => (
              <li key={idea}>{idea}</li>
            ))}
          </ul>

          {detail.summary.notes.timestampedOutline.length > 0 && (
            <>
              <div className="section-heading">Outline</div>
              <div className="timeline">
                {detail.summary.notes.timestampedOutline.map((item, index) => (
                  <div className="timeline-row" key={`${item.label}-${index}`}>
                    <span>{formatTimestamp(item.timestamp)}</span>
                    <strong>{item.label}</strong>
                    <p>{item.summary}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {detail.summary.notes.notableClaims.length > 0 && (
            <>
              <div className="section-heading">Claims</div>
              <ul>
                {detail.summary.notes.notableClaims.map((claim, index) => (
                  <li key={`${claim.claim}-${index}`}>
                    {formatTimestamp(claim.timestamp) ? `${formatTimestamp(claim.timestamp)} · ` : ""}
                    {claim.claim} <span className="muted">({claim.support})</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {detail.summary.notes.followUpQuestions.length > 0 && (
            <>
              <div className="section-heading">Questions</div>
              <ul>
                {detail.summary.notes.followUpQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </>
          )}

          {detail.summary.notes.tags.length > 0 && (
            <div className="tag-row">
              {detail.summary.notes.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="pending-panel">
          <Loader2 className={detail.status === "processing" || detail.status === "queued" ? "spin" : ""} aria-hidden="true" />
          <span>{detail.status === "failed" ? "Processing failed." : "Waiting for notes."}</span>
        </section>
      )}

      <section className="split-section">
        <div>
          <div className="section-heading">Transcript</div>
          <pre className="transcript">{detail.transcript?.text || "No transcript saved yet."}</pre>
        </div>
        <div>
          <div className="section-heading">Log</div>
          <div className="log-list">
            {detail.logs.map((log) => (
              <div className={`log-row ${log.level}`} key={log.id}>
                <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                <p>{log.message}</p>
              </div>
            ))}
            {detail.logs.length === 0 && <p className="muted">No log entries.</p>}
          </div>
        </div>
      </section>
    </article>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "complete") return <CheckCircle2 className="status complete" aria-hidden="true" />;
  if (status === "failed") return <AlertCircle className="status failed" aria-hidden="true" />;
  if (status === "processing") return <Loader2 className="status processing spin" aria-hidden="true" />;
  return <Clock3 className="status queued" aria-hidden="true" />;
}

function titleCase(value: string): string {
  return value.replace(/(^|[-_\s])([a-z])/g, (_, space: string, letter: string) => `${space ? " " : ""}${letter.toUpperCase()}`);
}

function formatTimestamp(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "";
  const rounded = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  return hours > 0 ? `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}` : `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function extractSharedUrl(url: URL): string | null {
  const direct = url.searchParams.get("url") ?? url.searchParams.get("link");
  if (direct) return direct;

  const sharedText = [url.searchParams.get("text"), url.searchParams.get("title")]
    .filter(Boolean)
    .join(" ");
  const match = sharedText.match(/https?:\/\/\S+/);
  return match?.[0] ?? null;
}
