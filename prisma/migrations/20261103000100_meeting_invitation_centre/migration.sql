ALTER TABLE "meeting_requests"
  ADD COLUMN "zoomMeetingId" TEXT,
  ADD COLUMN "zoomJoinUrl" TEXT,
  ADD COLUMN "zoomStartUrl" TEXT;

CREATE INDEX "meeting_requests_requesterId_proposedAt_idx" ON "meeting_requests"("requesterId", "proposedAt");
CREATE INDEX "meeting_requests_hostId_proposedAt_idx" ON "meeting_requests"("hostId", "proposedAt");

CREATE TABLE "meeting_invitees" (
  "id" TEXT NOT NULL,
  "meetingRequestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'INVITED',
  "zoomParticipantId" TEXT,
  "joinedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meeting_invitees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meeting_invitees_meetingRequestId_userId_key" ON "meeting_invitees"("meetingRequestId", "userId");
CREATE INDEX "meeting_invitees_userId_status_idx" ON "meeting_invitees"("userId", "status");

ALTER TABLE "meeting_invitees" ADD CONSTRAINT "meeting_invitees_meetingRequestId_fkey"
  FOREIGN KEY ("meetingRequestId") REFERENCES "meeting_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_invitees" ADD CONSTRAINT "meeting_invitees_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
