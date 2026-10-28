import { useEffect, useState } from "react";
import { api } from "../api.js";
import { brl } from "../formato.js";
import Carimbo from "./Carimbo.jsx";
import { useSessao } from "../sessao.js";
import { Valor } from "./Animado.jsx";

// Mesmo conteúdo e mesma ordem do "Dashboard Operacional" da planilha.

function CardStatus({ item }) {
  return (
    <div className="card">
      <span className="card__rotulo">{item.nome}</span>
      <Carimbo status={item.status}>{item.rotulo}</Carimbo>
    </div>
  );
}

const plural = (n, um, varios) => (n === 1 ? um : varios);

// O que aparece dentro do card ao clicar: quantidades, sem nomes de arquivos.
function Detalhe({ id, d }) {
  const admin = !!useSessao()?.usuario?.admin;     // nomes dos arquivos da RPE: só o admin vê
  if (!d) return null;
  if (id === "rpe") {
    return (
      <>
        <div className="det__quadros" aria-hidden="true">
          {d.arquivos.map((a) => <i key={a.tipo} className={a.recebido ? "on" : "falta"} title={admin ? a.tipo : undefined} />)}
        </div>
        <span className="det__principal"><b>{d.recebidos} de {d.total}</b> arquivos recebidos</span>
        {admin && d.faltando.length > 0 && <span className="det__nota">Faltam: {d.faltando.join(", ")}</span>}
      </>
    );
  }
  if (id === "bauk") {
    return (
      <>
        <span className="det__principal"><b>{d.arquivos}</b> {plural(d.arquivos, "arquivo gerado", "arquivos gerados")} pela Bauk</span>
        {d.arquivos > 0 && (
          <span className="det__nota">
            {d.tipos} {plural(d.tipos, "tipo de arquivo", "tipos de arquivo")}
          </span>
        )}
      </>
    );
  }
  if (id === "urfa" || id === "endosso") {
    const nome = id === "urfa" ? ["URFA", "URFAs"] : ["endosso", "endossos"];
    if (!d.total) {
      return <span className="det__principal">{id === "urfa" ? "Nenhuma cessão de URFA no dia" : "Nenhum endosso no dia"}</span>;
    }
    const todas = d.liquidadas === d.total;
    const feminino = id === "urfa";
    // concorda com o total: "0 de 1 endosso liquidado", "1 de 2 URFAs liquidadas"
    const liquidada = feminino ? plural(d.total, "liquidada", "liquidadas") : plural(d.total, "liquidado", "liquidados");
    return (
      <>
        <span className="det__principal">
          <b>{d.liquidadas} de {d.total}</b> {plural(d.total, nome[0], nome[1])} {liquidada}{todas ? " com sucesso" : ""}
        </span>
        <div className="det__barra" aria-hidden="true"><i style={{ width: `${(d.liquidadas / d.total) * 100}%` }} /></div>
        {d.fases && (d.fases.aprovacao > 0 || d.fases.liquidacao > 0) && (
          <span className="det__nota">
            Na Bauk: {[d.fases.aprovacao && `${d.fases.aprovacao} aguardando aprovações`,
              d.fases.liquidacao && `${d.fases.liquidacao} aguardando liquidação`].filter(Boolean).join(" · ")}
          </span>
        )}
      </>
    );
  }
  if (id === "baixas") {
    return (
      <>
        <span className="det__principal"><b>{d.principais} de {d.esperadas}</b> baixas principais</span>
        <span className="det__nota">{d.arquivos} {plural(d.arquivos, "arquivo", "arquivos")} de baixa no dia</span>
      </>
    );
  }
  return null;
}

// Hora em que a etapa ficou OK, discreta, no fim do detalhe (só aparece com o card aberto).
const PALAVRA_HORA = { rpe: "completo às", bauk: "arquivos às", urfa: "liquidada às", endosso: "liquidado às", baixas: "concluídas às" };
function HoraEtapa({ id, d }) {
  if (d?.concluidoAs) return <span className="det__hora">{PALAVRA_HORA[id] || "concluído às"} <b>{d.concluidoAs}</b></span>;
  if (id === "rpe" && d?.primeiroAs) return <span className="det__hora">1º arquivo às <b>{d.primeiroAs}</b></span>;
  return null;
}

