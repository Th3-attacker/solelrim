-- Kept alone in its own migration: Postgres refuses to use a newly added
-- enum value in the same transaction that adds it, and the CHECK constraint
-- in the next migration references 'SELLER'.
ALTER TYPE "AdminRole" ADD VALUE 'SELLER';
