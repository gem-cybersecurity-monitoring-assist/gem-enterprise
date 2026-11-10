-- OP-16 — Create connector (phase 1). The connectors API has no creation
-- endpoint, so connector creation goes through this RPC, called by the
-- Next.js admin route via the gem-social-publishing-gateway edge function.
--
-- The connector row and its credential row are inserted in one transaction.
-- The bot token arrives already encrypted (encryption happens in Node, via
-- encryptSocialCredential; the RPC only ever sees the secretRef ciphertext).
-- The credential row uses reference_type 'oauth:production' because that is
-- the reference type the existing credential-load path filters on
-- (oauth/lifecycle-store.ts and gem_social_load_connector_credential); a
-- bot-token-specific reference type would make the worker unable to load
-- the Telegram token.
--
-- Idempotency: the (workspace_id, provider, external_account_key) triple
-- is the connector's identity (the unique constraint
-- persistSocialConnector relies on). A matching row — even a disconnected
-- one — is reactivated with the new credential, mirroring the ON CONFLICT
-- upsert in persistSocialConnector. A concurrent create under the same
-- identity raises unique_violation; the handler re-reads and applies the
-- same same-request-or-409 rule as gem_social_create_job. The 409 branch
-- is defensive: the lookup key is the unique key, so a re-read after a
-- unique violation always matches the request.
--
-- Business errors are returned as JSON envelopes ({ ok: false, code,
-- message }) instead of RAISE, so the edge function maps them to the same
-- HTTP status and TokMetricError code the Prisma path produces.
--
-- This RPC is counted by gem_social_health, so the live probe inventory
-- grows from 13 to 14 once this migration is applied. The client constant
-- EXPECTED_SOCIAL_PUBLISHING_GATEWAY_RPC_COUNT is 14.

