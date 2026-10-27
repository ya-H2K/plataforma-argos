import { useCallback, useMemo, useState } from "react";
import { apiRelatorios } from "../api.js";
import { BarraTopo } from "./Cabecalho.jsx";
import { useAutoAtualizacao } from "../hooks/useAutoAtualizacao.js";
import { ano, brl, diaMes, diaSemana, num } from "../formato.js";
import { gerarXlsx, LIMITE_LINHAS_EXCEL } from "../xlsx.js";

// Relatório restrito "Resumo de Baixas": o que foi IMPORTADO (arquivos da pasta "com financeiro"),
// separado pela classificação do arquivo. Não é o valor conciliado.
// A automação do PC (C:\Automacao\Vox\resumo_baixas.py) grava um resumo por dia; o publicador manda
// todos na chave "restrito:baixas" (só o admin e os e-mails liberados em relatorio_acesso recebem).
// Filtro: um dia ou um período dentro de um mesmo mês (o Excel nunca passa de um mês).

const ORDEM = ["Baixas padrão do dia", "Baixa de vencidos", "Baixa manual", "Baixa Bauk ajustada", "Ajuste", "Não reconhecido"];
const dataBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const ultimoDia = (mes) => {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
};
const hhmm = (iso) => (iso ? iso.slice(11, 16) : "");
const plural = (n, um, varios) => `${num(n)} ${n === 1 ? um : varios}`;
const menor = (a, b) => (a < b ? a : b);

// Soma os dias do intervalo: valor, arquivos e cada classificação.
function somar(dias) {
  const porClasse = new Map();
  for (const d of dias) {
    for (const c of d.classificacoes || []) {
      const t = porClasse.get(c.classificacao) || { classificacao: c.classificacao, arquivos: 0, valor: 0 };
      t.arquivos += c.arquivos;
      t.valor += c.valor;
      porClasse.set(c.classificacao, t);
    }
  }
  const pos = (c) => (ORDEM.includes(c) ? ORDEM.indexOf(c) : ORDEM.length);
  return {
    valor: dias.reduce((t, d) => t + d.valor, 0),
    arquivos: dias.reduce((t, d) => t + d.arquivos, 0),
    classificacoes: [...porClasse.values()].sort((a, b) => pos(a.classificacao) - pos(b.classificacao)),
  };
}

// Excel título a título (igual ao relatório de antes, sem o nome do sacado) + de onde veio cada título:
// DATA | SEU_NUMERO | NU_DOCUMENTO | CPF_SACADO | VENCIMENTO | VALOR_PAGO | TIPO_BAIXA | ARQUIVO | CLASSIFICACAO.
// Os títulos de cada dia ficam na pasta restrita do Storage (um arquivo por dia); o Excel é montado aqui.
const COLUNAS = [
  { titulo: "DATA", largura: 12, tipo: "data" },
  { titulo: "SEU_NUMERO", largura: 20 },
  { titulo: "NU_DOCUMENTO", largura: 15 },
  { titulo: "CPF_SACADO", largura: 16 },
  { titulo: "VENCIMENTO", largura: 13, tipo: "data" },
  { titulo: "VALOR_PAGO", largura: 14, tipo: "valor" },
  { titulo: "TIPO_BAIXA", largura: 12 },
  { titulo: "ARQUIVO", largura: 46 },
  { titulo: "CLASSIFICACAO", largura: 22 },
];

function* linhasDoExcel(detalhes) {
  for (const det of detalhes) {
    for (const [seu, doc, cpf, venc, centavos, iTipo, iArq] of det.linhas) {
      const arq = det.arquivos[iArq] || {};
      yield [det.data, seu, doc, cpf, venc, centavos / 100, det.tipos[iTipo], arq.arquivo, arq.classificacao];
    }
  }
}

const br = (iso) => iso.split("-").reverse().join("/");

