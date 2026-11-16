-- =====================================================================
--  Argos: PRIMEIRO ACESSO POR LINK (16/11/2026)
--  Link exclusivo por pessoa (#/primeiro-acesso/<código>): a tela mostra o e-mail e o
--  CPF meio oculto; a pessoa só cria a senha e já entra, sem aprovação do admin.
--  Cada link vale UMA vez e até a data de validade. O banco guarda só o hash do código.
--  Cole no "SQL Editor" do Supabase e clique em "Run". Pode rodar de novo.
--  (Os links de cada pessoa são criados por outro SQL, que não vai para o GitHub.)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.primeiro_acesso (
  token_hash text primary key,                 -- sha256 do código do link (o código em si não fica salvo)
  email      text not null,
  nome       text not null,
  cpf        text not null,                    -- só dígitos
  criado_em  timestamptz not null default now(),
  expira_em  timestamptz not null,
  usado_em   timestamptz,
  usuario    uuid                              -- login criado pelo link
);
alter table public.primeiro_acesso enable row level security;
revoke all on public.primeiro_acesso from anon, authenticated;

-- Dados para a tela do link (sem login): e-mail, nome e CPF meio oculto.
create or replace function public.vox_primeiro_acesso(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.primeiro_acesso
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if not found then raise exception 'VOX_LINK: Este link não é válido. Confira se o endereço foi copiado inteiro.'; end if;
  if r.usado_em is not null then raise exception 'VOX_LINK: A senha deste link já foi criada. Entre com o seu e-mail e a sua senha.'; end if;
  if r.expira_em <= now() then raise exception 'VOX_LINK: Este link venceu. Peça um novo ao administrador.'; end if;
  return jsonb_build_object('email', r.email, 'nome', r.nome,
    'cpf', substr(r.cpf, 1, 3) || '.•••.•••-' || substr(r.cpf, 10, 2));
end $$;

-- Depois de criar o login: com código de primeiro acesso válido, o perfil já nasce ATIVO
-- (nome e CPF vêm do link); sem código, segue a regra de sempre (pendente até o admin aprovar).
create or replace function public._apos_criar_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nome  text := btrim(regexp_replace(coalesce(new.raw_user_meta_data ->> 'nome', ''), '\s+', ' ', 'g'));
  v_cpf   text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '\D', '', 'g');
  v_admin boolean := coalesce((new.raw_app_meta_data ->> 'vox_admin')::boolean, false);
  v_convite text := new.raw_user_meta_data ->> 'vox_convite';
  v_link  text := new.raw_user_meta_data ->> 'vox_primeiro_acesso';
  v_pa    record;
begin
  if v_link is not null then
    select * into v_pa from public.primeiro_acesso
     where token_hash = encode(extensions.digest(v_link, 'sha256'), 'hex')
       and usado_em is null and expira_em > now() and email = lower(new.email);
    if not found then raise exception 'VOX_LINK: link inválido, já usado ou vencido.'; end if;
    if exists (select 1 from public.perfis where cpf = v_pa.cpf) then
      raise exception 'VOX_CPF_DUPLICADO: este CPF já está cadastrado com outro e-mail.';
    end if;
    insert into public.perfis (id, nome, email, cpf, status, aprovado_em)
    values (new.id, v_pa.nome, lower(new.email), v_pa.cpf, 'ativo', now());
    update public.primeiro_acesso set usado_em = now(), usuario = new.id where token_hash = v_pa.token_hash;
    return new;
  end if;

  if v_convite is not null and exists (select 1 from public.convites where token = v_convite
                                       and criado_em > now() - interval '1 hour') then
    v_admin := true;
  end if;
  delete from public.convites where token = v_convite;
  if v_admin then
    insert into public.perfis (id, nome, email, cpf, status, admin, aprovado_em)
    values (new.id, coalesce(nullif(v_nome, ''), 'Administrador'), lower(new.email), nullif(v_cpf, ''), 'ativo', true, now())
    on conflict (id) do update set status = 'ativo', admin = true;
    return new;
  end if;
  if position(' ' in v_nome) = 0 then raise exception 'VOX_NOME: informe o nome completo.'; end if;
  if not public._cpf_valido(v_cpf) then raise exception 'VOX_CPF: CPF inválido.'; end if;
  if exists (select 1 from public.perfis where cpf = v_cpf) then
    raise exception 'VOX_CPF_DUPLICADO: este CPF já está cadastrado com outro e-mail.';
  end if;
  insert into public.perfis (id, nome, email, cpf) values (new.id, v_nome, lower(new.email), v_cpf);
  return new;
end $$;

revoke all on function public.vox_primeiro_acesso(text), public._apos_criar_usuario() from public, anon, authenticated;
grant execute on function public.vox_primeiro_acesso(text) to anon, authenticated;

select 'Pronto! Primeiro acesso por link configurado.' as resultado;
