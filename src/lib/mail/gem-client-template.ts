import { sendMail } from "@/lib/mail/send";

const GEM_ORIGIN = "https://www.gemcybersecurityassist.com";
const ALLOWED_GEM_HOSTS = new Set([
  "www.gemcybersecurityassist.com",
  "gemcybersecurityassist.com",
]);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeHttpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("GEM email action URLs must use HTTPS.");
  }
  return url;
}

function validateWorkspaceActivationUrl(value: string) {
  const url = normalizeHttpsUrl(value);
  if (
    !ALLOWED_GEM_HOSTS.has(url.hostname) ||
    url.pathname !== "/workspace-invitation" ||
    !url.hash.slice(1)
  ) {
    throw new Error("Workspace activation URL is not a canonical GEM invitation URL.");
  }
  return url.toString();
}

function formatUtcDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invitation expiry must be a valid date.");
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  })
    .format(date)
    .replace("24:", "00:");
}

export type GemClientEmailInput = {
  preheader: string;
  communicationLabel: string;
  title: string;
  reference?: string;
  clientName?: string;
  projectName?: string;
  organizationName?: string;
  status?: string;
  greetingName?: string;
  paragraphs: string[];
  statusLabel?: string;
  statusTitle?: string;
  statusBody?: string;
  cta?: {
    eyebrow?: string;
    label: string;
    url: string;
    supportingText?: string;
  };
  checklistHeading?: string;
  checklist?: string[];
  securityNotice?: string;
  fallbackLinkLabel?: string;
  footerNote?: string;
};

function metadataRows(input: GemClientEmailInput) {
  const rows: Array<[string, string | undefined]> = [
    ["Reference", input.reference],
    ["Client", input.clientName],
    ["Project", input.projectName],
    ["Organization", input.organizationName],
    ["Status", input.status],
  ];
  const present = rows.filter((row): row is [string, string] => Boolean(row[1]));
  if (present.length === 0) return "";
  return present
    .map(
      ([label, value]) =>
        `<strong style="color:#253651;">${escapeHtml(label)}:</strong> ${escapeHtml(value)}<br>`,
    )
    .join("")
    .replace(/<br>$/, "");
}

