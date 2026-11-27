import {
  adminWriteGateway,
  type AdminWriteGatewayAction,
} from "@/lib/supabase-gateway";

export type TokMetricCommandOperation =
  | "snapshot"
  | "create_draft"
  | "create_version"
  | "run_review"
  | "request_approval"
  | "decide_approval"
  | "publish_preflight";

export async function invokeTokMetricCommandGateway<T>(
  token: string,
  operation: TokMetricCommandOperation,
  payload: Record<string, unknown> = {},
): Promise<T> {
  return adminWriteGateway<T>(
    "tokmetric_command" as AdminWriteGatewayAction,
    token,
    { operation, ...payload },
  );
}
