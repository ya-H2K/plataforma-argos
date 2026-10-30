-- =====================================================================
--  Devoluções liberadas para todos os usuários (30/10/2026).
--  Qualquer pessoa logada e ativa vê as solicitações (período, valor, etapas).
--  Nome e caminho do arquivo do BK continuam só para o admin, e criar/aprovar/
--  excluir continua só do admin. O arquivo no Storage segue na pasta restrita.
--  Cole isto no "SQL Editor" do Supabase e clique em "Run" (uma vez só).
-- =====================================================================

create or replace function public.vox_devolucoes(p_relatorio text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean;
begin
  if not public._acesso_ok() then raise exception 'VOX_SEM_ACESSO' using errcode = '42501'; end if;
  v_admin := public._admin_ok();
  return coalesce((select jsonb_agg(
            case when v_admin then to_jsonb(d) - 'criada_por'
                 else to_jsonb(d) - 'criada_por' - 'arquivo_nome' - 'arquivo_caminho' - 'liquidacao' end
            order by d.inicio desc, d.criada_em desc)
          from public.devolucoes d where d.relatorio = p_relatorio), '[]'::jsonb);
end $$;

select 'Pronto! Devoluções liberadas para todos os usuários (arquivo e ações só do admin).' as resultado;
