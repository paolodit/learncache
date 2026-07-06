import { CheckCircle2, Clipboard, ExternalLink, Settings, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SetupStatus } from "../shared/types.js";
import { getSetupStatus } from "./api.js";

export default function SetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getSetupStatus()
      .then(setStatus)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const extensionConfig = useMemo(() => {
    if (!status) return "";
    return `${JSON.stringify(status.extensionConfigTemplate, null, 2)}\n`;
  }, [status]);

  async function copyExtensionConfig() {
    await navigator.clipboard.writeText(extensionConfig);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (error) {
    return (
      <main className="setup-page">
        <section className="setup-panel">
          <h1>LearnCache Setup</h1>
          <p className="setup-error">{error}</p>
        </section>
      </main>
    );
  }

  if (!status) {
    return (
      <main className="setup-page">
        <section className="setup-panel">
          <h1>LearnCache Setup</h1>
          <p className="muted">Checking configuration...</p>
        </section>
      </main>
    );
  }

  const checks = [
    { label: "Data directory writable", ok: status.dataDir.writable, detail: status.dataDir.path },
    { label: "Password auth ready", ok: !status.auth.enabled || (status.auth.provider === "password" && status.auth.appPasswordConfigured && status.auth.sessionSecretConfigured) },
    { label: "Extension token set", ok: !status.auth.enabled || status.auth.extensionTokenConfigured },
    { label: "Chrome extension CORS allowed", ok: !status.auth.enabled || status.cors.chromeExtensionWildcard },
    { label: `${status.ai.textProvider} summaries configured`, ok: status.ai.textProviderConfigured },
    { label: `${status.ai.transcribeProvider} transcription configured`, ok: status.ai.transcribeProviderConfigured },
    { label: "Supadata fallback configured", ok: status.ai.youtubeTranscriptProvider !== "supadata" && status.ai.youtubeTranscriptProvider !== "auto" ? true : status.ai.supadataConfigured },
    { label: "yt-dlp available", ok: status.tools.ytdlpAvailable },
    { label: "ffmpeg available", ok: status.tools.ffmpegAvailable }
  ];

  return (
    <main className="setup-page">
      <section className="setup-panel">
        <div className="setup-heading">
          <Settings aria-hidden="true" />
          <div>
            <h1>LearnCache Setup</h1>
            <p>{status.appPublicUrl}</p>
          </div>
        </div>

        <div className="setup-grid">
          {checks.map((check) => (
            <div className={`setup-check ${check.ok ? "ok" : "missing"}`} key={check.label}>
              {check.ok ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
              <span>
                <strong>{check.label}</strong>
                {check.detail && <small>{check.detail}</small>}
              </span>
            </div>
          ))}
        </div>

        <section className="setup-copy">
          <div className="setup-copy-header">
            <div>
              <h2>Extension config</h2>
              <p>Paste your real token over the placeholder, then save as `extension/local/config.json`.</p>
            </div>
            <button type="button" onClick={() => void copyExtensionConfig()} disabled={!extensionConfig}>
              <Clipboard aria-hidden="true" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre>{extensionConfig}</pre>
        </section>

        <div className="setup-links">
          <a href="/">
            <ExternalLink aria-hidden="true" />
            Inbox
          </a>
          <a href="https://github.com/paolodit/learncache/blob/main/docs/chrome-extension.md" target="_blank" rel="noreferrer">
            Extension docs
          </a>
        </div>
      </section>
    </main>
  );
}
