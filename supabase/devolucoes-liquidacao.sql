-- =====================================================================
--  Devoluções: liquidação pelo extrato + botão "Criar e-mail" (30/10/2026).
--  A automação do PC (C:\Automacao\Vox\devolucoes_vox.py) lê o extrato, conclui a
--  solicitação (liquidada_em + liquidacao) e, quando o admin clica em "Criar e-mail"
--  no Argos (email_pedido_em), monta o rascunho no Outlook (email_rascunho_em).
--  Cole isto no "SQL Editor" do Supabase e clique em "Run" (uma vez só).
-- =====================================================================

alter table public.devolucoes add column if not exists email_pedido_em   timestamptz;
alter table public.devolucoes add column if not exists email_rascunho_em timestamptz;
alter table public.devolucoes add column if not exists email_erro        text;

-- 'aprovar', 'desaprovar', 'excluir' e 'email' (pede o rascunho do e-mail; só depois de liquidada)
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
  elsif p_acao = 'email' then
    update public.devolucoes set email_pedido_em = now(), email_rascunho_em = null, email_erro = null
     where id = p_id and liquidada_em is not null;
    if not found then raise exception 'VOX_DADOS: O e-mail só pode ser criado depois da liquidação.'; end if;
  else
    raise exception 'VOX_DADOS: Ação inválida.';
  end if;
end $$;

-- leitura: todos os usuários ativos; arquivo, detalhes da saída e dados do e-mail só para o admin
create or replace function public.vox_devolucoes(p_relatorio text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean;
begin
  if not public._acesso_ok() then raise exception 'VOX_SEM_ACESSO' using errcode = '42501'; end if;
  v_admin := public._admin_ok();
  return coalesce((select jsonb_agg(
            case when v_admin then to_jsonb(d) - 'criada_por'
                 else to_jsonb(d) - 'criada_por' - 'arquivo_nome' - 'arquivo_caminho' - 'liquidacao'
                      - 'email_pedido_em' - 'email_rascunho_em' - 'email_erro' end
            order by d.inicio desc, d.criada_em desc)
          from public.devolucoes d where d.relatorio = p_relatorio), '[]'::jsonb);
end $$;

select 'Pronto! Liquidação pelo extrato e botão "Criar e-mail" ativados.' as resultado;