CREATE OR REPLACE FUNCTION public.gem_social_create_connector(
  p_workspace_id text,
  p_provider text,
  p_display_name text,
  p_external_account_key text,
  p_external_account_id text,
  p_granted_scopes text[],
  p_safe_metadata jsonb,
  p_secret_ref text,
  p_now timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_connector jsonb;
  v_id text;
BEGIN
  SELECT row_to_json(c)
  INTO v_connector
  FROM (
    SELECT
      connectors.id,
      connectors.workspace_id AS "workspaceId",
      connectors.provider,
      connectors.state,
      connectors.display_name AS "displayName",
      connectors.external_account_id AS "externalAccountId",
      connectors.granted_scopes AS "grantedScopes",
      connectors.safe_metadata AS "safeMetadata",
      connectors.last_health_at AS "lastHealthAt",
      connectors.disabled_at AS "disabledAt",
      connectors.created_at AS "createdAt",
      connectors.updated_at AS "updatedAt"
    FROM social_connectors connectors
    WHERE connectors.workspace_id = p_workspace_id
      AND connectors.provider = p_provider
      AND connectors.external_account_key = p_external_account_key
    LIMIT 1
  ) c;

  IF v_connector IS NOT NULL THEN
    WITH updated AS (
      UPDATE social_connectors
      SET
        state = 'CONNECTED',
        display_name = p_display_name,
        external_account_id = p_external_account_id,
        granted_scopes = p_granted_scopes,
        safe_metadata = p_safe_metadata,
        disabled_at = NULL,
        last_health_at = p_now,
        updated_at = p_now
      WHERE id = v_connector ->> 'id'
      RETURNING
        id,
        workspace_id AS "workspaceId",
        provider,
        state,
        display_name AS "displayName",
        external_account_id AS "externalAccountId",
        granted_scopes AS "grantedScopes",
        safe_metadata AS "safeMetadata",
        last_health_at AS "lastHealthAt",
        disabled_at AS "disabledAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    )
    SELECT row_to_json(updated)
    INTO v_connector
    FROM updated;

    INSERT INTO social_connector_credentials (
      id,
      connector_id,
      reference_type,
      secret_ref,
      expires_at,
      refresh_expires_at,
      rotated_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid()::text,
      v_connector ->> 'id',
      'oauth:production',
      p_secret_ref,
      NULL,
      NULL,
      p_now,
      p_now,
      p_now
    )
    ON CONFLICT (connector_id, reference_type)
    DO UPDATE SET
      secret_ref = EXCLUDED.secret_ref,
      rotated_at = EXCLUDED.rotated_at,
      updated_at = EXCLUDED.updated_at;

    RETURN jsonb_build_object('ok', true, 'connector', v_connector);
  END IF;

  v_id := gen_random_uuid()::text;

  BEGIN
    WITH inserted AS (
      INSERT INTO social_connectors (
        id,
        workspace_id,
        provider,
        state,
        display_name,
        external_account_key,
        external_account_id,
        granted_scopes,
        safe_metadata,
        last_health_at,
        created_at,
        updated_at
      ) VALUES (
        v_id,
        p_workspace_id,
        p_provider,
        'CONNECTED',
        p_display_name,
        p_external_account_key,
        p_external_account_id,
        p_granted_scopes,
        p_safe_metadata,
        p_now,
        p_now,
        p_now
      )
      RETURNING
        id,
        workspace_id AS "workspaceId",
        provider,
        state,
        display_name AS "displayName",
        external_account_id AS "externalAccountId",
        granted_scopes AS "grantedScopes",
        safe_metadata AS "safeMetadata",
        last_health_at AS "lastHealthAt",
        disabled_at AS "disabledAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    )
    SELECT row_to_json(inserted)
    INTO v_connector
    FROM inserted;

    INSERT INTO social_connector_credentials (
      id,
      connector_id,
      reference_type,
      secret_ref,
      expires_at,
      refresh_expires_at,
      rotated_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid()::text,
      v_id,
      'oauth:production',
      p_secret_ref,
      NULL,
      NULL,
      p_now,
      p_now,
      p_now
    )
    ON CONFLICT (connector_id, reference_type)
    DO UPDATE SET
      secret_ref = EXCLUDED.secret_ref,
      rotated_at = EXCLUDED.rotated_at,
      updated_at = EXCLUDED.updated_at;
  EXCEPTION WHEN unique_violation THEN
    -- A concurrent create won the race under the same identity.
    -- Re-read and apply the same same-request-or-409 rule.
    SELECT row_to_json(c)
    INTO v_connector
    FROM (
      SELECT
        connectors.id,
        connectors.workspace_id AS "workspaceId",
        connectors.provider,
        connectors.state,
        connectors.display_name AS "displayName",
        connectors.external_account_id AS "externalAccountId",
        connectors.granted_scopes AS "grantedScopes",
        connectors.safe_metadata AS "safeMetadata",
        connectors.last_health_at AS "lastHealthAt",
        connectors.disabled_at AS "disabledAt",
        connectors.created_at AS "createdAt",
        connectors.updated_at AS "updatedAt"
      FROM social_connectors connectors
      WHERE connectors.workspace_id = p_workspace_id
        AND connectors.provider = p_provider
        AND connectors.external_account_key = p_external_account_key
      LIMIT 1
    ) c;

    IF v_connector IS NOT NULL THEN
      WITH updated AS (
        UPDATE social_connectors
        SET
          state = 'CONNECTED',
          display_name = p_display_name,
          external_account_id = p_external_account_id,
          granted_scopes = p_granted_scopes,
          safe_metadata = p_safe_metadata,
          disabled_at = NULL,
          last_health_at = p_now,
          updated_at = p_now
        WHERE id = v_connector ->> 'id'
        RETURNING
          id,
          workspace_id AS "workspaceId",
          provider,
          state,
          display_name AS "displayName",
          external_account_id AS "externalAccountId",
          granted_scopes AS "grantedScopes",
          safe_metadata AS "safeMetadata",
          last_health_at AS "lastHealthAt",
          disabled_at AS "disabledAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      )
      SELECT row_to_json(updated)
      INTO v_connector
      FROM updated;

      INSERT INTO social_connector_credentials (
        id,
        connector_id,
        reference_type,
        secret_ref,
        expires_at,
        refresh_expires_at,
        rotated_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid()::text,
        v_connector ->> 'id',
        'oauth:production',
        p_secret_ref,
        NULL,
        NULL,
        p_now,
        p_now,
        p_now
      )
      ON CONFLICT (connector_id, reference_type)
      DO UPDATE SET
        secret_ref = EXCLUDED.secret_ref,
        rotated_at = EXCLUDED.rotated_at,
        updated_at = EXCLUDED.updated_at;

      RETURN jsonb_build_object('ok', true, 'connector', v_connector);
    END IF;
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT',
      'message', 'A different connector already uses this provider account in this workspace.'
    );
  END;

  IF v_connector IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'SOCIAL_CONNECTOR_CREATE_FAILED',
      'message', 'The social connector was not created.'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'connector', v_connector);
END;
$$;

REVOKE ALL ON FUNCTION public.gem_social_create_connector(text, text, text, text, text, text[], jsonb, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gem_social_create_connector(text, text, text, text, text, text[], jsonb, text, timestamptz) TO service_role;
