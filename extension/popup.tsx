import { ClerkProvider, SignInButton, SignedIn, SignedOut, UserButton, useAuth } from "@clerk/chrome-extension";
import { useEffect, useState } from "react";
import "./style.css";

const appUrl = process.env.PLASMO_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

function Popup() {
  if (!publishableKey) {
    return <div className="popup">Missing PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY.</div>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <SignedOut>
        <div className="popup">
          <h1>LearnCache</h1>
          <p>Sign in to save the current tab.</p>
          <SignInButton mode="modal">
            <button>Sign in</button>
          </SignInButton>
        </div>
      </SignedOut>
      <SignedIn>
        <CapturePopup />
      </SignedIn>
    </ClerkProvider>
  );
}

function CapturePopup() {
  const { getToken } = useAuth();
  const [tabUrl, setTabUrl] = useState("");
  const [status, setStatus] = useState("Ready");

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.url) setTabUrl(tab.url);
    });
  }, []);

  async function saveCurrentTab() {
    if (!tabUrl) return;
    setStatus("Saving...");
    const token = await getToken();
    const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ url: tabUrl })
    });
    if (!response.ok) {
      setStatus(await response.text());
      return;
    }
    const body = (await response.json()) as { duplicate?: boolean };
    setStatus(body.duplicate ? "Already saved" : "Saved");
  }

  return (
    <div className="popup">
      <div className="top-row">
        <h1>LearnCache</h1>
        <UserButton />
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

export default Popup;
