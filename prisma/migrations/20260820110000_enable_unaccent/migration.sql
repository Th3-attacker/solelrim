-- Powers accent-insensitive product search directly in the database (see
-- lib/queries/shop.ts: searchActiveProducts), so search no longer needs to
-- ship the whole catalog to the client and re-filter it in JS. Installed
-- into the "extensions" schema, Supabase's convention for contrib
-- extensions — that schema is already on every role's search_path here, so
-- unaccent(...) resolves unqualified in application queries.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
