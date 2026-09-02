/**
 * Criterio 2 do incremento 6: **nenhum** item da coluna "nao tem" de §10.4
 * existe no painel, conferido item a item.
 *
 *     node scripts/conferir-escopo.mjs
 *
 * Existe como script, e nao como frase num documento, pelo motivo de sempre:
 * uma lista que alguem le uma vez protege contra o que ja foi lembrado; uma
 * varredura protege contra o que alguem colar amanha. Este projeto ja
 * registrou quatro ocorrencias de garantia que parou de garantir em silencio.
 *
 * A busca e por CODIGO, nao por texto: comentario e prosa citando "grants"
 * para explicar que grants nao existem sao legitimos - e ate desejaveis. O
 * que nao pode e o painel ganhar a funcionalidade.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

/** Cada item de §10.4 que a Fase 0 NAO tem, e como ele apareceria no codigo. */
const PROIBIDOS = [
  { item: "manifestos dinamicos", padrao: /\bmanifesto?s?\b/i },
  { item: "gestao de grants", padrao: /\bgrants?\b/i },
  { item: "cofre de credenciais", padrao: /\b(cofre|vault)\b/i },
  { item: "multiplos agentes", padrao: /\bagentes\b|\blista de agentes\b/i },
  { item: "infraestrutura distribuida", padrao: /\b(kubernetes|k8s|orquestrador|worker pool)\b/i },
  { item: "criacao de agentes", padrao: /criar[_ ]?agente|novo[_ ]?agente/i },
  { item: "configuracao de permissoes", padrao: /\bpermiss(ao|oes|ions?)\b|\brole?s\b/i },
  // A ressalva do 05-painel secao 6: o painel edita PARAMETROS do
  // experimento, nunca estrategia. A estrategia vem da reflexao.
  { item: "edicao de estrategia", padrao: /editar[_ ]?(regra|estrategia)|salvar[_ ]?regra/i },
];

/** Linhas que sao comentario ou texto de tela, e nao funcionalidade. */
function ehProsa(linha) {
  const t = linha.trim();
  return (
    t.startsWith("*") ||
    t.startsWith("//") ||
    t.startsWith("/*") ||
    t.startsWith("{/*") ||
    t.startsWith("#")
  );
}

function arquivos(dir, achados = []) {
  for (const nome of readdirSync(dir)) {
    if (["node_modules", ".next", "scripts"].includes(nome)) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, achados);
    else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(nome)))
      achados.push(caminho);
  }
  return achados;
}

const violacoes = [];
for (const caminho of arquivos(".")) {
  const linhas = readFileSync(caminho, "utf8").split("\n");
  linhas.forEach((linha, i) => {
    if (ehProsa(linha)) return;
    for (const { item, padrao } of PROIBIDOS) {
      if (padrao.test(linha)) {
        violacoes.push(`${caminho}:${i + 1}  [${item}]  ${linha.trim().slice(0, 90)}`);
      }
    }
  });
}

console.log("Criterio 2 do incremento 6 — itens de §10.4 que a Fase 0 nao tem:");
for (const { item } of PROIBIDOS) console.log(`  · ${item}`);

if (violacoes.length) {
  console.error(`\nRECUSADO — ${violacoes.length} ocorrencia(s):`);
  for (const v of violacoes) console.error("  " + v);
  process.exit(1);
}
console.log(`\nOK — nenhuma ocorrencia em ${arquivos(".").length} arquivos.`);
