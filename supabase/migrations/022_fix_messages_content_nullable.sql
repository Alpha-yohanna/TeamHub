-- Found via live testing: soft-deleting a message sets content = null, but content was still
-- NOT NULL from migration 006 (before edit/delete existed). Allow null so soft-delete works.
alter table public.messages alter column content drop not null;
