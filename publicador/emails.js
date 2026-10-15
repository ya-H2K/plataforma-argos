// E-mail de "acesso liberado": quando o admin aprova um novo acesso no site, o publicador
// percebe (confere a cada minuto) e envia o aviso pelo Outlook deste PC, da sua própria conta.
// Ligar/desligar: EMAIL_ACESSO=true|false no .env. Cópia para alguém: EMAIL_ACESSO_CC.
// Teste (manda um exemplo para o endereço informado):  node publicador/emails.js --teste voce@h2kapital.com.br
// Prévia sem enviar (grava publicador/email/previa.html):  node publicador/emails.js --previa
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const PASTA = path.dirname(fileURLToPath(import.meta.url));
const ARQ_ESTADO = path.join(PASTA, ".emails-acesso.json");
const SCRIPT = path.join(PASTA, "email", "enviar-outlook.ps1");
// Endereço do site no e-mail (repositório "plataforma-argos" desde 15/10/2026). Pode ser trocado por SITE_URL no .env.
const SITE = () => (process.env.SITE_URL || "https://ya-h2k.github.io/plataforma-argos/").trim();
const MAX_TENTATIVAS = 5;

export const emailLigado = () => (process.env.EMAIL_ACESSO || "true").toLowerCase() !== "false";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";

// Corpo do e-mail (Plataforma Argos): tabelas e estilos inline (o Outlook ignora CSS moderno).
// Cabeçalho escuro com H2 Kapital + Argos à esquerda e a marca do Vox FIDC à direita.
// As imagens vão embutidas no e-mail (cid:...), não como anexo.
export const IMAGENS = [
  { cid: "logo-h2", arquivo: "h2-kapital.png" },
  { cid: "argos-olho", arquivo: "argos-olho.png" },
  { cid: "vox-fidc", arquivo: "vox-fidc.png" },
];
const cids = Object.fromEntries(IMAGENS.map((i) => [i.cid, `cid:${i.cid}`]));

export function htmlAcesso({ nome, email, site = SITE(), img = cids }) {
  const fonte = "'Segoe UI', Arial, sans-serif";
  const ola = primeiroNome(nome) ? `Olá, ${esc(primeiroNome(nome))}` : "Olá";
  const curto = esc(site.replace(/^https?:\/\//, "").replace(/\/$/, ""));
  return `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f2ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f2ec;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid #e3dccd;">
    <tr><td bgcolor="#15130f" style="background:#15130f;padding:20px 30px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="vertical-align:middle;"><img src="${img["logo-h2"]}" width="41" height="44" alt="H2 Kapital" style="display:block;border:0;"></td>
            <td style="vertical-align:middle;padding:0 14px;"><div style="width:1px;height:32px;background:#3a3326;"></div></td>
            <td style="vertical-align:middle;"><img src="${img["argos-olho"]}" width="26" height="26" alt="" style="display:block;border:0;"></td>
            <td style="vertical-align:middle;padding-left:10px;font-family:${fonte};font-size:18px;font-weight:600;letter-spacing:6px;color:#c9a35c;">ARGOS</td>
          </tr></table>
        </td>
        <td align="right" style="vertical-align:middle;"><img src="${img["vox-fidc"]}" width="80" height="36" alt="Vox FIDC" style="display:block;border:0;"></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:32px 36px 8px 36px;font-family:${fonte};">
      <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#a8812f;">Acesso liberado · Vox FIDC</p>
      <h1 style="margin:0 0 18px 0;font-size:22px;line-height:29px;font-weight:600;color:#1f1b14;">${ola}, seu acesso à Plataforma Argos foi aprovado.</h1>
      <p style="margin:0 0 14px 0;font-size:15px;line-height:23px;color:#3d372c;">No Argos você acompanha o Vox FIDC: os reports diários da operação, o fluxo de caixa e os relatórios do fundo.</p>
      <p style="margin:0 0 26px 0;font-size:15px;line-height:23px;color:#3d372c;">Para entrar, use o e-mail <b style="color:#1f1b14;">${esc(email)}</b> e a senha que você cadastrou ao pedir o acesso.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="#a8812f" style="background:#a8812f;">
          <a href="${esc(site)}" style="display:inline-block;padding:13px 30px;font-family:${fonte};font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none;">Acessar o Argos</a>
        </td>
      </tr></table>
      <p style="margin:18px 0 0 0;font-size:12px;line-height:18px;color:#6f6656;">Ou copie o endereço: <a href="${esc(site)}" style="color:#a8812f;">${curto}</a></p>
    </td></tr>
    <tr><td style="padding:24px 36px 30px 36px;font-family:${fonte};">
      <p style="margin:0;padding-top:18px;border-top:1px solid #e3dccd;font-size:12px;line-height:18px;color:#6f6656;">Esqueceu a senha? Na tela de entrada, use "Esqueci minha senha". O pedido passa por aprovação antes de valer.</p>
    </td></tr>
  </table>
  <p style="margin:16px 0 0 0;font-family:${fonte};font-size:11px;color:#9a917f;">H2 Kapital · Plataforma Argos · Vox FIDC · Aviso automático</p>
</td></tr></table></body></html>`;
}

function lerEstado() {
  try { return JSON.parse(fs.readFileSync(ARQ_ESTADO, "utf-8")); } catch { return null; }
}
function salvarEstado(e) { fs.writeFileSync(ARQ_ESTADO, JSON.stringify(e, null, 1), "utf-8"); }

function enviarPeloOutlook({ to, subject, html }) {
  const tmp = path.join(os.tmpdir(), `vox-email-${Date.now()}.json`);
  const cc = (process.env.EMAIL_ACESSO_CC || "").trim();
  const imagens = IMAGENS.map((i) => ({ cid: i.cid, caminho: path.join(PASTA, "email", i.arquivo) }));
  fs.writeFileSync(tmp, JSON.stringify({ to, cc, subject, html, imagens }), "utf-8");
  return new Promise((ok, falha) => {
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SCRIPT, "-Arquivo", tmp],
      { timeout: 90 * 1000, windowsHide: true }, (err, stdout, stderr) => {
        fs.rm(tmp, { force: true }, () => {});
        if (err) return falha(new Error((stderr || err.message).trim().split(/\r?\n/).slice(0, 3).join(" ")));
        ok(stdout);
      });
  });
}

