-- =====================================================================
--  Devoluções: e-mail de aviso quando uma solicitação é criada (30/10/2026).
--  O publicador manda o aviso pelo Outlook e marca aviso_em. As solicitações que já
--  existem ficam marcadas agora (não recebem aviso atrasado).
--  Cole isto no "SQL Editor" do Supabase e clique em "Run" (uma vez só).
-- =====================================================================
alter table public.devolucoes add column if not exists aviso_em timestamptz;
update public.devolucoes set aviso_em = now() where aviso_em is null;

-- leitura (todos os usuários ativos): sem arquivo/saída/e-mails para quem não é admin
create or replace function public.vox_devolucoes(p_relatorio text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean;
begin
  if not public._acesso_ok() then raise exception 'VOX_SEM_ACESSO' using errcode = '42501'; end if;
  v_admin := public._admin_ok();
  return coalesce((select jsonb_agg(
            case when v_admin then to_jsonb(d) - 'criada_por'
                 else to_jsonb(d) - 'criada_por' - 'arquivo_nome' - 'arquivo_caminho' - 'liquidacao'
                      - 'email_pedido_em' - 'email_rascunho_em' - 'email_erro' - 'aviso_em' end
            order by d.inicio desc, d.criada_em desc)
          from public.devolucoes d where d.relatorio = p_relatorio), '[]'::jsonb);
end $$;

select 'Pronto! Aviso por e-mail de nova solicitação de devolução ligado.' as resultado;
