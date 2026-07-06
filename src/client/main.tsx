import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { getAppConfig, getMe, loginWithPassword, logout, type AppConfig, type AppUser } from "./api.js";
import SetupPage from "./SetupPage.js";
import "./styles.css";

function Root() {
  const [config, setConfig] = React.useState<AppConfig | null>(null);
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function boot() {
      try {
        const nextConfig = await getAppConfig();
        setConfig(nextConfig);

        if (!nextConfig.authEnabled) {
          setUser({ userId: "local", email: null, authMethod: "local" });
          return;
        }

        const me = await getMe().catch(() => null);
        setUser(me?.user ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    void boot();
  }, []);

  if (error) return <div className="boot-state">Could not load LearnCache: {error}</div>;
  if (loading || !config) return <div className="boot-state">Loading...</div>;

  if (config.authEnabled && config.authProvider === "password" && !user) {
    return <PasswordAuthScreen onSignedIn={setUser} />;
  }

  if (config.authEnabled && config.authProvider === "clerk") {
    return (
      <div className="auth-screen">
        <div>
          <h1>LearnCache</h1>
          <p>Clerk auth is no longer the recommended hosted mode. Switch to `AUTH_PROVIDER=password` for the built-in login.</p>
        </div>
      </div>
    );
  }

  const isSetupPage = window.location.pathname.replace(/\/+$/, "") === "/setup";

  return (
    <>
      {config.authEnabled && (
        <div className="user-menu">
          <a href={isSetupPage ? "/" : "/setup"}>{isSetupPage ? "Inbox" : "Setup"}</a>
          <button
            type="button"
            onClick={() => {
              void logout().finally(() => setUser(null));
            }}
          >
            Sign out
          </button>
        </div>
      )}
      {isSetupPage ? <SetupPage /> : <App authEnabled={config.authEnabled} />}
    </>
  );
}

function PasswordAuthScreen({ onSignedIn }: { onSignedIn: (user: AppUser) => void }) {
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await loginWithPassword(password);
      onSignedIn(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <form onSubmit={submit}>
        <h1>LearnCache</h1>
        <p>Enter your private app password to open your learning inbox.</p>
        <label>
          <span>Password</span>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="App password"
          />
        </label>
        <button type="submit" disabled={submitting || !password}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
        {error && <div className="auth-error">{error}</div>}
      </form>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // PWA capture still works as a normal page when registration fails.
    });
  });
}
