create table if not exists public.debt_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  side text not null check (side in ('I_OWE', 'THEY_OWE')),
  created_at timestamptz not null default now()
);

create table if not exists public.debt_transactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.debt_contacts(id) on delete cascade,
  type text not null check (type in ('DEBT', 'PAYMENT')),
  amount numeric(14, 0) not null check (amount > 0),
  note text,
  happened_at date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.debt_contacts enable row level security;
alter table public.debt_transactions enable row level security;

create policy "Users can read own contacts"
on public.debt_contacts for select
using (auth.uid() = user_id);

create policy "Users can insert own contacts"
on public.debt_contacts for insert
with check (auth.uid() = user_id);

create policy "Users can update own contacts"
on public.debt_contacts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own contacts"
on public.debt_contacts for delete
using (auth.uid() = user_id);

create policy "Users can read own transactions"
on public.debt_transactions for select
using (
  exists (
    select 1 from public.debt_contacts
    where debt_contacts.id = debt_transactions.contact_id
    and debt_contacts.user_id = auth.uid()
  )
);

create policy "Users can insert own transactions"
on public.debt_transactions for insert
with check (
  exists (
    select 1 from public.debt_contacts
    where debt_contacts.id = debt_transactions.contact_id
    and debt_contacts.user_id = auth.uid()
  )
);

create policy "Users can update own transactions"
on public.debt_transactions for update
using (
  exists (
    select 1 from public.debt_contacts
    where debt_contacts.id = debt_transactions.contact_id
    and debt_contacts.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.debt_contacts
    where debt_contacts.id = debt_transactions.contact_id
    and debt_contacts.user_id = auth.uid()
  )
);

create policy "Users can delete own transactions"
on public.debt_transactions for delete
using (
  exists (
    select 1 from public.debt_contacts
    where debt_contacts.id = debt_transactions.contact_id
    and debt_contacts.user_id = auth.uid()
  )
);

create index if not exists debt_contacts_user_side_idx on public.debt_contacts(user_id, side);
create index if not exists debt_transactions_contact_date_idx on public.debt_transactions(contact_id, happened_at desc);
