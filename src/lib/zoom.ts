type ZoomMeeting = { id: number; join_url: string; start_url?: string };

function zoomConfigured() {
  return Boolean(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
}

async function accessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID!;
  const clientId = process.env.ZOOM_CLIENT_ID!;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET!;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "account_credentials", account_id: accountId }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Zoom OAuth failed (${response.status})`);
  const data = await response.json() as { access_token: string };
  return data.access_token;
}

export async function createZoomMeeting(input: { topic: string; description?: string; startTime: Date; duration: number }): Promise<ZoomMeeting | null> {
  if (!zoomConfigured()) return null;
  const token = await accessToken();
  const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: input.topic,
      type: 2,
      start_time: input.startTime.toISOString(),
      duration: input.duration,
      timezone: "UTC",
      agenda: input.description ?? "",
      settings: { waiting_room: true, join_before_host: false, meeting_authentication: false },
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Zoom meeting creation failed (${response.status})`);
  return await response.json() as ZoomMeeting;
}

export function isZoomConfigured() { return zoomConfigured(); }
