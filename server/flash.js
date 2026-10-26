// Flash Report: pasta de publicados com uma subpasta por mês ("2026.01", "2026.02"...) e um PDF dentro
// (qualquer nome). O mês vem da pasta. Se houver mais de um PDF no mês, vale o mais recente.
import fs from "node:fs/promises";
import path from "node:path";

// Devolve { itens: [{ id: "AAAA-MM", nome, caminho, mtimeMs, bytes }], ignorados: [] },
// do mês mais recente para o mais antigo (mesmo formato das apresentações e lâminas).
export async function listarFlash(pasta) {
  const itens = [];
  const ignorados = [];
  for (const d of await fs.readdir(pasta, { withFileTypes: true })) {
    if (d.name.startsWith("~$")) continue;
    const m = d.name.trim().match(/^(\d{4})\.(\d{1,2})$/);
    if (!d.isDirectory() || !m || Number(m[2]) < 1 || Number(m[2]) > 12) { ignorados.push(d.name); continue; }
    const dir = path.join(pasta, d.name);
    let melhor = null;
    for (const nome of await fs.readdir(dir)) {
      if (nome.startsWith("~$")) continue;
      if (!/\.pdf$/i.test(nome)) { ignorados.push(`${d.name}\\${nome}`); continue; }
      const caminho = path.join(dir, nome);
      const st = await fs.stat(caminho);
      if (st.isFile() && (!melhor || st.mtimeMs > melhor.mtimeMs)) melhor = { nome, caminho, mtimeMs: st.mtimeMs, bytes: st.size };
    }
    if (melhor) itens.push({ id: `${m[1]}-${m[2].padStart(2, "0")}`, ...melhor });
  }
  itens.sort((x, y) => (x.id < y.id ? 1 : -1));
  return { itens, ignorados };
}
