import React from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, SignInButton, SignedIn, SignedOut, UserButton, useAuth } from "@clerk/clerk-react";
import App from "./App.js";
import { getAppConfig, setAuthTokenProvider, type AppConfig } from "./api.js";
import "./styles.css";

function Root() {
  const [config, setConfig] = React.useState<AppConfig | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getAppConfig()
      .then(setConfig)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) return <div className="boot-state">Could not load app configuration: {error}</div>;
  if (!config) return <div className="boot-state">Loading...</div>;
  if (!config.authEnabled) return <App authEnabled={false} />;
  if (!config.clerkPublishableKey) return <div className="boot-state">CLERK_PUBLISHABLE_KEY is missing.</div>;

  return (
    <ClerkProvider publishableKey={config.clerkPublishableKey} afterSignOutUrl="/">
      <SignedOut>
        <div className="auth-screen">
          <div>
            <h1>LearnCache</h1>
            <p>Sign in to capture, transcribe, and export your private learning notes.</p>
            <SignInButton mode="modal">
              <button>Sign in</button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
    </ClerkProvider>
  );
}

function AuthenticatedApp() {
  const { getToken } = useAuth();

  React.useEffect(() => {
    setAuthTokenProvider(() => getToken());
    return () => setAuthTokenProvider(null);
  }, [getToken]);

  return (
    <>
      <div className="user-menu">
        <UserButton afterSignOutUrl="/" />
      </div>
      <App authEnabled />
    </>
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