export const ASSUNTO = "Acesso liberado – Plataforma Argos · Vox FIDC";

// Confere os acessos aprovados e manda o aviso para quem ainda não recebeu.
// Na primeira vez, guarda a hora atual: só aprovações a partir dela recebem e-mail
// (quem já tinha acesso antes não recebe nada).
export async function avisarAprovados(sb, { log = console.log, aviso = console.warn } = {}) {
  if (!emailLigado()) return;
  let estado = lerEstado();
  if (!estado) {
    estado = { desde: new Date().toISOString(), enviados: {}, falhas: {} };
    salvarEstado(estado);
    log("E-mails de acesso liberado: ligados. Aprovações a partir de agora recebem o aviso pelo Outlook.");
  }
  const { data, error } = await sb.from("perfis").select("id, nome, email, aprovado_em")
    .eq("status", "ativo").eq("admin", false).gte("aprovado_em", estado.desde);
  if (error) throw new Error(error.message);
  for (const p of data || []) {
    if (estado.enviados[p.id] || (estado.falhas[p.id] || 0) >= MAX_TENTATIVAS || !p.email) continue;
    try {
      await enviarPeloOutlook({ to: p.email, subject: ASSUNTO, html: htmlAcesso({ nome: p.nome, email: p.email }) });
      estado.enviados[p.id] = { email: p.email, em: new Date().toISOString() };
      delete estado.falhas[p.id];
      log(`E-mail de acesso liberado enviado para ${p.nome} (${p.email}).`);
    } catch (e) {
      const n = (estado.falhas[p.id] = (estado.falhas[p.id] || 0) + 1);
      aviso(`Não consegui enviar o e-mail de acesso para ${p.email} pelo Outlook (${e.message}).`
        + (n >= MAX_TENTATIVAS ? " Desisti depois de 5 tentativas: envie à mão." : " Tento de novo em 1 minuto."));
    }
    salvarEstado(estado);
  }
}

// ---- uso direto: teste e prévia ----
const direto = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (direto) {
  const args = process.argv.slice(2);
  if (args.includes("--previa")) {
    const img = Object.fromEntries(IMAGENS.map((i) => [i.cid,
      "data:image/png;base64," + fs.readFileSync(path.join(PASTA, "email", i.arquivo)).toString("base64")]));
    const saida = path.join(PASTA, "email", "previa.html");
    fs.writeFileSync(saida, htmlAcesso({ nome: "Maria Souza", email: "maria.souza@exemplo.com.br", img }), "utf-8");
    console.log(`Prévia gravada em ${saida}`);
  } else if (args.includes("--teste")) {
    const para = args[args.indexOf("--teste") + 1];
    if (!para || !para.includes("@")) { console.error("Informe o e-mail: node publicador/emails.js --teste voce@h2kapital.com.br"); process.exit(1); }
    enviarPeloOutlook({ to: para, subject: `[Teste] ${ASSUNTO}`, html: htmlAcesso({ nome: "Teste", email: para }) })
      .then(() => console.log(`Enviado para ${para}. Confira a caixa de entrada.`))
      .catch((e) => { console.error(`Falhou: ${e.message}`); process.exit(1); });
  }
}
