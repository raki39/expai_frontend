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

// 4. A FAIXA de comentario de cada secao cita o numero E O TITULO certos, e
//    a correspondencia entre faixas e secoes e BIJETIVA.
//
//    Historia desta guarda, porque ela e o caso mais claro do padrao que este
//    projeto registra:
//
//    * incremento 8: as faixas ficaram erradas - `04 · EXECUCAO` sobre a secao
//      que virou a 09 - e ninguem viu, porque comentario nao quebra nada;
//    * incremento 20: os NUMEROS foram corrigidos e esta conferencia nasceu;
//    * 2026-09-08: descobriu-se que a faixa `SUBSTRATO` estava 190 linhas
//      ACIMA da secao dela, empilhada sobre a do `FECHAMENTO`. A secao
//      `substrato` nao tinha faixa nenhuma.
//
//    **E esta guarda nao pegou**, por dois buracos de estrutura:
//
//    1. `faixas` era um `Map` por id de secao, e duas faixas seguidas resolvem
//       para a MESMA `<Secao>` - a segunda sobrescrevia a primeira, e o numero
//       da faixa perdida nunca era conferido;
//    2. a secao sem faixa simplesmente nao aparecia no mapa, e o laco
//       iterava o mapa - logo, ausencia era invisivel.
//
//    Corrigir o numero e nao a estrutura teria deixado o mesmo defeito voltar
//    na proxima secao nova. Agora sao tres exigencias:
//    toda secao tem EXATAMENTE uma faixa, o numero casa, e o TITULO casa.
//
//    A faixa continua casada com a PRIMEIRA `<Secao>` depois dela: entre as
//    duas pode haver um comentario explicativo, e exigir adjacencia faria a
//    guarda acusar justamente as secoes mais documentadas.
const faixasVistas = [];
for (const m of pagina.matchAll(/\{\/\* =+ (\d+) · ([A-ZÇÃÕÉ ]+?) \*\/\}/g)) {
  const resto = pagina.slice(m.index + m[0].length);
  const alvo = resto.match(/<Secao id="([a-z-]+)"/);
  faixasVistas.push({
    n: m[1],
    titulo: m[2].trim(),
    secao: alvo ? alvo[1] : null,
  });
}

const declaradas = [
  ...corpoDe("SECOES").matchAll(
    /id:\s*"([^"]+)"\s*,\s*n:\s*"(\d+)"\s*,\s*titulo:\s*"([^"]+)"/g,
  ),
].map((m) => ({ id: m[1], n: m[2], titulo: m[3] }));

/** Sem acento e em maiuscula, que e a forma da faixa. */
function comparavel(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

if (faixasVistas.length === 0)
  erros.push("a conferencia de faixas nao leu nada — guarda vazia");
if (declaradas.length !== secoes.length)
  erros.push(
    `SECOES tem ${secoes.length} entradas e so ${declaradas.length} casaram` +
      " com id+n+titulo: a forma da lista mudou e esta guarda ficou parcial",
  );

// 4a. Nenhuma faixa orfa, e nenhuma faixa apontando para o vazio.
for (const f of faixasVistas) {
  if (f.secao === null)
    erros.push(`a faixa "${f.n} · ${f.titulo}" nao precede nenhuma <Secao>`);
}

// 4b. Bijecao: cada secao tem EXATAMENTE uma faixa. Duas faixas empilhadas
//     resolvem para a mesma secao, e era assim que a orfa se escondia.
const porSecao = new Map();
for (const f of faixasVistas) {
  if (f.secao === null) continue;
  porSecao.set(f.secao, [...(porSecao.get(f.secao) ?? []), f]);
}
for (const { id, n, titulo } of declaradas) {
  const minhas = porSecao.get(id) ?? [];
  if (minhas.length === 0) {
    erros.push(
      `a secao "${id}" (${n} · ${titulo}) nao tem faixa de comentario:` +
        " ou ela foi esquecida, ou esta acima da secao errada",
    );
    continue;
  }
  if (minhas.length > 1) {
    erros.push(
      `a secao "${id}" tem ${minhas.length} faixas empilhadas` +
        ` (${minhas.map((f) => `${f.n} · ${f.titulo}`).join(", ")}):` +
        " uma delas pertence a outra secao",
    );
    continue;
  }
  const f = minhas[0];
  if (f.n !== n)
    erros.push(`a faixa da secao "${id}" diz ${f.n}, e SECOES diz ${n}`);
  if (comparavel(f.titulo) !== comparavel(titulo))
    erros.push(
      `a faixa da secao "${id}" diz "${f.titulo}", e SECOES diz "${titulo}":` +
        " a faixa esta rotulando a secao errada",
    );
}

console.log("Criterio 1 do incremento 6 — os nove blocos e onde cada um esta:");
for (const { bloco, secao } of blocos) console.log(`  · ${bloco.padEnd(32)} -> ${secao}`);

if (erros.length) {
  console.error(`\nRECUSADO — ${erros.length} problema(s):`);
  for (const e of erros) console.error("  " + e);
  process.exit(1);
}
console.log(`\nOK — 9 blocos, ${secoes.length} secoes, todas renderizadas.`);
