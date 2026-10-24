-- statement
CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
-- statement
CREATE TABLE IF NOT EXISTS enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key uuid NOT NULL UNIQUE,
  payload_hash text NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  venue text NOT NULL CHECK (length(venue) BETWEEN 2 AND 200),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  phone text NOT NULL CHECK (length(phone) BETWEEN 7 AND 30),
  message text NOT NULL CHECK (length(message) BETWEEN 10 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- statement
CREATE INDEX IF NOT EXISTS enquiries_created_at_idx ON enquiries (created_at DESC);
-- statement
CREATE TABLE IF NOT EXISTS submission_limits (
  ip_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  submissions integer NOT NULL CHECK (submissions > 0),
  PRIMARY KEY (ip_hash, window_start)
);
-- statement
CREATE INDEX IF NOT EXISTS submission_limits_window_idx ON submission_limits (window_start);
-- statement
CREATE OR REPLACE FUNCTION submit_enquiry(
  p_key uuid, p_hash text, p_ip text, p_name text, p_venue text,
  p_email text, p_phone text, p_message text
) RETURNS TABLE (enquiry_id uuid, received_at timestamptz, is_duplicate boolean)
LANGUAGE plpgsql AS $$
DECLARE existing enquiries%ROWTYPE; bucket timestamptz := date_trunc('hour', now()); n integer;
BEGIN
  -- Serialize retries, including requests arriving on different function instances.
  PERFORM pg_advisory_xact_lock(hashtextextended('request:' || p_key::text, 0));
  SELECT * INTO existing FROM enquiries WHERE request_key = p_key;
  IF FOUND THEN
    IF existing.payload_hash <> p_hash THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN QUERY SELECT existing.id, existing.created_at, true;
    RETURN;
  END IF;
  INSERT INTO submission_limits (ip_hash, window_start, submissions) VALUES (p_ip, bucket, 1)
    ON CONFLICT (ip_hash, window_start) DO UPDATE SET submissions = submission_limits.submissions + 1
    RETURNING submissions INTO n;
  IF n > 5 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  INSERT INTO enquiries (request_key, payload_hash, name, venue, email, phone, message)
    VALUES (p_key, p_hash, p_name, p_venue, p_email, p_phone, p_message)
    RETURNING * INTO existing;
  DELETE FROM submission_limits WHERE window_start < now() - interval '2 days';
  RETURN QUERY SELECT existing.id, existing.created_at, false;
END;
$$;
-- statement
INSERT INTO schema_migrations (version) VALUES (1) ON CONFLICT DO NOTHING;
