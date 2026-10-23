/** Fail-closed action policy. Threat events alone never grant response authority. */
export type SecurityResponseAction = "create_incident" | "notify_operator" | "isolate_endpoint" | "revoke_session" | "block_indicator";
export type ActionDecision = Readonly<{allowed: boolean; reason: string}>;
export function evaluateSecurityResponse(input: {
  action: SecurityResponseAction;
  tenantAuthorized: boolean;
  integrationVerified: boolean;
  approvalId?: string;
  policyEnabled: boolean;
}): ActionDecision {
  if (!input.tenantAuthorized) return {allowed:false,reason:"Client authorization missing"};
  if (!input.policyEnabled) return {allowed:false,reason:"Response policy disabled"};
  if (!input.integrationVerified) return {allowed:false,reason:"Integration not verified"};
  if (input.action !== "create_incident" && input.action !== "notify_operator" && !input.approvalId?.trim()) {
    return {allowed:false,reason:"Explicit action approval required"};
  }
  return {allowed:true,reason:"Policy prerequisites satisfied; downstream authorization and execution still required"};
}
