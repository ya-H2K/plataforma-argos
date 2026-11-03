// Mapa de Evolução de Cotas (MEC): todos os usuários veem (liberado em 03/11/2026).
// Pasta de publicados: AAAA\MM\{Sub|Mezanino}\<qualquer nome>.{pdf|html|htm|xlsx|xls|xlsm}.
// A extensão diz o formato (pdf, html ou excel); se houver dois do mesmo formato, vale o mais recente.
import fs from "node:fs/promises";
import path from "node:path";

const sem = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export const COTAS = { sub: "sub", subordinada: "sub", mezanino: "mezanino", mez: "mezanino" };

export function formatoDe(nome) {
  const ext = path.extname(sem(nome)).slice(1);
  if (ext === "pdf") return { formato: "pdf", ext };
  if (ext === "html" || ext === "htm") return { formato: "html", ext: "html" };
  if (["xlsx", "xls", "xlsm"].includes(ext)) return { formato: "excel", ext };
  return null;
}

// { meses: [{ id: "AAAA-MM", cotas: { sub: { pdf?, html?, excel? }, mezanino: {...} } }], ignorados: [] }
export async function listarMec(pasta) {
  await fs.mkdir(pasta, { recursive: true });
  const meses = [];
  const ignorados = [];
  const dirs = async (p) => (await fs.readdir(p, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  for (const ano of await dirs(pasta)) {
    if (!/^\d{4}$/.test(ano)) { ignorados.push(`pasta "${ano}"`); continue; }
    for (const mm of await dirs(path.join(pasta, ano))) {
      const n = Number(mm);
      if (!/^\d{1,2}$/.test(mm) || n < 1 || n > 12) { ignorados.push(`pasta "${ano}\\${mm}"`); continue; }
      const id = `${ano}-${String(n).padStart(2, "0")}`;
      const cotas = {};
      for (const sub of await dirs(path.join(pasta, ano, mm))) {
        const cota = COTAS[sem(sub)];
        if (!cota) { ignorados.push(`pasta "${ano}\\${mm}\\${sub}"`); continue; }
        const dir = path.join(pasta, ano, mm, sub);
        for (const nome of await fs.readdir(dir)) {
          if (nome.startsWith("~$")) continue;
          const caminho = path.join(dir, nome);
          const st = await fs.stat(caminho);
          if (!st.isFile()) continue;
          const f = formatoDe(nome);
          if (!f) { ignorados.push(`${ano}\\${mm}\\${sub}\\${nome}`); continue; }
          cotas[cota] ??= {};
          const atual = cotas[cota][f.formato];
          if (!atual || st.mtimeMs > atual.mtimeMs) cotas[cota][f.formato] = { nome, caminho, ext: f.ext, mtimeMs: st.mtimeMs, bytes: st.size };
        }
      }
      if (Object.keys(cotas).length) meses.push({ id, cotas });
    }
  }
  meses.sort((a, b) => (a.id < b.id ? 1 : -1));
  return { meses, ignorados };
}

// No bucket: mec/AAAA-MM/{sub|mezanino}.{pdf|html|xlsx} (todos os usuários com acesso).
export const caminhoNuvemMec = (id, cota, arq) => `mec/${id}/${cota}.${arq.ext}`;

export const TIPO_MEC = {
  pdf: "application/pdf",
  html: "text/html; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  xls: "application/vnd.ms-excel",
};

export function gerarMec(meses) {
  const limpar = (a) => a && { nome: a.nome, ext: a.ext, bytes: a.bytes, publicadoEm: new Date(a.mtimeMs).toISOString() };
  return { "rel:mec": { meses: meses.map(({ id, cotas }) => ({ id, cotas: Object.fromEntries(
    Object.entries(cotas).map(([c, f]) => [c, { pdf: limpar(f.pdf), html: limpar(f.html), excel: limpar(f.excel) }])) })) } };
}
