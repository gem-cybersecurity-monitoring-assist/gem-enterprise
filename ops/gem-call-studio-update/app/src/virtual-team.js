const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export function validateProfile(p) {
  if (!p || typeof p.name !== "string" || !p.name.trim() || p.name.length > 80) throw new Error("Enter a team member name (up to 80 characters).");
  if (!Array.isArray(p.images) || p.images.length < 1 || p.images.length > 8) throw new Error("Choose 1–8 full-body reference images.");
  for (const image of [...p.images, ...(p.background ? [p.background] : [])]) {
    if (!image || !TYPES.has(image.type) || image.size <= 0 || image.size > 5 * 1024 * 1024) throw new Error("Images must be JPEG, PNG or WebP, each under 5 MB.");
  }
  if (p.voiceSample && (!["audio/wav","audio/x-wav","audio/mpeg","audio/mp4","audio/ogg","audio/webm","audio/flac"].includes(p.voiceSample.type) ||
      p.voiceSample.size <= 0 || p.voiceSample.size > 15 * 1024 * 1024)) throw new Error("Voice reference must be a supported audio file under 15 MB.");
  if (p.authorized !== true || p.fullBodyConfirmed !== true) throw new Error("Confirm asset authorization and a full-body reference.");
  if ([...p.images, ...(p.background ? [p.background] : []), ...(p.voiceSample ? [p.voiceSample] : [])].reduce((n, f) => n + f.size, 0) > 40 * 1024 * 1024) throw new Error("Keep each team profile under 40 MB.");
  return p;
}
export function assessFullBodyReadiness(profile, caps = {}) {
  const missing = [];
  try { validateProfile(profile); } catch (error) { missing.push(error.message); }
  if (caps.fullBodyMotion !== true) missing.push("Live full-body motion renderer");
  if (caps.facialExpression !== true) missing.push("Expression and lip synchronization");
  if (caps.backgroundReplacement !== true) missing.push("Independent background replacement");
  if (caps.customVoice !== true) missing.push("Live custom voice converter");
  if (caps.virtualMicrophone !== true) missing.push("Verified virtual microphone output");
  if (caps.actualCallVerified !== true) missing.push("Two-client call verification");
  return { ready: missing.length === 0, missing };
}
function openStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("gem-virtual-team-v1", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("profiles", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error("Local profile storage is unavailable."));
  });
}
async function transaction(mode, action) {
  const db = await openStore();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("profiles", mode);
      const req = action(tx.objectStore("profiles"));
      let result;
      req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(new Error("Profile storage failed. Check available disk space."));
    });
  } finally { db.close(); }
}
export const profileStore = {
  list: () => transaction("readonly", store => store.getAll()),
  save: p => { validateProfile(p); return transaction("readwrite", store => store.put(p)); },
  remove: id => transaction("readwrite", store => store.delete(id))
};
export function initVirtualTeam({ onSelect = () => {}, isBusy = () => false } = {}) {
  const $ = id => document.getElementById(id);
  let profiles = [], selected = null, urls = [];
  const selectionKey = "gem-selected-team-v1";
  let restoredId = "";
  try { restoredId = localStorage.getItem(selectionKey) || ""; } catch {}
  const status = message => { $("teamStatus").textContent = message; };
  function revoke() { urls.forEach(url => URL.revokeObjectURL(url)); urls = []; }
  function show(p) {
    revoke(); selected = p;
    try { if (p) localStorage.setItem(selectionKey, p.id); else localStorage.removeItem(selectionKey); } catch {}
    const preview = $("teamPreview"); preview.replaceChildren();
    if (p) {
      for (const file of [...p.images, ...(p.background ? [p.background] : [])]) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file); urls.push(img.src);
        img.alt = "Saved reference — static asset, not live output";
        img.style.cssText = "height:160px;max-width:180px;object-fit:contain;margin:6px";
        preview.append(img);
      }
      $("teamName").value = p.name;
      status(p.name + " selected. References saved locally. Full-body rendering and custom voice are not connected.");
    } else status("Create a virtual team profile. Upload full-body images, a separate background and voice reference.");
    onSelect(p);
  }
  async function refresh(id) {
    profiles = await profileStore.list();
    const select = $("teamProfile"); select.replaceChildren(new Option("Choose a saved team member", ""));
    profiles.forEach(p => select.add(new Option(p.name, p.id)));
    select.value = id || ""; show(profiles.find(p => p.id === id) || null);
  }
  $("teamProfile").onchange = () => {
    if (isBusy()) { $("teamProfile").value = selected?.id || ""; status("Stop the current session before switching team members."); return; }
    show(profiles.find(p => p.id === $("teamProfile").value) || null);
  };
  $("saveTeam").onclick = async () => {
    if (isBusy()) { status("Stop the current session before changing assets."); return; }
    try {
      const p = validateProfile({ id: crypto.randomUUID(), name: $("teamName").value.trim(),
        images: [...$("teamImages").files], background: $("teamBackground").files[0],
        voiceSample: $("teamVoice").files[0], authorized: $("teamAuthorized").checked,
        fullBodyConfirmed: $("teamFullBody").checked, createdAt: new Date().toISOString() });
      if (profiles.length >= 20) throw new Error("Maximum 20 team profiles. Delete an unused profile first.");
      for (const file of [...p.images, ...(p.background ? [p.background] : [])]) {
        const bitmap = await createImageBitmap(file);
        const oversized = bitmap.width * bitmap.height > 24000000;
        bitmap.close(); if (oversized) throw new Error("Use images below 24 megapixels.");
      }
      await profileStore.save(p); await refresh(p.id);
      ["teamImages", "teamBackground", "teamVoice"].forEach(id => { $(id).value = ""; });
      $("teamAuthorized").checked = false; $("teamFullBody").checked = false;
    } catch (error) { status(error.message); }
  };
  $("deleteTeam").onclick = async () => {
    if (isBusy()) { status("Stop the session before deleting a profile."); return; }
    if (!selected) return;
    try { await profileStore.remove(selected.id); await refresh(); } catch (error) { status(error.message); }
  };
  window.addEventListener("beforeunload", revoke);
  refresh(restoredId).catch(error => status(error.message));
  return { selected: () => selected };
}