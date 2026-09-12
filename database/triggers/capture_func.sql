-- capture_func.sql: Generic PL/pgSQL function capturing INSERT, UPDATE, and DELETE operations
CREATE OR REPLACE FUNCTION replaydb.capture_row_mutation()
RETURNS TRIGGER AS $$
DECLARE
    v_old JSONB := NULL;
    v_new JSONB := NULL;
    v_pk_val TEXT := NULL;
    v_diff JSONB := NULL;
    v_tx_id BIGINT;
BEGIN
    -- Derive transaction ID
    SELECT pg_current_xact_id()::BIGINT INTO v_tx_id;

    IF (TG_OP = 'DELETE') THEN
        v_old := to_jsonb(OLD);
        -- Extract primary key (default to 'id' column if present)
        IF (v_old ? 'id') THEN
            v_pk_val := (v_old->>'id');
        ELSE
            -- Fallback to all keys JSON or first value
            v_pk_val := (SELECT value FROM jsonb_each_text(v_old) LIMIT 1);
        END IF;

    ELSIF (TG_OP = 'INSERT') THEN
        v_new := to_jsonb(NEW);
        IF (v_new ? 'id') THEN
            v_pk_val := (v_new->>'id');
        ELSE
            v_pk_val := (SELECT value FROM jsonb_each_text(v_new) LIMIT 1);
        END IF;

    ELSIF (TG_OP = 'UPDATE') THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        IF (v_new ? 'id') THEN
            v_pk_val := (v_new->>'id');
        ELSE
            v_pk_val := (SELECT value FROM jsonb_each_text(v_new) LIMIT 1);
        END IF;

        -- Compute field-level delta
        SELECT COALESCE(jsonb_object_agg(n.key, n.value), '{}'::jsonb) INTO v_diff
        FROM jsonb_each(v_new) n
        WHERE n.value IS DISTINCT FROM v_old->n.key;
    END IF;

    INSERT INTO replaydb.replay_events (
        table_schema,
        table_name,
        record_pk,
        operation_type,
        old_state,
        new_state,
        diff_state,
        transaction_id,
        recorded_at,
        db_user,
        client_query
    ) VALUES (
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        COALESCE(v_pk_val, 'unknown'),
        TG_OP,
        v_old,
        v_new,
        v_diff,
        v_tx_id,
        clock_timestamp(),
        SESSION_USER,
        current_query()
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
