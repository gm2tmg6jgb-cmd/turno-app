-- Migration to create the pianificazione table
create table if not exists pianificazione (
  id uuid primary key default gen_random_uuid(),
  dipendente_id text references dipendenti(id) on delete cascade,
  data date not null,
  turno_id text,
  motivo_assenza text references motivi_assenza(id),
  note text,
  created_at timestamptz default now(),
  unique(dipendente_id, data)
);

-- Enable RLS
alter table pianificazione enable row level security;

-- Policy (for now assuming open access for authenticated as per common patterns in this repo)
create policy "Public Access" on pianificazione for all using (true);
