/**
 * Criterio 1 do incremento 6: os nove blocos de `05-painel.md` secao 6 estao
 * todos na tela, e cada um em uma secao que existe de verdade.
 *
 *     node scripts/conferir-blocos.mjs
 *
 * Por que existe: a tela foi reorganizada por PERGUNTA, e nao pela numeracao
 * do documento. Reorganizar e legitimo - o usuario autorizou explicitamente -
 * mas troca uma conferencia trivial ("estao na ordem 1 a 9?") por uma que
 * depende de um mapa. Mapa que ninguem confere e mapa que envelhece.
 *
 * Este arquivo nasceu de um defeito real: `BLOCOS` foi escrito com um
 * comentario dizendo "ha teste conferindo", e nao havia. A constante estava
 * declarada e nunca lida. E a quinta vez que este projeto encontra uma
 * garantia que parou de garantir - ou que nunca comecou.
 */

import { readFileSync } from "node:fs";

const fonte = readFileSync("app/secoes.tsx", "utf8");
const pagina = readFileSync("app/page.tsx", "utf8");

/** Extrai o corpo de `export const NOME: ... = [ ... ];` */
function corpoDe(nome) {
  const i = fonte.indexOf(`export const ${nome}`);
  if (i < 0) throw new Error(`${nome} nao existe em app/secoes.tsx`);
  const abre = fonte.indexOf("[", i);
  const fecha = fonte.indexOf("\n];", abre);
  if (abre < 0 || fecha < 0) throw new Error(`${nome} com forma inesperada`);
  return fonte.slice(abre, fecha + 2);
}

const blocos = [...corpoDe("BLOCOS").matchAll(/bloco:\s*"([^"]+)"\s*,\s*secao:\s*"([^"]+)"/g)]
  .map((m) => ({ bloco: m[1], secao: m[2] }));
const secoes = [...corpoDe("SECOES").matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);

const erros = [];

// 1. Os nove blocos, numerados de 1 a 9, sem falta e sem repeticao.
const numeros = blocos.map((b) => Number(b.bloco.split(" ")[0]));
for (let n = 1; n <= 9; n++) {
  if (!numeros.includes(n)) erros.push(`bloco ${n} de §6 do 05-painel nao aparece no mapa`);
}
if (blocos.length !== 9) erros.push(`o mapa tem ${blocos.length} entradas, e sao 9 blocos`);

// 2. Toda secao citada por um bloco existe em SECOES. Um mapa que aponta para
//    secao inexistente e pior que mapa nenhum: da a impressao de conferido.
for (const { bloco, secao } of blocos) {
  for (const alvo of secao.matchAll(/#([a-z]+)/g)) {
    if (!secoes.includes(alvo[1]))
      erros.push(`bloco "${bloco}" aponta para #${alvo[1]}, que nao esta em SECOES`);
  }
}

// 3. Toda secao de SECOES e realmente renderizada. Sem isto, a navegacao
//    oferece uma ancora que leva a lugar nenhum.
for (const id of secoes) {
  if (!pagina.includes(`<Secao id="${id}"`))
    erros.push(`SECOES declara "${id}", mas <Secao id="${id}"> nao existe em page.tsx`);
}

// 4. A FAIXA de comentario de cada secao cita o numero certo.
//
//    Elas ficaram erradas desde o incremento 8 - `04 · EXECUCAO` sobre uma
//    secao que virou a 09 - e ninguem viu, porque comentario nao quebra nada.
//    E o padrao que este projeto conta vinte vezes: um valor descrevia algo,
//    parou de descrever, e nada avisou. Agora avisa.
//    A faixa e casada com a PRIMEIRA `<Secao>` que aparece depois dela: entre
//    as duas pode haver um comentario explicativo, e exigir adjacencia faria a
//    guarda acusar justamente as secoes mais documentadas.
const faixas = new Map();
for (const m of pagina.matchAll(/\{\/\* =+ (\d+) · ([A-ZÇÃÕÉ ]+?) \*\/\}/g)) {
  const resto = pagina.slice(m.index + m[0].length);
  const alvo = resto.match(/<Secao id="([a-z-]+)"/);
  if (alvo) faixas.set(alvo[1], m[1]);
}
const numeroDe = new Map(
  [...corpoDe("SECOES").matchAll(/id:\s*"([^"]+)"\s*,\s*n:\s*"(\d+)"/g)]
    .map((m) => [m[1], m[2]]),
);
if (faixas.size === 0) erros.push("a conferencia de faixas nao leu nada — guarda vazia");
for (const [id, n] of faixas) {
  const esperado = numeroDe.get(id);
  if (esperado && esperado !== n)
    erros.push(`a faixa da secao "${id}" diz ${n}, e SECOES diz ${esperado}`);
}

console.log("Criterio 1 do incremento 6 — os nove blocos e onde cada um esta:");
for (const { bloco, secao } of blocos) console.log(`  · ${bloco.padEnd(32)} -> ${secao}`);

if (erros.length) {
  console.error(`\nRECUSADO — ${erros.length} problema(s):`);
  for (const e of erros) console.error("  " + e);
  process.exit(1);
}
console.log(`\nOK — 9 blocos, ${secoes.length} secoes, todas renderizadas.`);
