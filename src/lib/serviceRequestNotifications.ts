import type { RequestLifecycleStatus } from "@/lib/serviceRequests";

/**
 * Safe recipient-facing case notice. No free-text audit notes, internal staff
 * IDs, credentials, or organization-sensitive details are included.
 */
const safeStatusLabel: Record<RequestLifecycleStatus, string> = {
  open: "open",
  in_progress: "in progress",
  pending_info: "awaiting information",
  completed: "completed",
  cancelled: "cancelled",
};

export function serviceRequestStatusNotification(input: {
  requestId: string;
  fromStatus: RequestLifecycleStatus;
  toStatus: RequestLifecycleStatus;
}) {
  return {
    title: "Service request updated",
    body: `Your GEM service request is now ${safeStatusLabel[input.toStatus]}. Open your requests to review its status.`,
    channel: "in_app" as const,
    data: {
      kind: "service_request_status_changed",
      requestId: input.requestId,
      previousStatus: input.fromStatus,
      status: input.toStatus,
      href: "/app/requests",
    },
  };
}
