const appUrl = process.env.PLASMO_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-learncache",
    title: "Save to LearnCache",
    contexts: ["page", "link", "video", "audio"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.linkUrl ?? info.srcUrl ?? info.pageUrl ?? tab?.url;
  if (!url) return;
  chrome.tabs.create({
    url: `${appUrl.replace(/\/$/, "")}/capture?url=${encodeURIComponent(url)}`
  });
});
