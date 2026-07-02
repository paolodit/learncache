import { useEffect, useState } from "react";
import "./style.css";

const appUrl = process.env.PLASMO_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const extensionApiToken = process.env.PLASMO_PUBLIC_EXTENSION_API_TOKEN ?? "";

interface BrowserTranscriptCapture {
  url: string;
  title?: string;
  creator?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  language?: string;
  transcript: {
    text: string;
    segments: Array<{ start: number; end: number; text: string }>;
  };
}

function Popup() {
  if (!extensionApiToken) {
    return (
      <div className="popup">
        <h1>LearnCache</h1>
        <p>Missing PLASMO_PUBLIC_EXTENSION_API_TOKEN.</p>
      </div>
    );
  }

  return <CapturePopup />;
}

function CapturePopup() {
  const [tabUrl, setTabUrl] = useState("");
  const [tabId, setTabId] = useState<number | null>(null);
  const [status, setStatus] = useState("Ready");

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.url) setTabUrl(tab.url);
      if (tab?.id) setTabId(tab.id);
    });
  }, []);

  async function saveCurrentTab() {
    if (!tabUrl) return;
    setStatus("Saving...");
    const capture = await tryCaptureYouTubeTranscript(tabUrl, tabId);
    const response = capture
      ? await postJson(`${appUrl.replace(/\/$/, "")}/api/items/import-transcript`, capture)
      : await postJson(`${appUrl.replace(/\/$/, "")}/api/items`, { url: tabUrl });

    if (!response.ok) {
      setStatus(await response.text());
      return;
    }
    const body = (await response.json()) as { duplicate?: boolean; importedTranscript?: boolean };
    if (capture && body.importedTranscript) {
      setStatus(body.duplicate ? "Transcript refreshed" : "Transcript captured");
      return;
    }
    setStatus(body.duplicate ? "Already saved" : "Saved");
  }

  return (
    <div className="popup">
      <div className="top-row">
        <h1>LearnCache</h1>
      </div>
      <p className="url">{tabUrl || "No active tab URL"}</p>
      <button disabled={!tabUrl} onClick={() => void saveCurrentTab()}>
        Send to inbox
      </button>
      <a href={`${appUrl.replace(/\/$/, "")}/capture?url=${encodeURIComponent(tabUrl)}`} target="_blank" rel="noreferrer">
        Open capture page
      </a>
      <p className="status">{status}</p>
    </div>
  );
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${extensionApiToken}`
      },
      body: JSON.stringify(body)
    });
}

async function tryCaptureYouTubeTranscript(url: string, activeTabId: number | null): Promise<BrowserTranscriptCapture | null> {
  if (!activeTabId || !/^https:\/\/(www\.)?youtube\.com\/watch\?/i.test(url)) return null;

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      func: captureYouTubeTranscriptFromPage
    });
    return (result?.result as BrowserTranscriptCapture | null | undefined) ?? null;
  } catch {
    return null;
  }
}

async function captureYouTubeTranscriptFromPage(): Promise<BrowserTranscriptCapture | null> {
  const player = findPlayerResponse();
  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  const selected =
    tracks.find((track) => track.kind !== "asr" && String(track.languageCode ?? "").startsWith("en")) ??
    tracks.find((track) => String(track.languageCode ?? "").startsWith("en")) ??
    tracks.find((track) => track.kind !== "asr") ??
    tracks[0];
  if (!selected?.baseUrl) return null;

  const response = await fetch(captionFetchUrl(String(selected.baseUrl)), { credentials: "include" });
  if (!response.ok) return null;

  const body = await response.text();
  const segments = parseCaptionBody(body);
  const text = segments.map((segment) => segment.text.trim()).filter(Boolean).join("\n");
  if (!text) return null;

  const details = player?.videoDetails ?? {};
  const videoId = typeof details.videoId === "string" ? details.videoId : new URL(location.href).searchParams.get("v") ?? "";
  const thumbnail = Array.isArray(details.thumbnail?.thumbnails) ? details.thumbnail.thumbnails.at(-1)?.url : undefined;

  return {
    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : location.href,
    title: typeof details.title === "string" ? details.title : document.title.replace(/\s*-\s*YouTube\s*$/i, ""),
    creator: typeof details.author === "string" ? details.author : undefined,
    durationSeconds: Number.isFinite(Number(details.lengthSeconds)) ? Number(details.lengthSeconds) : undefined,
    thumbnailUrl: typeof thumbnail === "string" ? thumbnail : undefined,
    language: typeof selected.languageCode === "string" ? selected.languageCode : undefined,
    transcript: { text, segments }
  };

  function findPlayerResponse(): any {
    const direct = (window as any).ytInitialPlayerResponse;
    if (direct) return direct;

    for (const script of Array.from(document.scripts)) {
      const json = extractAssignedJson(script.textContent ?? "", "ytInitialPlayerResponse");
      if (json) {
        try {
          return JSON.parse(json);
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  function extractAssignedJson(source: string, name: string): string | null {
    const marker = source.indexOf(name);
    if (marker === -1) return null;
    const start = source.indexOf("{", marker);
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
      }
    }
    return null;
  }

  function captionFetchUrl(baseUrl: string): string {
    const url = new URL(baseUrl);
    url.searchParams.set("fmt", "vtt");
    return url.toString();
  }

  function parseCaptionBody(input: string): Array<{ start: number; end: number; text: string }> {
    const trimmed = input.trim();
    if (trimmed.startsWith("WEBVTT")) return parseVtt(trimmed);
    return parseXmlCaptions(trimmed);
  }

  function parseVtt(input: string): Array<{ start: number; end: number; text: string }> {
    return input
      .replace(/^WEBVTT[^\n]*\n+/i, "")
      .split(/\n{2,}/)
      .flatMap((block) => {
        const lines = block.trim().split("\n").map((line) => line.trim());
        const timingIndex = lines.findIndex((line) => line.includes("-->"));
        if (timingIndex === -1) return [];
        const timing = lines[timingIndex].split("-->").map((part) => part.trim().split(/\s+/)[0]);
        const start = parseTimestamp(timing[0]);
        const end = parseTimestamp(timing[1]);
        const text = cleanCaptionText(lines.slice(timingIndex + 1).join(" "));
        return start === null || end === null || !text ? [] : [{ start, end, text }];
      });
  }

  function parseXmlCaptions(input: string): Array<{ start: number; end: number; text: string }> {
    const doc = new DOMParser().parseFromString(input, "text/xml");
    return Array.from(doc.querySelectorAll("text")).flatMap((node) => {
      const start = Number(node.getAttribute("start"));
      const duration = Number(node.getAttribute("dur") ?? "0");
      const text = cleanCaptionText(node.textContent ?? "");
      return Number.isFinite(start) && text ? [{ start, end: start + (Number.isFinite(duration) ? duration : 0), text }] : [];
    });
  }

  function parseTimestamp(value: string): number | null {
    const parts = value.replace(",", ".").split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }

  function cleanCaptionText(input: string): string {
    const text = document.createElement("textarea");
    text.innerHTML = input.replace(/<[^>]+>/g, "").replace(/\{\\an\d+\}/g, "");
    return text.value.replace(/\s+/g, " ").trim();
  }
}

export default Popup;
