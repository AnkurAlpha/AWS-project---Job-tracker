CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  resume TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed jobs (only if empty)
INSERT INTO jobs (title, description)
SELECT 'Frontend Intern', 'React + APIs'
WHERE NOT EXISTS (SELECT 1 FROM jobs);

INSERT INTO jobs (title, description)
SELECT 'Backend Intern', 'Node + PostgreSQL'
WHERE (SELECT COUNT(*) FROM jobs) = 1;
