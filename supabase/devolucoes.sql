-- =====================================================================
--  Devoluções (28/10/2026): aba "Devoluções" do Argos, começando pelo BK004.
--  Cada solicitação: período, valor e o arquivo do BK; etapas: aprovação Qi Tech
--  (check manual do admin) e liquidação (automática, pela saída no extrato).
--  Por enquanto SÓ O ADMIN lê e mexe. O arquivo fica no Storage em
--  restrito/devolucoes/... (pasta restrita: só quem tem o relatório "devolucoes"
--  liberado em relatorio_acesso, hoje só o admin).
--  Cole isto no "SQL Editor" do Supabase e clique em "Run" (uma vez só).
--  Precisa do relatorios-restritos.sql e do relatorios-baixas.sql já rodados.
-- =====================================================================

create table if not exists public.devolucoes (
  id              uuid primary key default gen_random_uuid(),
  relatorio       text not null default 'bk004',
  inicio          date not null,
  fim             date not null check (fim >= inicio),
  valor           numeric(16,2) not null check (valor > 0),
  arquivo_nome    text,
  arquivo_caminho text,
  criada_em       timestamptz not null default now(),
  criada_por      uuid default auth.uid(),
  aprovada_em     timestamptz,
  liquidada_em    timestamptz,
  liquidacao      jsonb,            -- saída do extrato que liquidou (data, hora, descrição, valor)
  email_em        timestamptz       -- quando o e-mail de aviso saiu
);
-- sem políticas: o site só usa as funções abaixo; o publicador usa a chave secreta
alter table public.devolucoes enable row level security;
revoke all on public.devolucoes from public, anon, authenticated;

create or replace function public.vox_devolucoes(p_relatorio text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._admin_ok() then raise exception 'VOX_SEM_ACESSO' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(d) - 'criada_por' order by d.inicio desc, d.criada_em desc)
                   from public.devolucoes d where d.relatorio = p_relatorio), '[]'::jsonb);
end $$;

create or replace function public.vox_devolucao_criar(p_relatorio text, p_inicio date, p_fim date, p_valor numeric,
  p_arquivo_nome text, p_arquivo_caminho text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._admin_ok() then raise exception 'VOX_SEM_ACESSO' using errcode = '42501'; end if;
  if p_fim < p_inicio then raise exception 'VOX_DADOS: A data final é antes da inicial.'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'VOX_DADOS: Informe o valor.'; end if;
  insert into public.devolucoes (relatorio, inicio, fim, valor, arquivo_nome, arquivo_caminho)
  values (p_relatorio, p_inicio, p_fim, round(p_valor, 2), p_arquivo_nome, p_arquivo_caminho) returning id into v_id;
  return v_id;
end $$;

-- 'aprovar' (etapa 1), 'desaprovar' (desfaz o check) e 'excluir' (só se ainda não liquidou)
create or replace function public.vox_devolucao_acao(p_id uuid, p_acao text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._admin_ok() then raise exception 'VOX_SEM_ACESSO' using errcode = '42501'; end if;
  if p_acao = 'aprovar' then
    update public.devolucoes set aprovada_em = coalesce(aprovada_em, now()) where id = p_id;
  elsif p_acao = 'desaprovar' then
    update public.devolucoes set aprovada_em = null where id = p_id and liquidada_em is null;
  elsif p_acao = 'excluir' then
    delete from public.devolucoes where id = p_id and liquidada_em is null;
  else
    raise exception 'VOX_DADOS: Ação inválida.';
  end if;
end $$;

revoke execute on function public.vox_devolucoes(text), public.vox_devolucao_criar(text, date, date, numeric, text, text),
  public.vox_devolucao_acao(uuid, text) from public, anon;
grant execute on function public.vox_devolucoes(text), public.vox_devolucao_criar(text, date, date, numeric, text, text),
  public.vox_devolucao_acao(uuid, text) to authenticated;

-- Upload do arquivo do BK pelo site: só o admin, só em restrito/devolucoes/
drop policy if exists "vox devolucoes envio" on storage.objects;
create policy "vox devolucoes envio" on storage.objects for insert to authenticated
  with check (bucket_id = 'caixa' and name like 'restrito/devolucoes/%' and public._admin_ok());

select 'Pronto! Devoluções (BK004) criadas: só o admin vê e mexe, por enquanto.' as resultado;
