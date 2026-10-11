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

  try {
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
    return await db.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: {
          id: user.id,
          passwordHash: user.passwordHash,
          sessionVersion: user.sessionVersion,
          email: claims.email,
          isActive: true,
          status: "active",
        },
        data: { passwordHash: nextHash },
      });
      if (changed.count !== 1) return { ok: false as const, code: "invalid_token" };

      const updated = await tx.user.findUnique({
        where: { id: user.id },
        select: { sessionVersion: true },
      });
      if (!updated || updated.sessionVersion <= user.sessionVersion) {
        // Throwing rolls back the password change if the revocation trigger is absent.
        throw new Error("SESSION_REVOCATION_NOT_RECORDED");
      }

      const audit = await tx.auditLog.findFirst({
        where: {
          userId: user.id,
          action: "password_change",
          resource: "user",
          resourceId: user.id,
          AND: [
            { metadata: { path: ["flow"], equals: "database_password_change_trigger" } },
            { metadata: { path: ["sessionVersion"], equals: updated.sessionVersion } },
            { metadata: { path: ["sessionsRevoked"], equals: true } },
          ],
        },
        select: { id: true },
      });
      if (!audit) throw new Error("SESSION_REVOCATION_AUDIT_NOT_RECORDED");

      return {
        ok: true as const,
        userId: user.id,
        sessionVersion: updated.sessionVersion,
        sessionsRevoked: true as const,
        auditRecorded: true as const,
      };
    });
  } catch {
    return { ok: false as const, code: "service_unavailable" };
  }
}
