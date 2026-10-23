/**
 * DJAZZ CORPO — Backend (Google Apps Script)
 * Recebe registos da PWA (treino, refeição, medida, social), fotos da comida (Drive + Gemini)
 * e dados do relógio (Mi Fitness via Health Connect). Guarda na Sheet; a ponte.py leva para Corpo.xlsx.
 * Sem aprovação: o que entra conta. Apagar = estado 'apagado' (a linha fica).
 *
 * Instalação:
 * 1. Cria uma Google Sheet nova ("DJazz — Corpo").
 * 2. Extensões → Apps Script → cola este ficheiro (ou clasp push).
 * 3. Propriedades do script: TOKEN = senha longa; GEMINI_KEY = chave Gemini (só para fotos);
 *    opcional GEMINI_MODELO (por defeito gemini-2.5-flash).
 * 4. Corre autorizar() uma vez no editor (Sheets + Drive + pedidos externos).
 * 5. Implementar → Nova implementação → Aplicação Web (Executar como: Eu | Acesso: Qualquer pessoa).
 */

const SHEET = 'Registos';
const PASTA_FOTOS = 'DJazz — fotos da comida'; // pasta privada no Drive de quem implementa
const TIPOS = ['treino', 'refeicao', 'medida', 'social', 'saude'];
const HEAD = ['id', 'data', 'hora', 'tipo', 'item', 'valor', 'unidade', 'series', 'reps',
  'duracao_min', 'proteina_g', 'kcal', 'descricao', 'origem', 'confianca', 'foto', 'estado',
  'criado_em', 'actualizado_em'];
const COL = Object.fromEntries(HEAD.map((h, i) => [h, i]));
const NUMS = ['valor', 'series', 'reps', 'duracao_min', 'proteina_g', 'kcal'];
const EDITAVEIS = ['data', 'hora', 'item', 'valor', 'unidade', 'series', 'reps', 'duracao_min',
  'proteina_g', 'kcal', 'descricao'];