// Card de processo (1ª linha): clicável, abre o detalhe dentro do próprio card.
function CardProcesso({ item, aberto, onClicar }) {
  return (
    <button type="button" className={`card card--processo${aberto ? " card--aberto" : ""}`}
      aria-expanded={aberto} onClick={onClicar}>
      <span className="card__rotulo">{item.nome}</span>
      <Carimbo status={item.status}>{item.rotulo}</Carimbo>
      {aberto && <div className="det"><Detalhe id={item.id} d={item.detalhe} /><HoraEtapa id={item.id} d={item.detalhe} /></div>}
    </button>
  );
}

function CardValor({ rotulo, valor }) {
  return (
    <div className="card">
      <span className="card__rotulo">{rotulo}</span>
      <Valor className="card__valor" valor={valor} />
    </div>
  );
}

// hora: discreta, à direita do título (Liquidação Total = última liquidação do dia; Baixas Conciliadas =
// hora em que o valor apareceu). Sem hora, o título fica sozinho, como antes.
// Só o admin: clicar em "Baixas Represadas Acumulado" mostra de que pasta (data) e arquivo vem o
// acumulado do dia: as represadas da pasta "represadas" até esse dia que ainda não tinham sido encerradas.
function OrigemRepresadas({ iso }) {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState(false);
  useEffect(() => { api.represadas().then(setItens).catch(() => setErro(true)); }, []);
  const br = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const abertas = (itens || []).filter((r) => r.data <= iso && (!r.encerrada || r.encerrada > iso));
  return (
    <ul className="origem-represadas">
      {erro ? <li>Não foi possível carregar agora.</li>
        : !itens ? <li>Carregando…</li>
        : !abertas.length ? <li>Nenhuma represada em aberto neste dia.</li>
        : abertas.map((r) => <li key={r.data + r.arquivo}><b>{br(r.data)}</b><span>{r.arquivo}</span><em>{brl(r.valor)}</em></li>)}
    </ul>
  );
}

function CardResumo({ rotulo, valor, aguardando, linhas, hora = null, abrivel = null, iso = null }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="card card--resumo">
      <div className="card__topo">
        <span className="card__rotulo">{rotulo}</span>
        {hora && <span className="card__hora">às <b>{hora}</b></span>}
      </div>
      {aguardando
        ? <span className="card__valor card__valor--grande card__valor--aguardando">Aguardando...</span>
        : <Valor className="card__valor card__valor--grande" valor={valor} />}
      <dl className="card__linhas">
        {linhas.map(([nome, v]) => (nome === abrivel ? (
          <div key={nome} className="card__linha-abre">
            <button type="button" className={`card__linha-botao${aberta ? " on" : ""}`} aria-expanded={aberta}
              onClick={() => setAberta((a) => !a)} title="Ver de que pasta e arquivo vem">
              <dt>{nome}<span aria-hidden="true" className="card__seta">▾</span></dt>
              <dd><Valor valor={v} /></dd>
            </button>
            {aberta && <OrigemRepresadas iso={iso} />}
          </div>
        ) : (
          <div key={nome}>
            <dt>{nome}</dt>
            <dd><Valor valor={v} /></dd>
          </div>
        )))}
      </dl>
    </div>
  );
}

