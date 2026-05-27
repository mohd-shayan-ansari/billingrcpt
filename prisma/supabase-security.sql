-- Harden the Supabase database for the billing app.
-- This enables Row-Level Security on the application tables and removes
-- direct table privileges from the public API roles used by Supabase.

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Rate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WinnerDeduction" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public."User", public."Rate", public."Receipt", public."WinnerDeduction" FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END
$$;

REVOKE ALL ON TABLE public."User", public."Rate", public."Receipt", public."WinnerDeduction" FROM PUBLIC;