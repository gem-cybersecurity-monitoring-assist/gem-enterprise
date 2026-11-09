-- Follow-up to 20261108050000_social_publishing_gateway_rpcs.sql.
--
-- The six table-returning gem_social_* RPCs declare their timestamp outputs
-- as timestamptz, but the social_* columns are timestamp(3) without time
-- zone. RETURN QUERY does not cast implicitly, so every call failed with
-- "structure of query does not match function result type" (42804), even
-- when no rows matched. Each timestamp output is now converted explicitly
-- with AT TIME ZONE 'UTC' (Prisma writes these columns in UTC), so the
-- result does not depend on the session TimeZone.
--
-- Signatures and return types are unchanged, so CREATE OR REPLACE applies.
-- Grants are restated: EXECUTE for service_role only.

-- gem_social_claim_jobs: 8 timestamp outputs converted.
CREATE OR REPLACE FUNCTION public.gem_social_claim_jobs(
  p_now timestamptz,
  p_slot_end timestamptz,
  p_claim_id text,
  p_claim_expires_at timestamptz,
  p_limit integer,
  p_spacing_minutes jsonb,
  p_slot_caps jsonb
)
RETURNS TABLE (
  id text,
  "workspaceId" text,
  provider text,
  "connectorId" text,
  "contentType" text,
  "contentVersionHash" text,
  "approvedVersionHash" text,
  "approvalId" text,
  "complianceReviewId" text,
  "compliancePassed" boolean,
  "idempotencyKey" text,
  payload jsonb,
  "localContext" text,
  state text,
  "attemptCount" integer,
  "maxAttempts" integer,
  "nextAttemptAt" timestamptz,
  "claimId" text,
  "claimExpiresAt" timestamptz,
  "externalPostId" text,
  "externalPostUrl" text,
  "safeProviderMetadata" jsonb,
  "lastErrorCode" text,
  "lastErrorMessage" text,
  "requestedById" text,
  "scheduledFor" timestamptz,
  "claimedAt" timestamptz,
  "submittedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT j.id, j.workspace_id, j.provider, j.connector_id, j.created_at
    FROM social_publishing_jobs j
    WHERE (
      (
        j.state IN ('PENDING', 'RETRYING')
        AND j.next_attempt_at <= p_now
        AND (j.scheduled_for IS NULL OR j.scheduled_for <= p_now)
      ) OR (
        j.state = 'CLAIMED'
        AND j.claim_expires_at IS NOT NULL
        AND j.claim_expires_at <= p_now
      )
    )
    AND (
      p_slot_end IS NULL
      OR j.scheduled_for IS NULL
      OR j.scheduled_for < p_slot_end
    )
  ),
  spaced AS (
    SELECT d.*
    FROM due d
    WHERE NOT EXISTS (
      SELECT 1
      FROM social_publishing_jobs prev
      WHERE prev.workspace_id = d.workspace_id
        AND prev.connector_id = d.connector_id
        AND prev.provider = d.provider
        AND prev.state = 'PUBLISHED'
        AND prev.submitted_at IS NOT NULL
        AND prev.submitted_at > p_now - make_interval(mins => COALESCE((p_spacing_minutes ->> prev.provider)::integer, 30))
    )
  ),
  ranked AS (
    SELECT
      s.id,
      s.provider,
      s.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY s.workspace_id, s.provider
        ORDER BY s.created_at ASC
      ) AS provider_rank
    FROM spaced s
  ),
  candidates AS (
    SELECT jobs.id
    FROM social_publishing_jobs jobs
    WHERE jobs.id IN (
      SELECT r.id
      FROM ranked r
      WHERE r.provider_rank <= COALESCE((p_slot_caps ->> r.provider)::integer, 3)
    )
    ORDER BY jobs.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE social_publishing_jobs jobs
  SET
    state = 'CLAIMED',
    attempt_count = jobs.attempt_count + 1,
    claim_id = p_claim_id,
    claim_expires_at = p_claim_expires_at,
    claimed_at = p_now,
    updated_at = p_now
  FROM candidates
  WHERE jobs.id = candidates.id
  RETURNING
    jobs.id,
    jobs.workspace_id AS "workspaceId",
    jobs.provider,
    jobs.connector_id AS "connectorId",
    jobs.content_type AS "contentType",
    jobs.content_version_hash AS "contentVersionHash",
    jobs.approved_version_hash AS "approvedVersionHash",
    jobs.approval_id AS "approvalId",
    jobs.compliance_review_id AS "complianceReviewId",
    jobs.compliance_passed AS "compliancePassed",
    jobs.idempotency_key AS "idempotencyKey",
    jobs.payload,
    jobs.local_context AS "localContext",
    jobs.state,
    jobs.attempt_count AS "attemptCount",
    jobs.max_attempts AS "maxAttempts",
    (jobs.next_attempt_at AT TIME ZONE 'UTC') AS "nextAttemptAt",
    jobs.claim_id AS "claimId",
    (jobs.claim_expires_at AT TIME ZONE 'UTC') AS "claimExpiresAt",
    jobs.external_post_id AS "externalPostId",
    jobs.external_post_url AS "externalPostUrl",
    jobs.safe_provider_metadata AS "safeProviderMetadata",
    jobs.last_error_code AS "lastErrorCode",
    jobs.last_error_message AS "lastErrorMessage",
    jobs.requested_by_id AS "requestedById",
    (jobs.scheduled_for AT TIME ZONE 'UTC') AS "scheduledFor",
    (jobs.claimed_at AT TIME ZONE 'UTC') AS "claimedAt",
    (jobs.submitted_at AT TIME ZONE 'UTC') AS "submittedAt",
    (jobs.completed_at AT TIME ZONE 'UTC') AS "completedAt",
    (jobs.created_at AT TIME ZONE 'UTC') AS "createdAt",
    (jobs.updated_at AT TIME ZONE 'UTC') AS "updatedAt";
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_claim_jobs(timestamptz, timestamptz, text, timestamptz, integer, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_claim_jobs(timestamptz, timestamptz, text, timestamptz, integer, jsonb, jsonb) TO service_role;

-- gem_social_load_connector_credential: 7 timestamp outputs converted.
CREATE OR REPLACE FUNCTION public.gem_social_load_connector_credential(
  p_workspace_id text,
  p_connector_id text
)
RETURNS TABLE (
  id text,
  "workspaceId" text,
  provider text,
  state text,
  "displayName" text,
  "externalAccountId" text,
  "grantedScopes" text[],
  "safeMetadata" jsonb,
  "lastHealthAt" timestamptz,
  "disabledAt" timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "secretRef" text,
  "credentialExpiresAt" timestamptz,
  "credentialRefreshExpiresAt" timestamptz,
  "credentialRotatedAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    connector.id,
    connector.workspace_id AS "workspaceId",
    connector.provider,
    connector.state,
    connector.display_name AS "displayName",
    connector.external_account_id AS "externalAccountId",
    connector.granted_scopes AS "grantedScopes",
    connector.safe_metadata AS "safeMetadata",
    (connector.last_health_at AT TIME ZONE 'UTC') AS "lastHealthAt",
    (connector.disabled_at AT TIME ZONE 'UTC') AS "disabledAt",
    (connector.created_at AT TIME ZONE 'UTC') AS "createdAt",
    (connector.updated_at AT TIME ZONE 'UTC') AS "updatedAt",
    credential.secret_ref AS "secretRef",
    (credential.expires_at AT TIME ZONE 'UTC') AS "credentialExpiresAt",
    (credential.refresh_expires_at AT TIME ZONE 'UTC') AS "credentialRefreshExpiresAt",
    (credential.rotated_at AT TIME ZONE 'UTC') AS "credentialRotatedAt"
  FROM social_connectors connector
  INNER JOIN social_connector_credentials credential
    ON credential.connector_id = connector.id
   AND credential.reference_type = 'oauth:production'
  WHERE connector.id = p_connector_id
    AND connector.workspace_id = p_workspace_id
    AND connector.disabled_at IS NULL
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_load_connector_credential(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_load_connector_credential(text, text) TO service_role;

-- gem_social_mark_published: 8 timestamp outputs converted.
CREATE OR REPLACE FUNCTION public.gem_social_mark_published(
  p_job_id text,
  p_claim_id text,
  p_external_post_id text,
  p_external_post_url text,
  p_provider_status_code integer,
  p_safe_metadata jsonb,
  p_now timestamptz
)
RETURNS TABLE (
  id text,
  "workspaceId" text,
  provider text,
  "connectorId" text,
  "contentType" text,
  "contentVersionHash" text,
  "approvedVersionHash" text,
  "approvalId" text,
  "complianceReviewId" text,
  "compliancePassed" boolean,
  "idempotencyKey" text,
  payload jsonb,
  "localContext" text,
  state text,
  "attemptCount" integer,
  "maxAttempts" integer,
  "nextAttemptAt" timestamptz,
  "claimId" text,
  "claimExpiresAt" timestamptz,
  "externalPostId" text,
  "externalPostUrl" text,
  "safeProviderMetadata" jsonb,
  "lastErrorCode" text,
  "lastErrorMessage" text,
  "requestedById" text,
  "scheduledFor" timestamptz,
  "claimedAt" timestamptz,
  "submittedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_id text;
  v_attempt_count integer;
  v_claimed_at timestamptz;
BEGIN
  WITH updated AS (
    UPDATE social_publishing_jobs
    SET
      state = 'PUBLISHED',
      external_post_id = p_external_post_id,
      external_post_url = p_external_post_url,
      provider_status_code = p_provider_status_code,
      safe_provider_metadata = p_safe_metadata,
      claim_id = NULL,
      claim_expires_at = NULL,
      submitted_at = p_now,
      completed_at = p_now,
      updated_at = p_now
    WHERE id = p_job_id
      AND claim_id = p_claim_id
      AND state = 'CLAIMED'
    RETURNING id, attempt_count, claimed_at
  )
  SELECT updated.id, updated.attempt_count, updated.claimed_at
  INTO v_id, v_attempt_count, v_claimed_at
  FROM updated;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO social_publishing_attempts (
    id, job_id, attempt_number, outcome, error_code, error_message,
    provider_status_code, safe_metadata, started_at, completed_at
  ) VALUES (
    gen_random_uuid()::text,
    v_id,
    v_attempt_count,
    'PUBLISHED',
    NULL,
    NULL,
    p_provider_status_code,
    p_safe_metadata,
    COALESCE(v_claimed_at, p_now),
    p_now
  )
  ON CONFLICT (job_id, attempt_number) DO NOTHING;

  RETURN QUERY
  SELECT
    jobs.id,
    jobs.workspace_id AS "workspaceId",
    jobs.provider,
    jobs.connector_id AS "connectorId",
    jobs.content_type AS "contentType",
    jobs.content_version_hash AS "contentVersionHash",
    jobs.approved_version_hash AS "approvedVersionHash",
    jobs.approval_id AS "approvalId",
    jobs.compliance_review_id AS "complianceReviewId",
    jobs.compliance_passed AS "compliancePassed",
    jobs.idempotency_key AS "idempotencyKey",
    jobs.payload,
    jobs.local_context AS "localContext",
    jobs.state,
    jobs.attempt_count AS "attemptCount",
    jobs.max_attempts AS "maxAttempts",
    (jobs.next_attempt_at AT TIME ZONE 'UTC') AS "nextAttemptAt",
    jobs.claim_id AS "claimId",
    (jobs.claim_expires_at AT TIME ZONE 'UTC') AS "claimExpiresAt",
    jobs.external_post_id AS "externalPostId",
    jobs.external_post_url AS "externalPostUrl",
    jobs.safe_provider_metadata AS "safeProviderMetadata",
    jobs.last_error_code AS "lastErrorCode",
    jobs.last_error_message AS "lastErrorMessage",
    jobs.requested_by_id AS "requestedById",
    (jobs.scheduled_for AT TIME ZONE 'UTC') AS "scheduledFor",
    (jobs.claimed_at AT TIME ZONE 'UTC') AS "claimedAt",
    (jobs.submitted_at AT TIME ZONE 'UTC') AS "submittedAt",
    (jobs.completed_at AT TIME ZONE 'UTC') AS "completedAt",
    (jobs.created_at AT TIME ZONE 'UTC') AS "createdAt",
    (jobs.updated_at AT TIME ZONE 'UTC') AS "updatedAt"
  FROM social_publishing_jobs jobs
  WHERE jobs.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_mark_published(text, text, text, text, integer, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_mark_published(text, text, text, text, integer, jsonb, timestamptz) TO service_role;

-- gem_social_mark_blocked: 8 timestamp outputs converted.
CREATE OR REPLACE FUNCTION public.gem_social_mark_blocked(
  p_job_id text,
  p_claim_id text,
  p_error_code text,
  p_error_message text,
  p_safe_metadata jsonb,
  p_now timestamptz
)
RETURNS TABLE (
  id text,
  "workspaceId" text,
  provider text,
  "connectorId" text,
  "contentType" text,
  "contentVersionHash" text,
  "approvedVersionHash" text,
  "approvalId" text,
  "complianceReviewId" text,
  "compliancePassed" boolean,
  "idempotencyKey" text,
  payload jsonb,
  "localContext" text,
  state text,
  "attemptCount" integer,
  "maxAttempts" integer,
  "nextAttemptAt" timestamptz,
  "claimId" text,
  "claimExpiresAt" timestamptz,
  "externalPostId" text,
  "externalPostUrl" text,
  "safeProviderMetadata" jsonb,
  "lastErrorCode" text,
  "lastErrorMessage" text,
  "requestedById" text,
  "scheduledFor" timestamptz,
  "claimedAt" timestamptz,
  "submittedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_id text;
  v_attempt_count integer;
  v_claimed_at timestamptz;
BEGIN
  WITH updated AS (
    UPDATE social_publishing_jobs
    SET
      state = 'BLOCKED',
      last_error_code = p_error_code,
      last_error_message = p_error_message,
      safe_provider_metadata = p_safe_metadata,
      claim_id = NULL,
      claim_expires_at = NULL,
      completed_at = p_now,
      updated_at = p_now
    WHERE id = p_job_id
      AND claim_id = p_claim_id
      AND state = 'CLAIMED'
    RETURNING id, attempt_count, claimed_at
  )
  SELECT updated.id, updated.attempt_count, updated.claimed_at
  INTO v_id, v_attempt_count, v_claimed_at
  FROM updated;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO social_publishing_attempts (
    id, job_id, attempt_number, outcome, error_code, error_message,
    provider_status_code, safe_metadata, started_at, completed_at
  ) VALUES (
    gen_random_uuid()::text,
    v_id,
    v_attempt_count,
    'BLOCKED',
    p_error_code,
    p_error_message,
    NULL,
    p_safe_metadata,
    COALESCE(v_claimed_at, p_now),
    p_now
  )
  ON CONFLICT (job_id, attempt_number) DO NOTHING;

  RETURN QUERY
  SELECT
    jobs.id,
    jobs.workspace_id AS "workspaceId",
    jobs.provider,
    jobs.connector_id AS "connectorId",
    jobs.content_type AS "contentType",
    jobs.content_version_hash AS "contentVersionHash",
    jobs.approved_version_hash AS "approvedVersionHash",
    jobs.approval_id AS "approvalId",
    jobs.compliance_review_id AS "complianceReviewId",
    jobs.compliance_passed AS "compliancePassed",
    jobs.idempotency_key AS "idempotencyKey",
    jobs.payload,
    jobs.local_context AS "localContext",
    jobs.state,
    jobs.attempt_count AS "attemptCount",
    jobs.max_attempts AS "maxAttempts",
    (jobs.next_attempt_at AT TIME ZONE 'UTC') AS "nextAttemptAt",
    jobs.claim_id AS "claimId",
    (jobs.claim_expires_at AT TIME ZONE 'UTC') AS "claimExpiresAt",
    jobs.external_post_id AS "externalPostId",
    jobs.external_post_url AS "externalPostUrl",
    jobs.safe_provider_metadata AS "safeProviderMetadata",
    jobs.last_error_code AS "lastErrorCode",
    jobs.last_error_message AS "lastErrorMessage",
    jobs.requested_by_id AS "requestedById",
    (jobs.scheduled_for AT TIME ZONE 'UTC') AS "scheduledFor",
    (jobs.claimed_at AT TIME ZONE 'UTC') AS "claimedAt",
    (jobs.submitted_at AT TIME ZONE 'UTC') AS "submittedAt",
    (jobs.completed_at AT TIME ZONE 'UTC') AS "completedAt",
    (jobs.created_at AT TIME ZONE 'UTC') AS "createdAt",
    (jobs.updated_at AT TIME ZONE 'UTC') AS "updatedAt"
  FROM social_publishing_jobs jobs
  WHERE jobs.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_mark_blocked(text, text, text, text, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_mark_blocked(text, text, text, text, jsonb, timestamptz) TO service_role;

-- gem_social_mark_failed: 8 timestamp outputs converted.
CREATE OR REPLACE FUNCTION public.gem_social_mark_failed(
  p_job_id text,
  p_claim_id text,
  p_state text,
  p_next_attempt_at timestamptz,
  p_completed_at timestamptz,
  p_error_code text,
  p_error_message text,
  p_provider_status_code integer,
  p_safe_metadata jsonb,
  p_outcome text,
  p_now timestamptz
)
RETURNS TABLE (
  id text,
  "workspaceId" text,
  provider text,
  "connectorId" text,
  "contentType" text,
  "contentVersionHash" text,
  "approvedVersionHash" text,
  "approvalId" text,
  "complianceReviewId" text,
  "compliancePassed" boolean,
  "idempotencyKey" text,
  payload jsonb,
  "localContext" text,
  state text,
  "attemptCount" integer,
  "maxAttempts" integer,
  "nextAttemptAt" timestamptz,
  "claimId" text,
  "claimExpiresAt" timestamptz,
  "externalPostId" text,
  "externalPostUrl" text,
  "safeProviderMetadata" jsonb,
  "lastErrorCode" text,
  "lastErrorMessage" text,
  "requestedById" text,
  "scheduledFor" timestamptz,
  "claimedAt" timestamptz,
  "submittedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_id text;
  v_attempt_count integer;
  v_claimed_at timestamptz;
BEGIN
  WITH updated AS (
    UPDATE social_publishing_jobs
    SET
      state = p_state,
      next_attempt_at = p_next_attempt_at,
      provider_status_code = p_provider_status_code,
      safe_provider_metadata = p_safe_metadata,
      last_error_code = p_error_code,
      last_error_message = p_error_message,
      claim_id = NULL,
      claim_expires_at = NULL,
      completed_at = p_completed_at,
      updated_at = p_now
    WHERE id = p_job_id
      AND claim_id = p_claim_id
      AND state = 'CLAIMED'
    RETURNING id, attempt_count, claimed_at
  )
  SELECT updated.id, updated.attempt_count, updated.claimed_at
  INTO v_id, v_attempt_count, v_claimed_at
  FROM updated;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO social_publishing_attempts (
    id, job_id, attempt_number, outcome, error_code, error_message,
    provider_status_code, safe_metadata, started_at, completed_at
  ) VALUES (
    gen_random_uuid()::text,
    v_id,
    v_attempt_count,
    p_outcome,
    p_error_code,
    p_error_message,
    p_provider_status_code,
    p_safe_metadata,
    COALESCE(v_claimed_at, p_now),
    p_now
  )
  ON CONFLICT (job_id, attempt_number) DO NOTHING;

  RETURN QUERY
  SELECT
    jobs.id,
    jobs.workspace_id AS "workspaceId",
    jobs.provider,
    jobs.connector_id AS "connectorId",
    jobs.content_type AS "contentType",
    jobs.content_version_hash AS "contentVersionHash",
    jobs.approved_version_hash AS "approvedVersionHash",
    jobs.approval_id AS "approvalId",
    jobs.compliance_review_id AS "complianceReviewId",
    jobs.compliance_passed AS "compliancePassed",
    jobs.idempotency_key AS "idempotencyKey",
    jobs.payload,
    jobs.local_context AS "localContext",
    jobs.state,
    jobs.attempt_count AS "attemptCount",
    jobs.max_attempts AS "maxAttempts",
    (jobs.next_attempt_at AT TIME ZONE 'UTC') AS "nextAttemptAt",
    jobs.claim_id AS "claimId",
    (jobs.claim_expires_at AT TIME ZONE 'UTC') AS "claimExpiresAt",
    jobs.external_post_id AS "externalPostId",
    jobs.external_post_url AS "externalPostUrl",
    jobs.safe_provider_metadata AS "safeProviderMetadata",
    jobs.last_error_code AS "lastErrorCode",
    jobs.last_error_message AS "lastErrorMessage",
    jobs.requested_by_id AS "requestedById",
    (jobs.scheduled_for AT TIME ZONE 'UTC') AS "scheduledFor",
    (jobs.claimed_at AT TIME ZONE 'UTC') AS "claimedAt",
    (jobs.submitted_at AT TIME ZONE 'UTC') AS "submittedAt",
    (jobs.completed_at AT TIME ZONE 'UTC') AS "completedAt",
    (jobs.created_at AT TIME ZONE 'UTC') AS "createdAt",
    (jobs.updated_at AT TIME ZONE 'UTC') AS "updatedAt"
  FROM social_publishing_jobs jobs
  WHERE jobs.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_mark_failed(text, text, text, timestamptz, timestamptz, text, text, integer, jsonb, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_mark_failed(text, text, text, timestamptz, timestamptz, text, text, integer, jsonb, text, timestamptz) TO service_role;

-- gem_social_list_jobs: 8 timestamp outputs converted.
CREATE OR REPLACE FUNCTION public.gem_social_list_jobs(
  p_workspace_id text,
  p_limit integer
)
RETURNS TABLE (
  id text,
  "workspaceId" text,
  provider text,
  "connectorId" text,
  "contentType" text,
  "contentVersionHash" text,
  "approvedVersionHash" text,
  "approvalId" text,
  "complianceReviewId" text,
  "compliancePassed" boolean,
  "idempotencyKey" text,
  payload jsonb,
  "localContext" text,
  state text,
  "attemptCount" integer,
  "maxAttempts" integer,
  "nextAttemptAt" timestamptz,
  "claimId" text,
  "claimExpiresAt" timestamptz,
  "externalPostId" text,
  "externalPostUrl" text,
  "safeProviderMetadata" jsonb,
  "lastErrorCode" text,
  "lastErrorMessage" text,
  "requestedById" text,
  "scheduledFor" timestamptz,
  "claimedAt" timestamptz,
  "submittedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    jobs.id,
    jobs.workspace_id AS "workspaceId",
    jobs.provider,
    jobs.connector_id AS "connectorId",
    jobs.content_type AS "contentType",
    jobs.content_version_hash AS "contentVersionHash",
    jobs.approved_version_hash AS "approvedVersionHash",
    jobs.approval_id AS "approvalId",
    jobs.compliance_review_id AS "complianceReviewId",
    jobs.compliance_passed AS "compliancePassed",
    jobs.idempotency_key AS "idempotencyKey",
    jobs.payload,
    jobs.local_context AS "localContext",
    jobs.state,
    jobs.attempt_count AS "attemptCount",
    jobs.max_attempts AS "maxAttempts",
    (jobs.next_attempt_at AT TIME ZONE 'UTC') AS "nextAttemptAt",
    jobs.claim_id AS "claimId",
    (jobs.claim_expires_at AT TIME ZONE 'UTC') AS "claimExpiresAt",
    jobs.external_post_id AS "externalPostId",
    jobs.external_post_url AS "externalPostUrl",
    jobs.safe_provider_metadata AS "safeProviderMetadata",
    jobs.last_error_code AS "lastErrorCode",
    jobs.last_error_message AS "lastErrorMessage",
    jobs.requested_by_id AS "requestedById",
    (jobs.scheduled_for AT TIME ZONE 'UTC') AS "scheduledFor",
    (jobs.claimed_at AT TIME ZONE 'UTC') AS "claimedAt",
    (jobs.submitted_at AT TIME ZONE 'UTC') AS "submittedAt",
    (jobs.completed_at AT TIME ZONE 'UTC') AS "completedAt",
    (jobs.created_at AT TIME ZONE 'UTC') AS "createdAt",
    (jobs.updated_at AT TIME ZONE 'UTC') AS "updatedAt"
  FROM social_publishing_jobs jobs
  WHERE jobs.workspace_id = p_workspace_id
  ORDER BY jobs.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_list_jobs(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_list_jobs(text, integer) TO service_role;