export function buildGemClientEmail(input: GemClientEmailInput) {
  const actionUrl = input.cta ? normalizeHttpsUrl(input.cta.url).toString() : null;
  const textLines = [
    input.greetingName ? `Dear ${input.greetingName},` : "",
    "",
    input.title,
    "",
    input.reference ? `Reference: ${input.reference}` : "",
    input.clientName ? `Client: ${input.clientName}` : "",
    input.projectName ? `Project: ${input.projectName}` : "",
    input.organizationName ? `Organization: ${input.organizationName}` : "",
    input.status ? `Status: ${input.status}` : "",
    "",
    ...input.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    input.statusTitle ? `${input.statusLabel || "Current Status"}: ${input.statusTitle}` : "",
    input.statusBody || "",
    input.statusTitle || input.statusBody ? "" : "",
    input.cta ? `${input.cta.label}: ${actionUrl}` : "",
    input.cta?.supportingText || "",
    input.cta ? "" : "",
    input.checklistHeading || "",
    ...(input.checklist || []).map((item) => `- ${item}`),
    input.checklist?.length ? "" : "",
    input.securityNotice ? `Security Notice: ${input.securityNotice}` : "",
    "",
    "GEM Cybersecurity & Monitoring Assist",
    "Secure Client Services & Project Administration",
    GEM_ORIGIN,
    input.footerNote || "Official GEM client communication.",
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "");

  const paragraphs = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:25px;color:#4f5f73;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  const meta = metadataRows(input);
  const metaPanel = meta
    ? `<tr><td style="padding:12px 28px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6f9;border:1px solid #dce2ea;"><tr><td style="padding:14px 16px;font-size:11px;line-height:18px;color:#506078;">${meta}</td></tr></table></td></tr>`
    : "";

  const statusPanel = input.statusTitle || input.statusBody
    ? `<tr><td style="padding:24px 28px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff8e6;border:1px solid #dfbf65;border-left:4px solid #d3a42c;"><tr><td style="padding:16px 17px;"><div style="font-size:9px;line-height:13px;font-weight:700;letter-spacing:1.15px;text-transform:uppercase;color:#9a7718;margin-bottom:5px;">${escapeHtml(input.statusLabel || "Current Status")}</div>${input.statusTitle ? `<div style="font-size:18px;line-height:23px;font-weight:700;color:#1e3153;margin-bottom:7px;">${escapeHtml(input.statusTitle)}</div>` : ""}${input.statusBody ? `<div style="font-size:13px;line-height:21px;color:#5d5b55;">${escapeHtml(input.statusBody)}</div>` : ""}</td></tr></table></td></tr>`
    : "";

  const ctaPanel = input.cta && actionUrl
    ? `<tr><td style="padding:26px 28px 0;"><h2 style="margin:0 0 13px;font-size:18px;line-height:23px;color:#172b4d;">Workspace Access</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef9f8;border:1px solid #b8ded9;"><tr><td align="center" style="padding:22px 18px;">${input.cta.eyebrow ? `<div style="font-size:9px;line-height:13px;font-weight:700;letter-spacing:1.15px;text-transform:uppercase;color:#0a6c68;margin-bottom:8px;">${escapeHtml(input.cta.eyebrow)}</div>` : ""}<a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#0a2147;color:#ffffff;text-decoration:none;font-size:14px;line-height:18px;font-weight:700;padding:14px 25px;border-bottom:3px solid #d3a42c;">${escapeHtml(input.cta.label)}</a>${input.cta.supportingText ? `<div style="margin-top:12px;font-size:11px;line-height:17px;color:#647386;">${escapeHtml(input.cta.supportingText)}</div>` : ""}</td></tr></table></td></tr>`
    : "";

  const checklist = input.checklist?.length
    ? `<tr><td style="padding:26px 28px 0;"><h2 style="margin:0 0 12px;font-size:18px;line-height:23px;color:#172b4d;">${escapeHtml(input.checklistHeading || "What happens next")}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${input.checklist
        .map(
          (item) =>
            `<tr><td width="22" valign="top" style="padding:3px 0 8px;color:#0a6c68;font-weight:700;">✓</td><td style="padding:0 0 8px;font-size:14px;line-height:21px;color:#536176;">${escapeHtml(item)}</td></tr>`,
        )
        .join("")}</table></td></tr>`
    : "";

  const security = input.securityNotice
    ? `<tr><td style="padding:24px 28px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e0e5ec;border-bottom:1px solid #e0e5ec;"><tr><td style="padding:17px 0;"><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0a6c68;margin-bottom:5px;">Security Notice</div><div style="font-size:12px;line-height:19px;color:#68768a;">${escapeHtml(input.securityNotice)}</div></td></tr></table></td></tr>`
    : "";

  const fallback = input.cta && actionUrl && input.fallbackLinkLabel
    ? `<tr><td style="padding:20px 28px 0;"><div style="font-size:11px;line-height:18px;color:#788598;">If the activation button does not open, use the secure link below:<br><a href="${escapeHtml(actionUrl)}" style="color:#0a6c68;text-decoration:underline;word-break:break-all;">${escapeHtml(input.fallbackLinkLabel)}</a></div></td></tr>`
    : "";

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#eef1f5;font-family:Arial,Helvetica,sans-serif;color:#14233f;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#eef1f5;margin:0;padding:0;"><tr><td align="center" style="padding:22px 10px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #d9dee7;box-shadow:0 4px 18px rgba(8,27,59,.10);"><tr><td style="background:#0a2147;padding:20px 24px 18px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="54" valign="middle"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" valign="middle" style="width:40px;height:40px;background:#0a6663;border:2px solid #d3a42c;color:#ffffff;font-size:20px;font-weight:700;line-height:40px;">G</td></tr></table></td><td valign="middle"><div style="font-size:19px;line-height:22px;font-weight:700;color:#ffffff;">GEM Cybersecurity &amp;<br>Monitoring Assist</div><div style="margin-top:5px;font-size:9px;line-height:13px;letter-spacing:1.25px;text-transform:uppercase;color:#b9c8db;font-weight:700;">Cybersecurity · Monitoring ·<br>Compliance Readiness · Project Administration</div></td></tr></table></td></tr><tr><td style="height:4px;background:#d3a42c;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td style="padding:30px 28px 8px;"><div style="font-size:10px;line-height:14px;font-weight:700;letter-spacing:1.35px;text-transform:uppercase;color:#0a6c68;margin-bottom:10px;">${escapeHtml(input.communicationLabel)}</div><h1 style="margin:0;color:#112343;font-size:29px;line-height:35px;letter-spacing:-.45px;font-weight:700;">${escapeHtml(input.title)}</h1></td></tr>${metaPanel}<tr><td style="padding:30px 28px 0;">${input.greetingName ? `<p style="margin:0 0 16px;font-size:15px;line-height:25px;color:#263750;">Dear ${escapeHtml(input.greetingName)},</p>` : ""}${paragraphs}</td></tr>${statusPanel}${ctaPanel}${checklist}${security}${fallback}<tr><td style="padding:26px 28px 28px;"><div style="font-size:12px;line-height:19px;color:#68768a;"><strong style="color:#253651;">GEM Cybersecurity &amp; Monitoring Assist</strong><br>Secure Client Services &amp; Project Administration<br><a href="${GEM_ORIGIN}" style="color:#0a6c68;text-decoration:none;">gemcybersecurityassist.com</a><br><br><span style="font-size:10px;color:#8b96a5;">${escapeHtml(input.footerNote || "Official GEM client communication.")}</span></div></td></tr><tr><td style="height:8px;background:#0a2147;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table></body></html>`;

  return { text: textLines.join("\n").trim(), html };
}

