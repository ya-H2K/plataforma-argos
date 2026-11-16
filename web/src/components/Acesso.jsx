import { useEffect, useState } from "react";
import { apiAuth } from "../api.js";
import { LogoH2, LogoVoxFidc, OlhoArgos } from "./Logos.jsx";

// Regras da senha (as mesmas do servidor).
const regras = (s) => [
  ["Pelo menos 8 caracteres", s.length >= 8],
  ["Letras maiúsculas e minúsculas", /[A-Z]/.test(s) && /[a-z]/.test(s)],
  ["1 número", /\d/.test(s)],
  ["1 caractere especial (!@#$%…)", /[^A-Za-z0-9\s]/.test(s)],
];

function formatarCpf(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

function Campo({ rotulo, dica, ...props }) {
  return (
    <label className="campo">
      <span className="campo__rotulo">{rotulo}</span>
      <input {...props} />
      {dica && <span className="campo__dica">{dica}</span>}
    </label>
  );
}

// Senha + confirmação, com as regras marcadas em tempo real.
function CamposSenha({ senha, confirma, onSenha, onConfirma, rotulo = "Senha" }) {
  return (
    <>
      <Campo rotulo={rotulo} type="password" autoComplete="new-password" value={senha} onChange={onSenha} required />
      <ul className="acesso__regras" aria-label="Regras da senha">
        {regras(senha).map(([texto, ok]) => (
          <li key={texto} className={ok ? "ok" : undefined}><span aria-hidden="true">{ok ? "✓" : "○"}</span> {texto}</li>
        ))}
      </ul>
      <Campo rotulo="Confirme a senha" type="password" autoComplete="new-password" value={confirma} onChange={onConfirma} required
        dica={confirma && senha !== confirma ? "As senhas não conferem." : ""} />
    </>
  );
}

// Lado esquerdo das telas de acesso: H2 Kapital + Vox FIDC, e a apresentação da Plataforma Argos.
function LadoArgos() {
  return (
    <aside className="acesso__lado">
      <OlhoArgos className="acesso__olho-fundo" pontos={false} />
      <div className="acesso__logos">
        <LogoH2 />
        <span className="acesso__divisor" aria-hidden="true" />
        <LogoVoxFidc />
      </div>
      <div className="acesso__apresenta">
        <OlhoArgos />
        <p className="acesso__argos">Argos</p>
        <p className="acesso__frase">Plataforma de acompanhamento do <b>Vox FIDC</b>: operação do dia, fluxo de caixa e relatórios do fundo.</p>
      </div>
      <span className="acesso__rodape">H2 Kapital</span>
    </aside>
  );
}

export default function Acesso({ onEntrar }) {
  // etapa: entrar | cadastro | esqueci | enviado
  const [etapa, setEtapa] = useState("entrar");
  const [form, setForm] = useState({ login: "", senha: "", nome: "", email: "", cpf: "", nova: "", confirma: "" });
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(null);           // "cadastro" | "senha"
  const [enviando, setEnviando] = useState(false);

  const muda = (campo) => (e) => setForm((f) => ({ ...f, [campo]: campo === "cpf" ? formatarCpf(e.target.value) : e.target.value }));
  const ir = (nova) => { setErro(""); setForm((f) => ({ ...f, nova: "", confirma: "" })); setEtapa(nova); };
  const senhaOk = regras(form.nova).every(([, ok]) => ok) && form.nova === form.confirma;

  const executar = (fn) => async (e) => {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try { await fn(); } catch (x) { setErro(x.message); } finally { setEnviando(false); }
  };

  const entrar = executar(async () => {
    const r = await apiAuth.entrar(form.login, form.senha);
    onEntrar(r.usuario);
  });
  const solicitar = executar(async () => {
    if (form.nova !== form.confirma) throw new Error("As senhas não conferem.");
    await apiAuth.cadastro({ nome: form.nome, email: form.email, cpf: form.cpf, senha: form.nova });
    setEnviado("cadastro"); ir("enviado");
  });
  const pedirSenha = executar(async () => {
    if (form.nova !== form.confirma) throw new Error("As senhas não conferem.");
    await apiAuth.esqueci(form.email, form.nova);
    setEnviado("senha"); ir("enviado");
  });

  return (
    <div className="acesso acesso--argos">
      <LadoArgos />
      <div className="acesso__card">

        {etapa === "entrar" && (
          <form onSubmit={entrar} className="acesso__form">
            <h1 className="acesso__titulo">Entrar</h1>
            <Campo rotulo="E-mail" type="text" autoComplete="username" value={form.login} onChange={muda("login")} autoFocus required />
            <Campo rotulo="Senha" type="password" autoComplete="current-password" value={form.senha} onChange={muda("senha")} required />
            {erro && <p className="acesso__erro" role="alert">{erro}</p>}
            <button type="submit" className="acesso__botao" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
            <div className="acesso__links">
              <button type="button" className="botao-texto" onClick={() => ir("cadastro")}>Solicitar acesso</button>
              <button type="button" className="botao-texto"
                onClick={() => { setForm((f) => ({ ...f, email: f.login.includes("@") ? f.login : f.email })); ir("esqueci"); }}>
                Esqueci minha senha
              </button>
            </div>
          </form>
        )}

        {etapa === "cadastro" && (
          <form onSubmit={solicitar} className="acesso__form">
            <h1 className="acesso__titulo">Solicitar acesso</h1>
            <p className="acesso__texto">Use o seu e-mail corporativo. O acesso é liberado depois da aprovação do administrador.</p>
            <Campo rotulo="Nome completo" type="text" autoComplete="name" value={form.nome} onChange={muda("nome")} autoFocus required />
            <Campo rotulo="E-mail corporativo" type="email" autoComplete="email" value={form.email} onChange={muda("email")} required />
            <Campo rotulo="CPF" type="text" inputMode="numeric" value={form.cpf} onChange={muda("cpf")} placeholder="000.000.000-00" required />
            <CamposSenha senha={form.nova} confirma={form.confirma} onSenha={muda("nova")} onConfirma={muda("confirma")} rotulo="Crie sua senha" />
            {erro && <p className="acesso__erro" role="alert">{erro}</p>}
            <button type="submit" className="acesso__botao" disabled={enviando || !senhaOk}>{enviando ? "Enviando…" : "Enviar solicitação"}</button>
            <div className="acesso__links"><button type="button" className="botao-texto" onClick={() => ir("entrar")}>Já tenho acesso</button></div>
          </form>
        )}

        {etapa === "esqueci" && (
          <form onSubmit={pedirSenha} className="acesso__form">
            <h1 className="acesso__titulo">Esqueci minha senha</h1>
            <p className="acesso__texto">Informe o seu e-mail e escolha uma nova senha. Ela passa a valer depois da aprovação do administrador.</p>
            <Campo rotulo="E-mail" type="email" autoComplete="email" value={form.email} onChange={muda("email")} autoFocus required />
            <CamposSenha senha={form.nova} confirma={form.confirma} onSenha={muda("nova")} onConfirma={muda("confirma")} rotulo="Nova senha" />
            {erro && <p className="acesso__erro" role="alert">{erro}</p>}
            <button type="submit" className="acesso__botao" disabled={enviando || !senhaOk}>{enviando ? "Enviando…" : "Enviar pedido"}</button>
            <div className="acesso__links"><button type="button" className="botao-texto" onClick={() => ir("entrar")}>Voltar para entrar</button></div>
          </form>
        )}

        {etapa === "enviado" && (
          <div className="acesso__form">
            <h1 className="acesso__titulo">{enviado === "senha" ? "Pedido enviado" : "Solicitação enviada"}</h1>
            <p className="acesso__texto">
              {enviado === "senha"
                ? "Assim que o administrador aprovar, a nova senha passa a valer. Até lá, a senha antiga continua funcionando."
                : "Assim que o administrador aprovar, você poderá entrar com o seu e-mail e a senha que acabou de criar."}
            </p>
            <button type="button" className="acesso__botao" onClick={() => ir("entrar")}>Voltar para entrar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Primeiro acesso por link exclusivo (#/primeiro-acesso/<código>): e-mail e CPF meio oculto
// vêm do link; a pessoa só cria a senha e já entra no Argos.
export function PrimeiroAcesso({ token, onEntrar }) {
  const [info, setInfo] = useState(null);                 // null = carregando
  const [erroLink, setErroLink] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    apiAuth.primeiroAcessoInfo(token).then(setInfo).catch((e) => setErroLink(e.message));
  }, [token]);

  const senhaOk = regras(senha).every(([, ok]) => ok) && senha === confirma;
  const criar = async (e) => {
    e.preventDefault();
    if (!senhaOk || !info) return;
    setErro("");
    setEnviando(true);
    try { onEntrar(await apiAuth.primeiroAcesso(token, info.email, senha)); }
    catch (x) { setErro(x.message); setEnviando(false); }
  };
  const irLogin = () => { window.location.hash = "#/"; };

  return (
    <div className="acesso acesso--argos">
      <LadoArgos />
      <div className="acesso__card">
        {erroLink ? (
          <div className="acesso__form">
            <span className="primeiro__selo">Primeiro acesso</span>
            <h1 className="acesso__titulo">Link indisponível</h1>
            <p className="acesso__texto">{erroLink}</p>
            <button type="button" className="acesso__botao" onClick={irLogin}>Ir para o login</button>
          </div>
        ) : !info ? (
          <p className="acesso__carregando">Carregando…</p>
        ) : (
          <form onSubmit={criar} className="acesso__form">
            <span className="primeiro__selo">Primeiro acesso</span>
            <h1 className="acesso__titulo">Crie sua senha</h1>
            <p className="acesso__texto">Este link é exclusivo para o seu acesso. Confira os seus dados e crie a senha: em seguida você já entra no Argos.</p>
            <div className="campo">
              <span className="campo__rotulo">E-mail</span>
              <div className="primeiro__dado">{info.email}</div>
            </div>
            <div className="campo">
              <span className="campo__rotulo">CPF</span>
              <div className="primeiro__dado">{info.cpf}</div>
            </div>
            <input type="email" autoComplete="username" value={info.email} readOnly hidden />
            <CamposSenha senha={senha} confirma={confirma} onSenha={(e) => setSenha(e.target.value)}
              onConfirma={(e) => setConfirma(e.target.value)} rotulo="Crie sua senha" />
            {erro && <p className="acesso__erro" role="alert">{erro}</p>}
            <button type="submit" className="acesso__botao" disabled={enviando || !senhaOk}>{enviando ? "Entrando…" : "Criar senha e entrar"}</button>
            <p className="primeiro__nota">Depois, para entrar de novo, use o seu e-mail e esta senha. O link vale só para este primeiro acesso.</p>
          </form>
        )}
      </div>
    </div>
  );
}
