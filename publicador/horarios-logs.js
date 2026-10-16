// Recupera dos registros do preenchimento (preencher_fluxo_operacional_vox.py) a hora em que as
// liquidações saíram e as Baixas Conciliadas foram preenchidas, para os dias em que o publicador
// não viu a mudança (antes de existir o registro, ou com o publicador fechado).
//
// Os registros ficam em <pasta da planilha>\_automacao\logs\log_preenchimento_AAAA-MM-DD.txt
// (o Python guarda os últimos 15 dias). Cada execução começa com
//   ##### Execução em 16/10/2026 13:15:02 #####
// e a hora usada é a da primeira execução em que a informação aparece (o Python roda a cada 5 min,
// então a hora real fica até 5 minutos antes).
//   URFA 11335: SAIU -> Sim ...                      -> liquidação daquela operação
//   Liquidação Endosso: operação 902 (...) saiu da conta -> Sim ...
//   Aceitas-Rejeitadas: C123 = 13.786.843,72 (extrato)   ou   Aceitas-Rejeitadas: linha 123, C = ...
import fs from "node:fs";
import path from "node:path";

const CABECALHO = /^#####\s*Execução em (\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/;
const SAIU_LISTA = /^\s*(URFA|Endosso)\s+(\S+):.*SAIU -> Sim/;
const SAIU_CONF = /^\s*Liquidação (URFA|Endosso): operação (\S+) .*saiu da conta -> Sim/;
const CONCILIADAS = /^\s*Aceitas-Rejeitadas: (?:C\d+ = |linha \d+, C = )/;

export function pastaLogsPreenchimento(planilha) {
  return process.env.LOGS_PREENCHIMENTO || path.join(path.dirname(planilha), "_automacao", "logs");
}

// { "AAAA-MM-DD": { urfa: "HH:MM", endosso: "HH:MM", conciliadas: "HH:MM" } }
export function horariosDosLogs(pasta) {
  const saida = {};
  let nomes = [];
  try { nomes = fs.readdirSync(pasta).filter((n) => /^log_preenchimento_\d{4}-\d{2}-\d{2}\.txt$/.test(n)); }
  catch { return saida; }                                   // pasta inacessível (H: fora do ar)
  for (const nome of nomes) {
    const iso = nome.slice(18, 28);
    let texto;
    try { texto = fs.readFileSync(path.join(pasta, nome), "utf-8"); } catch { continue; }
    let hora = null;                                        // hora da execução atual (só do próprio dia)
    const primeira = { urfa: {}, endosso: {} };             // operação -> 1ª hora em que saiu
    let conciliadas = null;
    for (const linha of texto.split(/\r?\n/)) {
      const c = linha.match(CABECALHO);
      if (c) { hora = `${c[3]}-${c[2]}-${c[1]}` === iso ? `${c[4]}:${c[5]}` : null; continue; }
      if (!hora) continue;
      const s = linha.match(SAIU_LISTA) || linha.match(SAIU_CONF);
      if (s) {
        const tipo = s[1].toLowerCase() === "urfa" ? "urfa" : "endosso";
        primeira[tipo][s[2]] ??= hora;
        continue;
      }
      if (!conciliadas && CONCILIADAS.test(linha)) conciliadas = hora;
    }
    const dia = {};
    for (const tipo of ["urfa", "endosso"]) {
      const horas = Object.values(primeira[tipo]).sort();
      if (horas.length) dia[tipo] = horas.at(-1);          // a etapa termina com a última operação
    }
    if (conciliadas) dia.conciliadas = conciliadas;
    if (Object.keys(dia).length) saida[iso] = dia;
  }
  return saida;
}