export type WorkspaceOwnerInvitationEmailInput = {
  to: string;
  clientName: string;
  projectName: string;
  organizationName: string;
  activationUrl: string;
  expiresAt: string | Date;
};

export function buildWorkspaceOwnerInvitationEmail(
  input: WorkspaceOwnerInvitationEmailInput,
) {
  const activationUrl = validateWorkspaceActivationUrl(input.activationUrl);
  const expiry = formatUtcDate(input.expiresAt);
  const content = buildGemClientEmail({
    preheader: `Official GEM client communication — your ${input.projectName} workspace is ready for secure activation.`,
    communicationLabel: "Official Client Project Communication",
    title: "Secure Workspace Access & Activation",
    reference: "Workspace Access Invitation",
    clientName: input.clientName,
    projectName: input.projectName,
    organizationName: input.organizationName,
    status: "Secure Workspace Ready — Activation Required",
    greetingName: input.clientName,
    paragraphs: [
      `This official communication is being issued by GEM Assist Administration to confirm that the company-side preparation of your secure client workspace has been completed. Your ${input.projectName} project is ready to be linked to your client account through the secure activation process below.`,
    ],
    statusLabel: "Current Status",
    statusTitle: "Secure Workspace Ready — Activation Required",
    statusBody:
      "The company-side workspace setup is complete. Activation is required to establish your personal account access, Organization Owner membership, and secure project linkage.",
    cta: {
      eyebrow: "Secure Client Access",
      label: "ACTIVATE SECURE WORKSPACE",
      url: activationUrl,
      supportingText: `Invitation expires ${expiry}`,
    },
    checklistHeading: "After Activation",
    checklist: [
      "Your organization and secure GEM workspace are linked to your account.",
      "Your Organization Owner membership is established.",
      `${input.projectName} becomes available in your GEM-managed client workspace.`,
    ],
    securityNotice:
      "This invitation is personal and may be used only once. GEM Assist will never ask you to send your password or secure activation link by email, SMS, or chat. If you did not expect this communication, do not use the activation link.",
    fallbackLinkLabel: "Open GEM Assist workspace activation",
    footerNote:
      "Official GEM client communication. Workspace access is scoped to your organization and does not grant GEM platform-administrator authority.",
  });

  return {
    to: input.to,
    subject: "GEM Enterprise — Official Client Workspace Invitation",
    ...content,
  };
}

export async function sendWorkspaceOwnerInvitationEmail(
  input: WorkspaceOwnerInvitationEmailInput,
) {
  const message = buildWorkspaceOwnerInvitationEmail(input);
  return sendMail({
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