// Igual ao quadro da aba "Quadro de Observações" da planilha.
function QuadroObservacoes({ linhas: todas, mostrarResponsavel }) {
  // Só os processos com apontamento; Baixas Represadas aparece sempre.
  const represadas = todas.find((l) => l.processo === "Baixas Represadas");
  const apontamentos = todas.filter((l) => l.processo !== "Baixas Represadas" && l.observacao);
  const linhas = [...apontamentos, ...(represadas ? [{ ...represadas,
    observacao: represadas.observacao || (represadas.rotulo === "Não" ? "Nenhuma baixa represada" : ""),
    semApontamento: !represadas.observacao }] : [])];
  return (
    <section className="card card--quadro" aria-labelledby="titulo-quadro">
      <h2 id="titulo-quadro" className="card__rotulo">Quadro de observações</h2>
      <table className="quadro-obs">
        <thead>
          <tr>
            <th scope="col">Processo</th>
            <th scope="col">Status</th>
            <th scope="col">Observação</th>
            {mostrarResponsavel && <th scope="col">Responsável</th>}
          </tr>
        </thead>
        <tbody>
          {apontamentos.length === 0 && (
            <tr className="quadro-obs__vazio">
              <td colSpan={mostrarResponsavel ? 4 : 3}>Nenhum apontamento nos processos do dia.</td>
            </tr>
          )}
          {linhas.map((l) => (
            <tr key={l.processo} className={l.observacao && !l.semApontamento ? "com-obs" : undefined}>
              <th scope="row">{l.processo}</th>
              <td data-rotulo="Status"><Carimbo status={l.status}>{l.rotulo}</Carimbo></td>
              <td data-rotulo="Observação" className={l.observacao ? undefined : "vazio-cel"}>{l.observacao || "—"}</td>
              {mostrarResponsavel && (
                <td data-rotulo="Responsável" className={l.responsavel ? undefined : "vazio-cel"}>{l.responsavel || "—"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function Report({ dia, mostrarResponsavel = true }) {
  const admin = !!useSessao()?.usuario?.admin;
  const v = dia.valores;
  // Liquidação Total: hora da última liquidação do dia, só quando URFA e Endosso já terminaram
  const liq = dia.processos.filter((p) => p.id === "urfa" || p.id === "endosso");
  const horaLiq = liq.every((p) => p.status === "ok" || p.status === "sem_movimento")
    ? liq.map((p) => p.detalhe?.concluidoAs).filter(Boolean).sort().at(-1) || null : null;
  const [aberto, setAberto] = useState(null);
  const [diaAberto, setDiaAberto] = useState(dia.data);
  if (diaAberto !== dia.data) { setDiaAberto(dia.data); setAberto(null); }
  return (
    <main className="report">
      <section aria-label="Processos">
        <div className="grade grade--5">
          {dia.processos.map((p) => (
            <CardProcesso key={p.id} item={p} aberto={aberto === p.id}
              onClicar={() => setAberto((a) => (a === p.id ? null : p.id))} />
          ))}
        </div>
      </section>

      <section aria-label="Arquivos e valores">
        <div className="grade grade--5">
          {dia.arquivos.map((a) => <CardStatus key={a.id} item={a} />)}
          <CardValor rotulo="Cessão de URFA" valor={v.cessaoUrfa} />
          <CardValor rotulo="Endosso" valor={v.endosso} />
          <CardValor rotulo="Baixas Processadas" valor={v.baixasProcessadas} />
        </div>
      </section>

      <section aria-label="Consolidação">
        <div className="grade grade--2">
          <CardResumo rotulo="Liquidação Total" valor={v.liquidacaoTotal} hora={horaLiq}
            linhas={[["Liquidação Pendente Dia", v.liquidacaoPendenteDia],
                     ["Liquidação Pendente Acumulado", v.liquidacaoPendenteAcumulado]]} />
          <CardResumo rotulo="Baixas Conciliadas" valor={v.baixasConciliadas}
            aguardando={v.baixasConciliadas === null} hora={v.conciliadasAs}
            linhas={[["Baixas Represadas Dia", v.baixasRepresadasDia],
                     ["Baixas Represadas Acumulado", v.baixasRepresadasAcumulado]]}
            abrivel={admin ? "Baixas Represadas Acumulado" : null} iso={dia.data} key={dia.data} />
        </div>
      </section>

      {dia.observacoes && <QuadroObservacoes linhas={dia.observacoes} mostrarResponsavel={mostrarResponsavel} />}
    </main>
  );
}
