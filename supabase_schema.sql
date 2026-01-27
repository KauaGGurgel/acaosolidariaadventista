-- RODE ESTE SCRIPT NO "SQL EDITOR" DO SEU PAINEL SUPABASE

-- ==============================================================================
-- 1. LIMPEZA (Cuidado: Isso apaga dados existentes se você rodar novamente)
-- ==============================================================================

-- Remove tabelas com nomes novos (para reset)
DROP TABLE IF EXISTS public.beneficiarios;
DROP TABLE IF EXISTS public.estoque;
DROP TABLE IF EXISTS public.eventos_entrega;
DROP TABLE IF EXISTS public.configuracoes;

-- ==============================================================================
-- 2. CRIAÇÃO DAS TABELAS
-- ==============================================================================

-- Tabela de Beneficiários
create table public.beneficiarios (
  "id" text primary key,
  "name" text not null,
  "familySize" integer default 1,
  "address" text,
  "phone" text,
  "lastBasketDate" text,
  "notes" text,
  "history" jsonb default '[]'::jsonb,
  "created_at" timestamp with time zone default timezone('utc'::text, now())
);

-- Tabela de Estoque
create table public.estoque (
  "id" text primary key,
  "name" text not null,
  "quantity" numeric default 0,
  "unit" text not null,
  "category" text not null,
  "minThreshold" numeric default 10,
  "created_at" timestamp with time zone default timezone('utc'::text, now())
);

-- Tabela de Eventos
create table public.eventos_entrega (
  "id" text primary key,
  "title" text not null,
  "date" text not null,
  "description" text,
  "created_at" timestamp with time zone default timezone('utc'::text, now())
);

-- Tabela de Configurações
create table public.configuracoes (
  "key" text primary key,
  "value" jsonb not null,
  "updated_at" timestamp with time zone default timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. SEGURANÇA (RLS)
-- ==============================================================================
alter table public.beneficiarios enable row level security;
alter table public.estoque enable row level security;
alter table public.eventos_entrega enable row level security;
alter table public.configuracoes enable row level security;

-- Políticas públicas (Permitir tudo para testes/protótipo)
create policy "Permitir acesso total" on public.beneficiarios for all using (true);
create policy "Permitir acesso total" on public.estoque for all using (true);
create policy "Permitir acesso total" on public.eventos_entrega for all using (true);
create policy "Permitir acesso total" on public.configuracoes for all using (true);