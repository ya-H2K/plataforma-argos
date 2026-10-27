import { useCallback, useMemo, useState } from "react";
import { apiRelatorios } from "../api.js";
import { BarraTopo } from "./Cabecalho.jsx";
import { useAutoAtualizacao } from "../hooks/useAutoAtualizacao.js";
import { ano, brl, diaMes, diaSemana, num } from "../formato.js";
import SeletorMes from "./SeletorMes.jsx";

// Relatório restrito "Resumo de Baixas": o que foi IMPORTADO (arquivos da pasta "com financeiro"),
// separado pela classificação do arquivo. Não é o valor conciliado.
// A automação do PC (C:\Automacao\Vox\resumo_baixas.py) grava um resumo por dia; o publicador manda
// todos na chave "restrito:baixas" (só o admin e os e-mails liberados em relatorio_acesso recebem).
// Filtro: um dia, um mês ou um período dentro de um mesmo mês (o Excel nunca passa de um mês).

const ORDEM = ["Baixas padrão do dia", "Baixa de vencidos", "Baixa manual", "Baixa Bauk ajustada", "Ajuste", "Não reconhecido"];
const NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const rotuloMes = (id) => `${NOMES_MES[Number(id.slice(5, 7)) - 1]} ${id.slice(0, 4)}`;
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

// Excel simples: Data | Arquivo | Tipo de baixa | Classificação | Valor (R$).
async function baixarExcel(dias, nomeArquivo) {
  const mod = await import("exceljs");
  const ExcelJS = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Baixas", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  ws.columns = [
    { header: "Data", key: "data", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Arquivo", key: "arquivo", width: 46 },
    { header: "Tipo de baixa", key: "tipoBaixa", width: 14 },
    { header: "Classificação", key: "classificacao", width: 24 },
    { header: "Valor (R$)", key: "valor", width: 18, style: { numFmt: "#,##0.00" } },
  ];
  for (const d of dias) {
    const [a, m, dd] = d.data.split("-").map(Number);
    for (const l of d.linhas || []) {
      ws.addRow({ data: new Date(Date.UTC(a, m - 1, dd)), arquivo: l.arquivo, tipoBaixa: l.tipoBaixa,
        classificacao: l.classificacao, valor: l.valor });
    }
  }

  // sem linha de total e sem linhas de grade/bordas: só o cabeçalho escuro e os dados
  const cab = ws.getRow(1);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.eachCell((c, i) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F1B14" } };
    c.alignment = { horizontal: i === 5 ? "right" : "left" };
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: 5 } };

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
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
  const [modo, setModo] = useState("dia");             // "dia" | "mes" | "periodo"
  const [dia, setDia] = useState(null);
  const [mes, setMes] = useState(null);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [baixando, setBaixando] = useState(false);
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
      setMes((s) => s ?? inicial.slice(0, 7));
    } catch (e) {
      setErro(e.message);
      throw e;
    }
  }, []);
  const intervaloMs = (meta?.intervaloAtualizacaoMin || 10) * 60 * 1000;
  useAutoAtualizacao(buscar, { chave: "baixas", intervaloMs, temDados: Boolean(dados) });

  const dias = useMemo(() => [...(dados?.dias || [])].sort((a, b) => a.data.localeCompare(b.data)), [dados]);
  const hoje = dados?.hoje || "";
  const meses = useMemo(() => [...new Set(dias.map((d) => d.data.slice(0, 7)))].sort(), [dias]);

  // ---- intervalo escolhido
  const periodoIncompleto = modo === "periodo" && (!de || !ate);
  const periodoInvalido = modo === "periodo" && de && ate && de > ate;
  const [ini, fim] = modo === "dia" ? [dia, dia]
    : modo === "mes" ? (mes ? [`${mes}-01`, ultimoDia(mes)] : [null, null])
    : [de, ate];
  const doIntervalo = useMemo(() => (ini && fim && ini <= fim ? dias.filter((d) => d.data >= ini && d.data <= fim) : []), [dias, ini, fim]);
  const total = useMemo(() => somar(doIntervalo), [doIntervalo]);
  const diaSel = modo === "dia" ? doIntervalo[0] : null;

  const titulo = modo === "dia" ? (dia ? `${diaSemana(dia)}, ${diaMes(dia)} de ${ano(dia)}` : "")
    : modo === "mes" ? (mes ? rotuloMes(mes) : "")
    : de && ate ? `De ${dataBr(de)} a ${dataBr(ate)}` : "Escolha o período";
  const rotuloTotal = { dia: "Baixas importadas no dia", mes: "Baixas importadas no mês", periodo: "Baixas importadas no período" }[modo];
  const nomeExcel = modo === "dia" ? `Resumo_Baixas_${dia}.xlsx`
    : modo === "mes" ? `Resumo_Baixas_${mes}.xlsx` : `Resumo_Baixas_${de}_a_${ate}.xlsx`;

  // ---- navegação
  const diaAnt = dia ? dias.filter((d) => d.data < dia).at(-1)?.data : null;
  const diaProx = dia ? dias.find((d) => d.data > dia)?.data : null;
  const iMes = meses.indexOf(mes);
  const mesAnt = iMes > 0 ? meses[iMes - 1] : (iMes < 0 ? meses.filter((m) => m < mes).at(-1) : null);
  const mesProx = iMes >= 0 && iMes < meses.length - 1 ? meses[iMes + 1] : (iMes < 0 ? meses.find((m) => m > mes) : null);

  const trocarModo = (m) => {
    if (m === modo) return;
    const base = dia || hoje;
    if (m === "mes") setMes(base.slice(0, 7));
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
    setBaixando(true);
    setErroBaixar(null);
    try { await baixarExcel(doIntervalo, nomeExcel); }
    catch { setErroBaixar("Não foi possível gerar o Excel. Tente de novo."); }
    finally { setBaixando(false); }
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
          <div className="cabeca-pagina__direita filtro-relatorio">
            <nav className="navegacao" aria-label="Escolher o período">
              <span className="contexto__seg" role="group" aria-label="Tipo de filtro">
                {[["dia", "Dia"], ["mes", "Mês"], ["periodo", "Período"]].map(([id, nome]) => (
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
              {modo === "mes" && (
                <>
                  <button type="button" className="btn-icone" onClick={() => setMes(mesAnt)} disabled={!mesAnt} aria-label="Mês anterior">‹</button>
                  <SeletorMes meses={meses} valor={mes} onChange={setMes} rotulo={rotuloMes} />
                  <button type="button" className="btn-icone" onClick={() => setMes(mesProx)} disabled={!mesProx} aria-label="Próximo mês">›</button>
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
              <span aria-hidden="true">↓</span> {baixando ? "Gerando…" : "Baixar Excel"}
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
          <p className="vazio">Nenhuma baixa importada {modo === "dia" ? "neste dia" : modo === "mes" ? "neste mês" : "neste período"}.</p>
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
