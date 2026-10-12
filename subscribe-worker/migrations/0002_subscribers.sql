-- The mailing list, kept here so emails can be collected before there's a
-- sending account (see EMAIL_SENDING_ENABLED in wrangler.toml). One row
-- per address; opting out flips opted_in rather than deleting, so the
-- list remembers who said no.
CREATE TABLE subscribers (
  email TEXT PRIMARY KEY,
  opted_in INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
