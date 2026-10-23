import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getGitHubAppConfigurationStatus } from "@/lib/github-app";
import { repositoryConnection } from "@/lib/platformEnvironment";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["admin", "super_admin", "internal"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configuration = getGitHubAppConfigurationStatus();

  return NextResponse.json({
    integration: "github_app",
    repository: repositoryConnection,
    configuration,
    ready:
      configuration.appIdConfigured &&
      configuration.privateKeyConfigured &&
      configuration.webhookSecretConfigured,
    webhookUrl: "https://gemcybersecurityassist.com/api/integrations/github/webhook",
    externalActionTaken: false,
  });
}
