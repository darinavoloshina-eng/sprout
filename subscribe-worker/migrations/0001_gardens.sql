-- One row per garden that has opted into the weekly reminder email.
-- Turning the email off in the app deletes the row, so this only ever
-- holds gardens whose owners currently want the email.
CREATE TABLE gardens (
  id TEXT PRIMARY KEY,
  -- SHA-256 of the write token the app holds. The token itself is never
  -- stored, so a leaked copy of this table can't be used to edit gardens.
  token_hash TEXT NOT NULL UNIQUE,
  -- Goes in every email's links. Separate from the write token because
  -- emails get forwarded: this one can only confirm or unsubscribe.
  link_token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  timezone TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  -- Null until the address owner clicks the confirmation link. Nothing but
  -- the confirmation email is ever sent to an unconfirmed address.
  confirmed_at TEXT,
  confirm_sent_at TEXT,
  unsubscribed_at TEXT,
  -- The local date (YYYY-MM-DD) of the Sunday the last digest went out for,
  -- so an hourly cron sends at most one per week.
  last_digest_week TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX gardens_email ON gardens (email);
