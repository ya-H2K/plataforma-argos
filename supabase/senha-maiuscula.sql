-- 15/10/2026: a senha passa a exigir letras maiúsculas e minúsculas (além de 8 caracteres,
-- 1 número e 1 caractere especial). Rode uma vez no SQL Editor do Supabase.
-- Vale para novas senhas (cadastro e "Esqueci minha senha"); quem já tem acesso continua entrando normalmente.
create or replace function public._senha_valida(s text) returns boolean
language sql immutable as $$
  select length(coalesce(s, '')) >= 8 and s ~ '[A-Z]' and s ~ '[a-z]' and s ~ '\d' and s ~ '[^A-Za-z0-9[:space:]]'
$$;
revoke all on function public._senha_valida(text) from public, anon, authenticated;
