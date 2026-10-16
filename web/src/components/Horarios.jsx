import { useEffect, useState } from "react";
import { api } from "../api.js";

// Aba "Horários" do Report (só o admin vê): linha do tempo do dia, com a hora em que cada etapa
// ficou OK e, na Extração RPE, a hora em que cada arquivo chegou ao SFTP da Fiabilite.
const DESCRICAO = {
  rpe: (d) => `${d.recebidos} de ${d.total} arquivos recebidos`,
  bauk: (d) => `${d.arquivos} ${d.arquivos === 1 ? "arquivo gerado" : "arquivos gerados"}`,
  urfa: () => "saída confirmada no extrato",
  endosso: () => "saída confirmada no extrato",
  baixas: (d) => `${d.principais} de ${d.esperadas} baixas principais`,
  conciliadas: () => "valor preenchido na planilha",
};

export default function Horarios({ dia }) {
  const [rpe, setRpe] = useState(null);
  const [erro, setErro] = useState(false);

  // Recarrega junto com o dia (o Report atualiza o "dia" a cada nova publicação).
  useEffect(() => {
    let vivo = true;
    api.horarios(dia.data)
      .then((r) => { if (vivo) { setRpe(r.rpe || []); setErro(false); } })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [dia]);

  // Baixas Conciliadas entra na linha do tempo junto com as etapas
  const conciliadas = { id: "conciliadas", nome: "Baixas Conciliadas", detalhe: { concluidoAs: dia.valores?.conciliadasAs || null },
    status: dia.valores?.baixasConciliadas == null ? "aguardando" : "ok", rotulo: "Aguardando informações" };
  const etapas = [...dia.processos, conciliadas];
  const comHora = etapas.filter((p) => p.detalhe?.concluidoAs);
  const semHora = etapas.filter((p) => !p.detalhe?.concluidoAs);
  // Tudo numa lista só, em ordem de horário; no empate, o arquivo RPE vem antes da etapa.
  const linhas = [
    ...(rpe || []).map((a) => ({ sub: true, hora: a.hora, nome: a.tipo, chave: `rpe-${a.tipo}` })),
    ...comHora.map((p) => ({ hora: p.detalhe.concluidoAs, nome: p.nome, desc: DESCRICAO[p.id]?.(p.detalhe), chave: p.id })),
  ].sort((a, b) => (a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : Number(!a.sub) - Number(!b.sub)));

  return (
    <main className="report">
      <p className="so-celular aviso-computador"><b>Melhor no computador</b>A linha do tempo dos horários precisa de mais largura. Abra o Argos no computador para ver esta aba.</p>
      <section className="tl so-computador" aria-label="Horários do dia">
        {linhas.length === 0 && !dia.temDados ? (
          <p className="tl__vazio">Nenhum horário registrado neste dia.</p>
        ) : (
          <ol>
            {linhas.map((l) => (
              <li key={l.chave} className={l.sub ? "tl__sub" : undefined}>
                <time>{l.hora}</time>
                <span className="tl__ponto" aria-hidden="true" />
                <span className="tl__nome">{l.nome}</span>
                <span className="tl__desc">{l.desc || ""}</span>
              </li>
            ))}
            {semHora.map((p) => (
              <li key={p.id} className="tl__pendente">
                <time>—</time>
                <span className="tl__ponto" aria-hidden="true" />
                <span className="tl__nome">{p.nome}</span>
                <span className="tl__desc">{p.status === "ok" ? "sem horário registrado" : p.rotulo}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="tl__nota">
          Hora em que cada etapa ficou OK. Na Extração RPE, a hora em que cada arquivo chegou ao SFTP da Fiabilite.
          {erro && " Não consegui carregar os horários dos arquivos agora."}
        </p>
      </section>
    </main>
  );
}