async function baixarExcel(dias, nomeArquivo, aoAndamento, guarda) {
  // o título a título fica no Supabase por um tempo (padrão 12 meses); o resumo da tela fica sempre
  const antigos = guarda?.desde ? dias.filter((d) => d.data < guarda.desde) : [];
  if (antigos.length) {
    throw Object.assign(new Error(`O Excel título a título fica disponível só para os últimos ${guarda.meses || 12} meses (desde ${br(guarda.desde)}).`), { paraTela: true });
  }
  const faltando = dias.filter((d) => !d.detalhe);
  if (faltando.length) {
    throw Object.assign(new Error(`O detalhe de ${faltando.map((d) => br(d.data)).join(", ")} ainda está sendo enviado. Tente em alguns minutos.`), { paraTela: true });
  }
  const total = dias.reduce((t, d) => t + (d.titulos || 0), 0);
  if (total > LIMITE_LINHAS_EXCEL) throw Object.assign(new Error("O período tem mais títulos do que cabe numa planilha. Escolha um período menor."), { paraTela: true });

  // baixa os dias (4 de cada vez) e mantém a ordem das datas
  const detalhes = new Array(dias.length);
  let feitos = 0;
  aoAndamento(`Baixando 0/${dias.length}`);
  for (let i = 0; i < dias.length; i += 4) {
    await Promise.all(dias.slice(i, i + 4).map(async (d, k) => {
      detalhes[i + k] = await apiRelatorios.baixasTitulos(d.data);
      aoAndamento(`Baixando ${++feitos}/${dias.length}`);
    }));
  }

  const blob = await gerarXlsx({
    aba: "Baixas", colunas: COLUNAS, linhas: linhasDoExcel(detalhes),
    aoProgresso: (n) => aoAndamento(`Gerando ${Math.min(99, Math.round((n / Math.max(total, 1)) * 100))}%`),
  });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = nomeArquivo;
  document.body.appendChild(el);
  el.click();
  el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ResumoBaixas({ aba, onAba, onVoltar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [meta, setMeta] = useState(null);
  const [modo, setModo] = useState("dia");             // "dia" | "periodo"
  const [dia, setDia] = useState(null);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [baixando, setBaixando] = useState(null);         // texto do andamento enquanto gera o Excel
  const [erroBaixar, setErroBaixar] = useState(null);

  const buscar = useCallback(async () => {
    try {
      const r = await apiRelatorios.baixas();
      setDados(r);
      setMeta(r.meta);
      setErro(null);
      // padrão: hoje, se já tiver baixas; senão, o último dia com baixas
      const inicial = r.dias.some((d) => d.data === r.hoje) ? r.hoje : r.dias.at(-1)?.data ?? r.hoje;
      setDia((s) => s ?? inicial);
    } catch (e) {
      setErro(e.message);
      throw e;
    }
  }, []);
  const intervaloMs = (meta?.intervaloAtualizacaoMin || 10) * 60 * 1000;
  useAutoAtualizacao(buscar, { chave: "baixas", intervaloMs, temDados: Boolean(dados) });

  const dias = useMemo(() => [...(dados?.dias || [])].sort((a, b) => a.data.localeCompare(b.data)), [dados]);
  const hoje = dados?.hoje || "";

  // ---- intervalo escolhido
  const periodoIncompleto = modo === "periodo" && (!de || !ate);
  const periodoInvalido = modo === "periodo" && de && ate && de > ate;
  const [ini, fim] = modo === "dia" ? [dia, dia] : [de, ate];
  const doIntervalo = useMemo(() => (ini && fim && ini <= fim ? dias.filter((d) => d.data >= ini && d.data <= fim) : []), [dias, ini, fim]);
  const total = useMemo(() => somar(doIntervalo), [doIntervalo]);
  const diaSel = modo === "dia" ? doIntervalo[0] : null;

  const titulo = modo === "dia" ? (dia ? `${diaSemana(dia)}, ${diaMes(dia)} de ${ano(dia)}` : "")
    : de && ate ? `De ${dataBr(de)} a ${dataBr(ate)}` : "Escolha o período";
  const rotuloTotal = modo === "dia" ? "Baixas importadas no dia" : "Baixas importadas no período";
  const nomeExcel = modo === "dia" ? `Resumo_Baixas_${dia}.xlsx` : `Resumo_Baixas_${de}_a_${ate}.xlsx`;

  // ---- navegação
  const diaAnt = dia ? dias.filter((d) => d.data < dia).at(-1)?.data : null;
  const diaProx = dia ? dias.find((d) => d.data > dia)?.data : null;

  const trocarModo = (m) => {
    if (m === modo) return;
    const base = dia || hoje;
    if (m === "periodo" && !de && !ate) { setDe(`${base.slice(0, 7)}-01`); setAte(base); }
    setModo(m);
    setErroBaixar(null);
  };
  // período: no máximo um mês, sempre dentro do mês da data inicial
  const mudarDe = (v) => {
    setDe(v);
    if (v && (!ate || ate < v || ate.slice(0, 7) !== v.slice(0, 7))) setAte(menor(ultimoDia(v.slice(0, 7)), hoje || v));
  };

  const baixar = async () => {
    setBaixando("Preparando…");
    setErroBaixar(null);
    try { await baixarExcel(doIntervalo, nomeExcel, setBaixando, { desde: dados?.detalheDesde, meses: dados?.manterMeses }); }
    catch (e) { setErroBaixar(e?.paraTela || e?.status ? e.message : "Não foi possível gerar o Excel. Tente de novo."); }
    finally { setBaixando(null); }
  };

  return (
    <>
      <BarraTopo aba={aba} onAba={onAba} />
      <div className="pagina">
        <div className="cabeca-pagina">
          <div>
            <button type="button" className="botao-texto relatorio__voltar" onClick={onVoltar}>← Relatórios</button>
            <h1 className="page-title">Resumo de Baixas</h1>
            <p className="page-sub">{titulo}</p>
          </div>
          <div className="cabeca-pagina__direita filtro-relatorio resumo-baixas__filtro">
            <nav className="navegacao" aria-label="Escolher o período">
              <span className="contexto__seg" role="group" aria-label="Tipo de filtro">
                {[["dia", "Dia"], ["periodo", "Período"]].map(([id, nome]) => (
                  <button key={id} type="button" className={modo === id ? "on" : undefined} aria-pressed={modo === id}
                    onClick={() => trocarModo(id)}>{nome}</button>
                ))}
              </span>
              {modo === "dia" && (
                <>
                  <button type="button" className="btn-icone" onClick={() => setDia(diaAnt)} disabled={!diaAnt} aria-label="Dia anterior">‹</button>
                  <input type="date" value={dia || ""} aria-label="Dia" min={dias[0]?.data} max={hoje}
                    onChange={(e) => e.target.value && setDia(e.target.value)} />
                  <button type="button" className="btn-icone" onClick={() => setDia(diaProx)} disabled={!diaProx} aria-label="Próximo dia">›</button>
                </>
              )}
              {modo === "periodo" && (
                <>
                  <input type="date" value={de} aria-label="De" min={dias[0]?.data} max={hoje} onChange={(e) => mudarDe(e.target.value)} />
                  <span className="periodo__ate">até</span>
                  <input type="date" value={ate} aria-label="Até" min={de || undefined}
                    max={de ? menor(ultimoDia(de.slice(0, 7)), hoje) : hoje} onChange={(e) => setAte(e.target.value)} />
                </>
              )}
            </nav>
            <button type="button" className="button button--pequeno publicacao__baixar"
              disabled={!doIntervalo.length || baixando || periodoInvalido} onClick={baixar}>
              <span aria-hidden="true">↓</span> {baixando || "Baixar Excel"}
            </button>
            {modo === "periodo" && <span className="resumo-baixas__dica">O período vai até, no máximo, o fim do mês da data inicial.</span>}
            {erroBaixar && <span className="resumo-baixas__erro" role="alert">{erroBaixar}</span>}
          </div>
        </div>

        {erro && !dados ? (
          <p className="vazio" role="status">{erro}</p>
        ) : !dados ? (
          <p className="vazio" role="status">Carregando…</p>
        ) : periodoIncompleto ? (
          <p className="vazio">Escolha a data inicial e a final.</p>
        ) : periodoInvalido ? (
          <p className="vazio">A data inicial é depois da data final.</p>
        ) : !doIntervalo.length ? (
          <p className="vazio">Nenhuma baixa importada {modo === "dia" ? "neste dia" : "neste período"}.</p>
        ) : (
          <>
            <section className="card resumo-baixas" aria-label={rotuloTotal}>
              <div className="resumo-baixas__topo">
                <dl className="resumo-baixas__total">
                  <dt>{rotuloTotal}</dt>
                  <dd>{brl(total.valor)}</dd>
                </dl>
                <dl className="resumo-baixas__qtd">
                  <dt>Arquivos importados</dt>
                  <dd>{num(total.arquivos)}</dd>
                </dl>
              </div>
              <dl className="resumo-baixas__lista">
                {total.classificacoes.map((c) => (
                  <div key={c.classificacao} className={`resumo-baixas__linha${c.classificacao === "Não reconhecido" ? " resumo-baixas__linha--alerta" : ""}`}>
                    <dt>{c.classificacao}<small>{plural(c.arquivos, "arquivo", "arquivos")}</small></dt>
                    <dd>{brl(c.valor)}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <p className="resumo-baixas__hora">
              {diaSel ? `Atualizado às ${hhmm(diaSel.gerado)}` : plural(doIntervalo.length, "dia com baixas importadas", "dias com baixas importadas")}
              {" · valores importados, não conciliados."}
            </p>
          </>
        )}
      </div>
    </>
  );
}
