-- =====================================================================
--  Relatórios restritos (16/10/2026): "Carteira em Dia".
--  Chaves "restrito:<relatório>..." do painel só vão para o admin e para os
--  e-mails liberados na tabela relatorio_acesso. A liberação é pelo e-mail,
--  então vale também para quem ainda vai pedir acesso (assim que o admin aprovar).
--  Cole isto no "SQL Editor" do Supabase e clique em "Run" (uma vez só).
--
--  Liberar outra pessoa depois:
--    insert into public.relatorio_acesso values ('carteira', 'fulano@voxcred.com.br');
--  Tirar:
--    delete from public.relatorio_acesso where relatorio = 'carteira' and email = 'fulano@voxcred.com.br';
-- =====================================================================

create table if not exists public.relatorio_acesso (
  relatorio text not null,
  email     text not null check (email = lower(btrim(email))),
  primary key (relatorio, email)
);
-- sem políticas: ninguém lê pelo site; só as funções abaixo e a chave secreta (publicador)
alter table public.relatorio_acesso enable row level security;
revoke all on public.relatorio_acesso from public, anon, authenticated;

insert into public.relatorio_acesso (relatorio, email)
values ('carteira', 'lucas.ramao@voxcred.com.br')
on conflict do nothing;

create or replace function public._relatorio_ok(p_relatorio text) returns boolean
language sql stable security definer set search_path = public as $$
  select public._admin_ok()
      or (public._acesso_ok() and exists (
            select 1 from public.relatorio_acesso r join public.perfis p on lower(p.email) = r.email
            where p.id = auth.uid() and r.relatorio = p_relatorio))
$$;

create or replace function public.vox_painel(p_chaves text[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._acesso_ok() then
    raise exception 'VOX_SEM_ACESSO' using errcode = '42501';
  end if;
  -- "admin:..." só para o administrador; "restrito:<relatório>..." para o admin e os e-mails liberados
  return coalesce((select jsonb_object_agg(chave, conteudo) from public.painel
                   where chave = any (p_chaves)
                     and (chave not like 'admin:%' or public._admin_ok())
                     and (chave not like 'restrito:%' or public._relatorio_ok(split_part(chave, ':', 2)))), '{}'::jsonb);
end $$;

revoke execute on function public._relatorio_ok(text) from public, anon;
grant execute on function public._relatorio_ok(text), public.vox_painel(text[]) to authenticated;

select 'Pronto! Relatório Carteira em Dia restrito ao admin e aos e-mails liberados.' as resultado;
