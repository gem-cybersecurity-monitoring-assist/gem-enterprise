"use strict";
const site = document.getElementById("site");
const transport = document.getElementById("transport");
const checks = document.getElementById("checks");
const settings = [
  ["Third-party cookies", "websites.thirdPartyCookiesAllowed", false],
  ["Network prediction", "network.networkPredictionEnabled", false],
  ["Credit-card autofill", "services.autofillCreditCardEnabled", false],
];
async function scan() {
  checks.replaceChildren();
  for (const [label, path, secureValue] of settings) {
    const item = document.createElement("li");
    const [group, name] = path.split(".");
    try {
      const api = chrome.privacy?.[group]?.[name];
      if (!api?.get) { item.textContent = label + ": not supported"; }
      else {
        const result = await api.get({});
        const safe = result.value === secureValue;
        item.textContent = label + ": " + (safe ? "privacy-friendly" : "review setting");
        item.className = safe ? "good" : "warn";
      }
    } catch {
      item.textContent = label + ": unavailable";
    }
    checks.appendChild(item);
  }
}
async function inspectTab() {
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.url) { site.textContent = "Open a website to inspect the connection."; transport.textContent = "Not evaluated"; return; }
    const url = new URL(tab.url);
    if (!["https:","http:"].includes(url.protocol)) { site.textContent = "Browser internal page"; transport.textContent = "Not applicable"; return; }
    site.textContent = url.hostname;
    const encrypted = url.protocol === "https:";
    transport.textContent = encrypted ? "HTTPS URL detected" : "HTTP URL — connection not encrypted";
    transport.className = "status " + (encrypted ? "good" : "warn");
  } catch {
    site.textContent = "This page cannot be inspected.";
    transport.textContent = "Unknown";
  }
}
document.getElementById("refresh").addEventListener("click", scan);
void Promise.all([inspectTab(),scan()]);
