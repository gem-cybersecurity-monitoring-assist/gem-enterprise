import { TokMetricError } from "@/lib/tokmetric/security";

const ALLOWED_STORYLINES = new Set(["gem-cyber-qr-code-trap", "gem-cyber-phishing-red-flags", "gem-cyber-fake-delivery-text", "gem-cyber-password-2fa", "gem-cyber-public-wifi", "gem-cyber-tech-support-popup"]);
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function invalid(message: string): never { throw new TokMetricError(400, "STORYLINE_MANIFEST_INVALID", message); }

export function validateGemStorylineManifest(input: { storylineId: string; fileName: string; fileSize: number; checksumSha256: string; manifest: Record<string, unknown> }) {
  const m = input.manifest;
  if (!ALLOWED_STORYLINES.has(input.storylineId) || m.storyline !== input.storylineId || m.vertical !== "cybersecurity") invalid("The requested GEM cybersecurity storyline is not in the approved library.");
  if (m.status !== "DRAFT_PENDING_APPROVAL") invalid("Only completed cybersecurity drafts are eligible; offline test renders are not accepted.");
  const validation = object(m.validation);
  if (validation.passed !== true || Object.keys(object(validation.failures)).length > 0) invalid("The rendered video did not pass Storylines output validation.");
  const disclosures = object(m.disclosures);
  if (disclosures.syntheticVoice !== true || disclosures.voiceType !== "synthetic_kokoro" || disclosures.aiGeneratedContent !== true) invalid("The render must retain its Kokoro and AI-generated-content disclosures.");
  const post = object(m.post); const caption = typeof post.caption === "string" ? post.caption.trim() : "";
  const hashtags = Array.isArray(post.hashtags) ? post.hashtags.filter((v): v is string => typeof v === "string") : [];
  if (!caption || hashtags.length > 30 || hashtags.some(tag => !/^#[A-Za-z0-9_]{1,64}$/.test(tag))) invalid("The social caption or hashtag metadata is invalid.");
  const narration = Array.isArray(m.narration) ? m.narration : [];
  if (narration.length < 3 || narration.length > 12) invalid("The render manifest must contain approved scene narration.");
  const scenes = narration.map((entry, index) => { const scene = object(entry); const voiceover = typeof scene.voiceover === "string" ? scene.voiceover.trim() : ""; const sceneCaption = typeof scene.caption === "string" ? scene.caption.trim() : ""; const role = typeof scene.role === "string" ? scene.role.trim() : ""; if (!voiceover || !sceneCaption || !role || scene.beat !== index) invalid("Scene narration is incomplete or out of sequence."); return { voiceover, caption: sceneCaption, role }; });
  const outputs = Array.isArray(m.outputs) ? m.outputs : []; const primary = outputs.map(object).find(output => output.variant === "vertical_9x16");
  if (!primary) invalid("The 9:16 vertical master is missing from the render manifest.");
  const sha256 = typeof primary.sha256 === "string" ? primary.sha256.toLowerCase() : ""; const bytes = Number(primary.bytes); const durationSec = Number(primary.durationSec);
  if (primary.file !== input.fileName || primary.width !== 1080 || primary.height !== 1920 || !/^[a-f0-9]{64}$/.test(sha256) || sha256 !== input.checksumSha256.toLowerCase() || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 512 * 1024 * 1024 || bytes !== input.fileSize || !Number.isFinite(durationSec) || durationSec <= 0 || durationSec > 60) invalid("The uploaded MP4 does not match the validated 9:16 render manifest.");
  const title = typeof m.title === "string" ? m.title.trim() : ""; if (!title) invalid("The storyline title is missing.");
  return { title, script: scenes.map(scene => scene.voiceover).join("\n\n"), caption, hashtags, scenes, primary: { fileName: input.fileName, fileSize: bytes, checksumSha256: sha256, durationSec }, disclosures };
}
