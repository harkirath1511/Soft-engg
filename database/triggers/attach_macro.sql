-- attach_macro.sql: Dynamic trigger attachment and detachment helpers
CREATE OR REPLACE PROCEDURE replaydb.attach_capture_trigger(target_table_name TEXT, target_schema_name TEXT DEFAULT 'public')
LANGUAGE plpgsql AS $$
DECLARE
    trigger_name TEXT := 'trg_replaydb_' || target_table_name;
    full_table_name TEXT := quote_ident(target_schema_name) || '.' || quote_ident(target_table_name);
BEGIN
    -- Drop existing trigger if any
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trigger_name) || ' ON ' || full_table_name;

    -- Attach AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW trigger
    EXECUTE 'CREATE TRIGGER ' || quote_ident(trigger_name) ||
            ' AFTER INSERT OR UPDATE OR DELETE ON ' || full_table_name ||
            ' FOR EACH ROW EXECUTE FUNCTION replaydb.capture_row_mutation()';

    RAISE NOTICE 'ReplayDB capture trigger successfully attached to %', full_table_name;
END;
$$;

CREATE OR REPLACE PROCEDURE replaydb.detach_capture_trigger(target_table_name TEXT, target_schema_name TEXT DEFAULT 'public')
LANGUAGE plpgsql AS $$
DECLARE
    trigger_name TEXT := 'trg_replaydb_' || target_table_name;
    full_table_name TEXT := quote_ident(target_schema_name) || '.' || quote_ident(target_table_name);
BEGIN
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trigger_name) || ' ON ' || full_table_name;
    RAISE NOTICE 'ReplayDB capture trigger successfully detached from %', full_table_name;
END;
$$;
