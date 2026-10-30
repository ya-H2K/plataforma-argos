import { useCallback, useEffect, useRef, useState } from "react";
import { apiDevolucoes } from "../api.js";
import { BarraTopo } from "./Cabecalho.jsx";
import { useSessao } from "../sessao.js";
import { useAutoAtualizacao } from "../hooks/useAutoAtualizacao.js";
import { brl, num } from "../formato.js";

// Aba "Devoluções" › BK004 (e os próximos): valores devolvidos à Vox.
// Etapas de cada solicitação: Solicitação (criada pelo admin, com período, valor e o arquivo do BK) →
// Aprovação Qi Tech (check manual do admin) → Liquidação (automática, pela saída no extrato).
// Dados na tabela devolucoes (supabase/devolucoes.sql); por enquanto só o admin vê e mexe.

const FUSO = "America/Sao_Paulo";
const quando = (ts) => {
  if (!ts) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { dia: `${p.day}/${p.month}`, hora: `${p.hour}:${p.minute}` };
};
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const periodo = (d) => (d.inicio.slice(0, 4) === d.fim.slice(0, 4)
  ? `${br(d.inicio).slice(0, 5)} a ${br(d.fim)}` : `${br(d.inicio)} a ${br(d.fim)}`);
const isoDe8 = (t) => `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
const numeroBr = (t) => Number(String(t).trim().replace(/\./g, "").replace(",", "."));
const textoValor = (v) => (Number.isFinite(v) ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");

// Lê o CSV do BK (BK_CONSOLIDADO_AAAAMMDD_A_AAAAMMDD.csv): soma ValorContabil e pega o período do nome
// do arquivo (ou, sem ele, a menor e a maior DataReferencia). Excel e outros formatos: só o upload.
async function lerArquivoBk(arquivo) {
  const peloNome = arquivo.name.match(/(\d{8})_A_(\d{8})/i);
  const info = { inicio: peloNome ? isoDe8(peloNome[1]) : "", fim: peloNome ? isoDe8(peloNome[2]) : "", valor: null, linhas: null };
  if (!/\.(csv|txt)$/i.test(arquivo.name)) return info;
  const texto = (await arquivo.text()).replace(/^﻿/, "");
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  const cab = (linhas[0] || "").split(";").map((c) => c.trim());
  const iValor = cab.indexOf("ValorContabil");
  const iData = cab.indexOf("DataReferencia");
  if (iValor < 0) return info;
  let centavos = 0;
  let menor = "";
  let maior = "";
  for (const l of linhas.slice(1)) {
    const c = l.split(";");
    const v = numeroBr(c[iValor] || "0");
    if (Number.isFinite(v)) centavos += Math.round(v * 100);
    const d = (c[iData] || "").trim().slice(0, 8);
    if (/^\d{8}$/.test(d)) { if (!menor || d < menor) menor = d; if (!maior || d > maior) maior = d; }
  }
  info.valor = centavos / 100;
  info.linhas = linhas.length - 1;
  if (!info.inicio && menor) { info.inicio = isoDe8(menor); info.fim = isoDe8(maior); }
  return info;
}

export default function Devolucoes({ relatorio, aba, onAba, onVoltar }) {
  const { usuario } = useSessao();
  const admin = Boolean(usuario?.admin);
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(null);
  const [novo, setNovo] = useState(false);

  const buscar = useCallback(async () => {
    try {
      setLista(await apiDevolucoes.lista(relatorio.id));
      setErro(null);
    } catch (e) {
      setErro(e.message);
      throw e;
    }
  }, [relatorio.id]);
  useAutoAtualizacao(buscar, { chave: relatorio.id, intervaloMs: 2 * 60 * 1000, temDados: Boolean(lista) });
  const recarregar = () => buscar().catch(() => {});

  return (
    <>
      <BarraTopo aba={aba} onAba={onAba} />
      <div className="pagina">
        <div className="cabeca-pagina devolucoes__cabeca">
          <div>
            <button type="button" className="botao-texto relatorio__voltar" onClick={onVoltar}>← Devoluções</button>
            <h1 className="page-title">{relatorio.nome}</h1>
            {relatorio.descricao && <p className="page-sub">{relatorio.descricao}</p>}
          </div>
          {admin && (
            <button type="button" className="button button--pequeno" onClick={() => setNovo(true)}>+ Nova solicitação</button>
          )}
        </div>

        {erro && !lista ? (
          <p className="vazio" role="status">{erro}</p>
        ) : !lista ? (
          <p className="vazio" role="status">Carregando…</p>
        ) : (
          <section className="card devolucoes" aria-label="Solicitações">
            <h2 className="card__rotulo devolucoes__titulo">Solicitações</h2>
            {!lista.length && <p className="vazio devolucoes__vazio">Nenhuma solicitação ainda.</p>}
            {lista.map((d) => <Solicitacao key={d.id} d={d} admin={admin} relatorio={relatorio} aoMudar={recarregar} />)}
          </section>
        )}
      </div>
      {novo && <NovaSolicitacao relatorio={relatorio} onFechar={() => setNovo(false)} onCriada={() => { setNovo(false); recarregar(); }} />}
    </>
  );
}

function Solicitacao({ d, admin, relatorio, aoMudar }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const criada = quando(d.criada_em);
  const aprovada = quando(d.aprovada_em);
  const liquidada = quando(d.liquidada_em);
  const status = d.liquidada_em ? ["ok", "Concluída"] : d.aprovada_em ? ["and", "Aguardando liquidação"] : ["and", "Aguardando aprovação"];

  const acao = async (nome) => {
    setOcupado(true);
    setErro(null);
    try { await apiDevolucoes.acao(d.id, nome); await aoMudar(); }
    catch (e) { setErro(e.message); }
    finally { setOcupado(false); setConfirmarExclusao(false); }
  };
  const baixar = async () => {
    setErro(null);
    try { await apiDevolucoes.baixarArquivo(d); } catch (e) { setErro(e.message); }
  };

  return (
    <article className={`sol${d.liquidada_em ? " sol--fim" : ""}`}>
      <div className="sol__topo">
        <div className="sol__per">
          {periodo(d)}
          <small>{relatorio.nome} · solicitado em {criada.dia} às {criada.hora}</small>
        </div>
        <div className="sol__direita">
          <span className={`sol__selo sol__selo--${status[0]}`}>{status[1]}</span>
          <span className="sol__val">{brl(Number(d.valor))}</span>
        </div>
      </div>

      <ol className="passos">
        <li className="passo ok">
          <i aria-hidden="true" /><b>Solicitação</b><span>{criada.dia} · {criada.hora}</span>
        </li>
        <li className={`passo ${d.aprovada_em ? "ok" : "atual"}`}>
          <i aria-hidden="true" /><b>Aprovação Qi Tech</b>
          <span>{d.aprovada_em ? `${aprovada.dia} · ${aprovada.hora}` : "Aguardando aprovação"}</span>
          {admin && !d.aprovada_em && (
            <button type="button" className="passo__botao" disabled={ocupado} onClick={() => acao("aprovar")}>✓ Confirmar aprovação</button>
          )}
          {admin && d.aprovada_em && !d.liquidada_em && (
            <button type="button" className="botao-texto passo__desfazer" disabled={ocupado} onClick={() => acao("desaprovar")}>desfazer</button>
          )}
        </li>
        <li className={`passo ${d.liquidada_em ? "ok" : d.aprovada_em ? "atual" : ""}`}>
          <i aria-hidden="true" /><b>Liquidação</b>
          <span>{d.liquidada_em ? `${liquidada.dia} · ${liquidada.hora} · saída no extrato` : d.aprovada_em ? "Aguardando liquidação Qi Tech" : "Automática pelo extrato"}</span>
        </li>
      </ol>

      {(admin || erro) && (
        <div className="sol__rodape">
          {admin && d.arquivo_nome && (
            <span>Arquivo: <button type="button" className="botao-texto sol__arquivo" onClick={baixar}>{d.arquivo_nome}</button></span>
          )}
          {admin && d.email_em && <span>E-mail enviado às <b>{quando(d.email_em).hora}</b></span>}
          {admin && d.liquidada_em && !d.email_em && (() => {
            // "Criar e-mail": a automação do PC monta o e-mail no Outlook (com o recorte da saída e o
            // arquivo do BK) e deixa aberto, sem enviar. Roda de 2 em 2 minutos.
            const montando = d.email_pedido_em && !d.email_rascunho_em && !d.email_erro;
            return (
              <span className="sol__email">
                {d.email_rascunho_em && <>E-mail criado no Outlook às <b>{quando(d.email_rascunho_em).hora}</b></>}
                {montando && <>Montando o e-mail no Outlook… (até 2 min)</>}
                {d.email_erro && <span className="sol__erro-inline">Não consegui criar o e-mail: {d.email_erro}</span>}
                {!montando && (
                  <button type="button" className="passo__botao sol__email-botao" disabled={ocupado} onClick={() => acao("email")}>
                    ✉ {d.email_rascunho_em || d.email_erro ? "Criar de novo" : "Criar e-mail"}
                  </button>
                )}
              </span>
            );
          })()}
          {admin && !d.liquidada_em && (
            confirmarExclusao ? (
              <span className="sol__excluir">
                Excluir esta solicitação?
                <button type="button" className="botao-texto" disabled={ocupado} onClick={() => acao("excluir")}>Sim, excluir</button>
                <button type="button" className="botao-texto" onClick={() => setConfirmarExclusao(false)}>Não</button>
              </span>
            ) : (
              <button type="button" className="botao-texto sol__excluir" onClick={() => setConfirmarExclusao(true)}>Excluir</button>
            )
          )}
          {erro && <span className="sol__erro" role="alert">{erro}</span>}
        </div>
      )}
    </article>
  );
}

function NovaSolicitacao({ relatorio, onFechar, onCriada }) {
  const [arquivo, setArquivo] = useState(null);
  const [info, setInfo] = useState(null);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [valor, setValor] = useState("");
  const [lendo, setLendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [arrastando, setArrastando] = useState(false);
  const entrada = useRef(null);
  const caixa = useRef(null);

  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape" && !enviando) onFechar(); };
    document.addEventListener("keydown", esc);
    caixa.current?.focus();
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar, enviando]);

  const escolher = async (f) => {
    if (!f) return;
    setArquivo(f);
    setErro(null);
    setLendo(true);
    try {
      const i = await lerArquivoBk(f);
      setInfo(i);
      if (i.inicio) setInicio(i.inicio);
      if (i.fim) setFim(i.fim);
      if (i.valor !== null) setValor(textoValor(i.valor));
    } catch { setInfo(null); }
    finally { setLendo(false); }
  };

  const v = numeroBr(valor);
  const valido = arquivo && inicio && fim && fim >= inicio && Number.isFinite(v) && v > 0;
  const criar = async (e) => {
    e.preventDefault();
    if (!valido) return;
    setEnviando(true);
    setErro(null);
    try { await apiDevolucoes.criar(relatorio.id, { inicio, fim, valor: v, arquivo }); onCriada(); }
    catch (er) { setErro(er.message); setEnviando(false); }
  };
  const lidoDoArquivo = info && info.valor !== null;

  return (
    <div className="modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget && !enviando) onFechar(); }}>
      <form className="card modal devolucao-form" role="dialog" aria-modal="true" aria-labelledby="nova-sol-titulo"
        ref={caixa} tabIndex={-1} onSubmit={criar}>
        <div className="modal__topo">
          <h2 id="nova-sol-titulo">Nova solicitação · {relatorio.nome}</h2>
          <button type="button" className="modal__fechar" aria-label="Fechar" onClick={onFechar} disabled={enviando}>×</button>
        </div>

        <button type="button" className={`devolucao-form__arquivo${arrastando ? " on" : ""}`}
          onClick={() => entrada.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); escolher(e.dataTransfer.files?.[0]); }}>
          {arquivo ? (
            <>
              <b>{arquivo.name}</b>
              {lendo ? "Lendo o arquivo…" : `${info?.linhas != null ? `${num(info.linhas)} lançamentos · ` : ""}trocar arquivo`}
            </>
          ) : (
            <>
              <b>Arquivo do {relatorio.nome}</b>
              Clique ou arraste o arquivo aqui
            </>
          )}
        </button>
        <input ref={entrada} type="file" hidden accept=".csv,.txt,.xlsx,.xls" onChange={(e) => escolher(e.target.files?.[0])} />

        <div className="devolucao-form__2">
          <label className="devolucao-form__campo">Início
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
          </label>
          <label className="devolucao-form__campo">Fim
            <input type="date" value={fim} min={inicio || undefined} onChange={(e) => setFim(e.target.value)} required />
          </label>
        </div>
        <label className="devolucao-form__campo">Valor (R$)
          <input type="text" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)}
            onBlur={() => Number.isFinite(numeroBr(valor)) && valor && setValor(textoValor(numeroBr(valor)))} required />
        </label>

        {lidoDoArquivo && <span className="devolucao-form__ok">✓ Período e valor lidos do arquivo, confira antes de criar.</span>}
        {lidoDoArquivo && inicio && inicio === fim && (
          <span className="devolucao-form__dica">O arquivo tem um único dia. Se o período for outro, ajuste as datas acima.</span>
        )}
        {arquivo && info && !lidoDoArquivo && !lendo && <span className="devolucao-form__dica">Preencha o período e o valor.</span>}
        {erro && <span className="devolucao-form__erro" role="alert">{erro}</span>}

        <button type="submit" className="button button--pequeno devolucao-form__criar" disabled={!valido || enviando || lendo}>
          {enviando ? "Criando…" : "Criar"}
        </button>
      </form>
    </div>
  );
}

// Linha de status no card do BK (aba Devoluções): só quando há solicitação em andamento.
export function StatusBk({ id }) {
  const [lista, setLista] = useState(null);
  useEffect(() => { apiDevolucoes.lista(id).then(setLista).catch(() => setLista(null)); }, [id]);
  if (!lista) return null;
  const abertas = lista.filter((d) => !d.liquidada_em);
  if (abertas.length) {
    return (
      <span className="relatorio-item__desc status-bk status-bk--and">
        <i aria-hidden="true" />Em andamento
      </span>
    );
  }
  return null;                                     // nada em andamento: card limpo
}