/* ---------- utilitários ---------- */
function sh_() {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(SHEET);
  if (!s) {
    s = ss.insertSheet(SHEET);
    s.appendRow(HEAD);
    s.setFrozenRows(1);
    s.getRange('A:C').setNumberFormat('@'); // id, data e hora como texto (senão a data anda um dia para trás)
  }
  return s;
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function auth_(t) { const tok = prop_('TOKEN'); return !!tok && t === tok; }
function agora_() { return Utilities.formatDate(new Date(), 'Africa/Maputo', "yyyy-MM-dd'T'HH:mm:ss"); }
function hoje_() { return Utilities.formatDate(new Date(), 'Africa/Maputo', 'yyyy-MM-dd'); }
function txt_(v, f) { return v instanceof Date ? Utilities.formatDate(v, 'Africa/Maputo', f) : String(v || ''); }
function uid_() { return Utilities.getUuid().slice(0, 8); }
function linha_(id) {
  const f = sh_().getRange('A:A').createTextFinder(String(id)).matchEntireCell(true).findNext();
  return f ? f.getRow() : 0;
}
function obj_(r) {
  const o = {};
  HEAD.forEach((h, i) => o[h] = r[i]);
  o.data = txt_(o.data, 'yyyy-MM-dd');
  o.hora = txt_(o.hora, 'HH:mm');
  NUMS.forEach(k => o[k] = o[k] === '' || o[k] === null ? '' : Number(o[k]) || 0);
  return o;
}
function linhas_() {
  const s = sh_();
  const n = s.getLastRow();
  return n > 1 ? s.getRange(2, 1, n - 1, HEAD.length).getValues().map(obj_) : [];
}
function numOuVazio_(v) { return v === '' || v === null || v === undefined ? '' : Number(v) || 0; }

/** Normaliza um registo vindo da PWA ou do relógio. Lança erro se o tipo for inválido. */
function normalizar_(r) {
  if (TIPOS.indexOf(r.tipo) < 0) throw new Error('tipo inválido: ' + r.tipo);
  const o = {};
  HEAD.forEach(h => o[h] = r[h] === undefined || r[h] === null ? '' : r[h]);
  NUMS.forEach(k => o[k] = numOuVazio_(o[k]));
  o.data = o.data || hoje_();
  o.hora = String(o.hora || '').slice(0, 5);
  o.origem = o.origem || 'manual';
  o.estado = 'activo';
  return o;
}

/* ---------- entradas HTTP ---------- */
/** Corre uma vez no editor para o Google pedir as permissões e criar a folha e a pasta. */
function autorizar() {
  const s = sh_();
  pasta_();
  UrlFetchApp.getRequest('https://generativelanguage.googleapis.com/'); // pede a permissão de pedidos externos
  Logger.log('OK — folha "%s" com %s linha(s). TOKEN: %s · GEMINI_KEY: %s',
    SHEET, s.getLastRow(), !!prop_('TOKEN'), !!prop_('GEMINI_KEY'));
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!auth_(p.token)) return out_({ ok: false, erro: 'token inválido' });
  if (p.acao === 'listar') return out_(listar_(Number(p.dias) || 14));
  if (p.acao === 'todos') return out_({ ok: true, registos: linhas_() }); // inclui apagados: a ponte precisa deles
  return out_({ ok: true, servico: 'djazz-corpo' });
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, erro: 'json inválido' }); }
  if (!auth_(b.token)) return out_({ ok: false, erro: 'token inválido' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (b.acao) {
      case 'registar': return out_(registar_(b.reg || {}));
      case 'corrigir': return out_(corrigir_(b.id, b.reg || {}));
      case 'apagar':   return out_(apagar_(b.id));
      case 'saude':    return out_(saude_(b.regs || []));
      case 'foto':     return out_(foto_(b));
      default:         return out_({ ok: false, erro: 'acção desconhecida' });
    }
  } catch (x) {
    return out_({ ok: false, erro: String(x.message || x) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- acções ---------- */
function registar_(r) {
  const id = r.id || uid_();
  if (linha_(id)) return { ok: true, id, duplicado: true }; // idempotente (fila offline e relógio)
  const o = normalizar_(Object.assign({}, r, { id }));
  const t = agora_();
  o.criado_em = t; o.actualizado_em = t;
  sh_().appendRow(HEAD.map(h => o[h]));
  return { ok: true, id };
}

function corrigir_(id, r) {
  const n = linha_(id);
  if (!n) return { ok: false, erro: 'registo não encontrado' };
  const s = sh_();
  const row = obj_(s.getRange(n, 1, 1, HEAD.length).getValues()[0]);
  EDITAVEIS.forEach(k => { if (r[k] !== undefined && r[k] !== null) row[k] = NUMS.indexOf(k) >= 0 ? numOuVazio_(r[k]) : r[k]; });
  if (row.origem === 'foto') row.confianca = 'corrigido';
  row.actualizado_em = agora_();
  s.getRange(n, 1, 1, 3).setNumberFormat('@');
  s.getRange(n, 1, 1, HEAD.length).setValues([HEAD.map(h => row[h])]);
  return { ok: true, id };
}

function apagar_(id) {
  const n = linha_(id);
  if (!n) return { ok: false, erro: 'registo não encontrado' };
  const s = sh_();
  s.getRange(n, COL.estado + 1).setValue('apagado');
  s.getRange(n, COL.actualizado_em + 1).setValue(agora_());
  return { ok: true, id };
}

/** Lote do relógio (Mi Fitness → Health Connect → exportação). O id vem da origem: repetir não duplica. */
function saude_(regs) {
  let novos = 0, repetidos = 0;
  regs.forEach(r => {
    if (!r.id) throw new Error('registo do relógio sem id');
    const x = registar_(Object.assign({}, r, { tipo: 'saude', origem: r.origem || 'mifitness' }));
    x.duplicado ? repetidos++ : novos++;
  });
  return { ok: true, novos, repetidos };
}

/** Painel da PWA: registos activos dos últimos N dias. */
function listar_(dias) {
  const desde = Utilities.formatDate(new Date(Date.now() - dias * 864e5), 'Africa/Maputo', 'yyyy-MM-dd');
  const regs = linhas_().filter(r => r.estado === 'activo' && r.data >= desde)
    .sort((a, b) => (b.data + b.hora + b.criado_em).localeCompare(a.data + a.hora + a.criado_em));
  return { ok: true, registos: regs };
}

/* ---------- fotos da comida ---------- */
function pasta_() {
  const it = DriveApp.getFoldersByName(PASTA_FOTOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PASTA_FOTOS);
}

const PROMPT_FOTO = 'És um assistente de registo alimentar. Olha para a foto e descreve a refeição em português ' +
  '(curto, ex.: "arroz, feijão e frango grelhado"). Estima de forma aproximada a proteína (g) e a energia (kcal) ' +
  'da porção visível. Se não for comida ou não se perceber, diz isso em "descricao" e põe confianca "baixa". ' +
  'Responde só com JSON: {"descricao": "...", "proteina_g": 0, "kcal": 0, "confianca": "alta|media|baixa"}';

/** Recebe {id, data, hora, item, imagem (base64 jpeg)}: guarda no Drive, pede a estimativa ao Gemini, regista. */
function foto_(b) {
  const id = b.id || uid_();
  if (linha_(id)) return { ok: true, id, duplicado: true };
  if (!b.imagem) return { ok: false, erro: 'sem imagem' };
  const blob = Utilities.newBlob(Utilities.base64Decode(b.imagem), 'image/jpeg', (b.data || hoje_()) + '_' + id + '.jpg');
  const f = pasta_().createFile(blob); // fica privado (só o dono do Drive)
  let est = { descricao: 'foto por analisar', proteina_g: '', kcal: '', confianca: 'baixa' };
  try { est = lerGemini_(gemini_(b.imagem)); } catch (x) { est.descricao = 'análise falhou: ' + String(x.message || x).slice(0, 80); }
  return Object.assign(registar_({
    id, tipo: 'refeicao', data: b.data, hora: b.hora, item: b.item || 'Refeição',
    descricao: est.descricao, proteina_g: est.proteina_g, kcal: est.kcal,
    origem: 'foto', confianca: est.confianca, foto: f.getId()
  }), { estimativa: est });
}

function gemini_(b64) {
  const key = prop_('GEMINI_KEY');
  if (!key) throw new Error('GEMINI_KEY por definir');
  const modelo = prop_('GEMINI_MODELO') || 'gemini-2.5-flash';
  const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-goog-api-key': key }, // a chave no cabeçalho, nunca no URL (não aparece em registos)
    payload: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT_FOTO }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    })
  });
  if (r.getResponseCode() !== 200) throw new Error('Gemini HTTP ' + r.getResponseCode());
  return JSON.parse(r.getContentText()).candidates[0].content.parts[0].text;
}

/** Lê a resposta do Gemini (JSON, às vezes dentro de ```json). Valores absurdos ficam vazios. */
function lerGemini_(texto) {
  const m = String(texto || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('resposta sem JSON');
  const j = JSON.parse(m[0]);
  const lim = (v, max) => { const n = Number(v); return isFinite(n) && n >= 0 && n <= max ? Math.round(n) : ''; };
  const conf = ['alta', 'media', 'baixa'].indexOf(String(j.confianca || '').toLowerCase().replace('é', 'e')) >= 0
    ? String(j.confianca).toLowerCase().replace('é', 'e') : 'baixa';
  return {
    descricao: String(j.descricao || '').trim().slice(0, 200) || 'sem descrição',
    proteina_g: lim(j.proteina_g, 300),
    kcal: lim(j.kcal, 5000),
    confianca: conf
  };
}
