import bcryptjs from "bcryptjs";
import { db } from "@/lib/db";
import {
  fingerprintPasswordHash,
  passwordFingerprintsMatch,
  verifyPasswordResetToken,
} from "@/lib/passwordReset";

export async function completePasswordReset(token: string, newPassword: string) {
  const claims = await verifyPasswordResetToken(token);
  if (!claims) return { ok: false as const, code: "invalid_token" };

  const user = await db.user.findUnique({ where: { id: claims.userId } });
  if (!user || !user.isActive || user.status !== "active" || user.email !== claims.email) {
    return { ok: false as const, code: "invalid_token" };
  }

  const currentFingerprint = fingerprintPasswordHash(user.passwordHash);
  if (!passwordFingerprintsMatch(currentFingerprint, claims.passwordFingerprint)) {
    return { ok: false as const, code: "invalid_token" };
  }

  if (await bcryptjs.compare(newPassword, user.passwordHash)) {
    return { ok: false as const, code: "password_reused" };
  }

  const nextHash = await bcryptjs.hash(newPassword, 12);
  const changed = await db.user.updateMany({
    where: {
      id: user.id,
      passwordHash: user.passwordHash,
      sessionVersion: user.sessionVersion,
    },
    data: { passwordHash: nextHash },
  });
  if (changed.count !== 1) return { ok: false as const, code: "invalid_token" };

  const updated = await db.user.findUnique({
    where: { id: user.id },
    select: { sessionVersion: true },
  });
  if (!updated || updated.sessionVersion <= user.sessionVersion) {
    return { ok: false as const, code: "service_unavailable" };
  }

  return {
    ok: true as const,
    userId: user.id,
    sessionVersion: updated.sessionVersion,
    sessionsRevoked: true as const,
    auditRecorded: true as const,
  };
}
