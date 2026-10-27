-- =====================================================================
--  Resumo de Baixas (27/10/2026): relatório restrito.
--  1) Os dados (chave "restrito:baixas") já seguem a regra dos restritos
--     (relatorios-restritos.sql): só o admin e os e-mails liberados.
--  2) O Excel do dia tem CPF e fica no Storage em restrito/baixas/AAAA-MM-DD.xlsx.
--     Aqui a pasta "restrito/" do bucket passa a abrir só para quem tem o
--     relatório liberado (o resto do bucket continua igual: todos os usuários ativos).
--  3) A função vox_restritos_arquivos avisa o publicador que isso já foi feito
--     (antes disso ele não envia o Excel).
--  Cole isto no "SQL Editor" do Supabase e clique em "Run" (uma vez só).
--  Precisa do relatorios-restritos.sql já rodado (Carteira em Dia).
--
--  Por enquanto ninguém está liberado: só o admin vê. Liberar alguém depois:
--    insert into public.relatorio_acesso values ('baixas', 'fulano@voxcred.com.br');
--  (e incluir o e-mail na lista "emails" do relatório em web/src/components/Relatorios.jsx)
-- =====================================================================

drop policy if exists "vox caixa leitura" on storage.objects;
create policy "vox caixa leitura" on storage.objects for select to authenticated
  using (bucket_id = 'caixa' and public._acesso_ok()
         and (name not like 'restrito/%' or public._relatorio_ok(split_part(name, '/', 2))));

create or replace function public.vox_restritos_arquivos() returns boolean
language sql stable as $$ select true $$;
revoke execute on function public.vox_restritos_arquivos() from public, anon, authenticated;

select 'Pronto! Resumo de Baixas restrito (dados e Excel) ao admin e aos e-mails liberados.' as resultado;
