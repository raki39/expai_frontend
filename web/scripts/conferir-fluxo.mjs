// Confere o FLUXO da certificacao em etapas contra um backend SIMULADO com a
// semantica do real (parcelado.py): trava de "no maximo uma em andamento" com
// 409, idempotencia, etapa longa que passa do corte do proxy e continua no
// backend, aborto com motivo, e servidor instavel.
//
// O tempo e em "voltas": cada `esperar` avanca o relogio do backend em uma. Uma
// etapa mais longa que o corte do proxy devolve `status: null` ao cliente - a
// resposta se perdeu - e segue rodando no backend ate terminar.
//
// Roda com `node scripts/conferir-fluxo.mjs` (Node 24 importa .ts direto).

import { acompanhar, classificar, conduzir } from "../app/fluxo-certificacao.ts";

const PLANO = 8;
let falhas = 0;

function conferir(nome, condicao, detalhe = "") {
  if (condicao) {
    console.log(`  ok   ${nome}`);
  } else {
    falhas++;
    console.log(`  FALHA ${nome} ${detalhe}`);
  }
}

function backend(opcoes = {}) {
  const {
    duracao = {}, // indice -> voltas que a etapa leva
    corteDoProxy = 3, // voltas: acima disto a resposta se perde
    abortarAoPostar = null, // indice em que o POST encontra a copia perdida
    abortarDurante = null, // { indice, apos }: a copia some com a etapa rodando
    instaveis = 0, // quantos POSTs devolvem 502 antes de o servidor voltar
    outraAbaNoPrimeiroPost = false, // outra aba comeca a etapa antes do nosso POST
  } = opcoes;
  const s = {
    concluidas: 0,
    rodando: null,
    selado: false,
    abortada: null,
    iniciada: false,
    inicios: Array(PLANO).fill(0),
    postsComEtapaEmAndamento: 0,
    posts: 0,
    instaveis,
    outraAba: outraAbaNoPrimeiroPost,
  };
  const estado = () => ({
    existe: true,
    iniciada: s.iniciada,
    concluidas: s.concluidas,
    total: PLANO,
    proxima: s.selado || s.abortada || s.concluidas >= PLANO ? null : s.concluidas,
    pode_selar: !s.selado && !s.abortada && s.concluidas === PLANO,
    em_andamento: s.rodando !== null,
    abortada: s.abortada,
    selado: s.selado ? { passa: true, selado_em: "t" } : null,
  });
  const comecar = (k) => {
    s.inicios[k]++;
    s.rodando = { indice: k, falta: duracao[k] ?? 0, andou: 0 };
  };
  const passo = () => {
    if (!s.rodando) return;
    s.rodando.andou++;
    if (abortarDurante && abortarDurante.indice === s.rodando.indice
        && s.rodando.andou >= abortarDurante.apos) {
      s.rodando = null;
      s.abortada = { motivo: "a copia temporaria SUMIU", abortada_em: "t" };
      return;
    }
    if (s.rodando.andou >= s.rodando.falta) {
      s.rodando = null;
      s.concluidas++;
    }
  };
  const portas = {
    async ler() {
      return estado();
    },
    async esperar() {
      passo();
    },
    async postar(corpo) {
      s.posts++;
      if (s.instaveis > 0) {
        s.instaveis--;
        return { status: 502, corpo: {} };
      }
      if (s.outraAba && !s.rodando) {
        s.outraAba = false;
        s.iniciada = true;
        comecar(s.concluidas);
      }
      if (s.rodando) {
        s.postsComEtapaEmAndamento++;
        return {
          status: 409,
          corpo: { detail: "a execucao 1 ja tem uma etapa em andamento: no maximo uma por vez" },
        };
      }
      if (s.abortada && !corpo.nova_execucao) {
        return { status: 409, corpo: { detail: `execucao 1 abortada: ${s.abortada.motivo}` } };
      }
      if (corpo.selar) {
        if (s.concluidas < PLANO) return { status: 409, corpo: { detail: "faltam etapas" } };
        s.selado = true;
        return { status: 200, corpo: { ...estado(), passa: true } };
      }
      s.iniciada = true;
      const k = s.concluidas;
      if (k >= PLANO) return { status: 200, corpo: { ...estado(), por_que: "falta selar" } };
      if (abortarAoPostar === k) {
        s.abortada = { motivo: "a copia temporaria SUMIU", abortada_em: "t" };
        return { status: 409, corpo: { detail: "execucao 1 abortada: a copia temporaria SUMIU" } };
      }
      comecar(k);
      if ((duracao[k] ?? 0) <= corteDoProxy) {
        s.rodando = null;
        s.concluidas++;
        return { status: 200, corpo: { ...estado(), etapa: `e${k}` } };
      }
      // A etapa segue no backend; a resposta HTTP se perdeu no corte do proxy.
      return { status: null, corpo: {} };
    },
  };
  return { s, portas };
}

const RAPIDO = { esperaMs: 0 };
const umInicioPorEtapa = (s) => s.inicios.every((n) => n === 1);

console.log("classificar - falha real e distinta de timeout");
conferir("sem resposta (timeout/rede) espera", classificar({ status: null, corpo: {} }) === "sem_resposta");
conferir("504 do proxy espera", classificar({ status: 504, corpo: {} }) === "sem_resposta");
conferir("409 em andamento espera", classificar({ status: 409, corpo: { detail: "ja tem uma etapa em andamento" } }) === "em_andamento");
conferir("409 abortada e FALHA", classificar({ status: 409, corpo: { detail: "execucao abortada" } }) === "falha_real");
conferir("422 e FALHA", classificar({ status: 422, corpo: {} }) === "falha_real");
conferir("502 e instavel, nao falha", classificar({ status: 502, corpo: {} }) === "servidor_instavel");

console.log("etapas longas passando do corte do proxy (B4 e lucro_so_sem_custos)");
{
  const { s, portas } = backend({ duracao: { 1: 16, 4: 24 }, corteDoProxy: 12 });
  const relatos = [];
  const d = await conduzir({ ...portas, relatar: (r) => relatos.push(r.classe) }, RAPIDO);
  conferir("sela", d.fim === "selado", JSON.stringify(d));
  conferir("cada etapa comecou UMA vez", umInicioPorEtapa(s), JSON.stringify(s.inicios));
  conferir("nenhum POST com etapa em andamento", s.postsComEtapaEmAndamento === 0);
  conferir("as duas respostas perdidas foram vistas", relatos.filter((c) => c === "sem_resposta").length === 2);
  conferir("o fluxo acompanhou pelo estado", relatos.filter((c) => c === "em_andamento").length >= 30);
}

console.log("aba fechada no meio da etapa longa, e a pagina recarregada");
{
  const { s, portas } = backend({ duracao: { 4: 24 }, corteDoProxy: 12 });
  const FECHOU = new Error("aba fechada");
  let perdeu = 0;
  const fechar = (r) => {
    if (r.classe === "sem_resposta" && ++perdeu === 1) throw FECHOU;
  };
  let caiu = null;
  try {
    await conduzir({ ...portas, relatar: fechar }, RAPIDO);
  } catch (e) {
    caiu = e;
  }
  conferir("a aba fechou com a etapa 4 rodando no backend", caiu === FECHOU && s.rodando?.indice === 4);
  const postsAntes = s.posts;
  const a = await acompanhar(portas, RAPIDO);
  conferir("ao recarregar, so ACOMPANHA - nenhum POST", s.posts === postsAntes);
  conferir("e a etapa 4 concluiu no backend", a.estado?.concluidas === 5 && !a.estado?.em_andamento);
  const d = await conduzir(portas, RAPIDO);
  conferir("continuar retoma da etapa 5 e sela", d.fim === "selado");
  conferir("nenhuma etapa rodou duas vezes", umInicioPorEtapa(s), JSON.stringify(s.inicios));
  conferir("nenhum POST com etapa em andamento", s.postsComEtapaEmAndamento === 0);
}

console.log("outra aba comecou a etapa: 409 e espera, sem repetir");
{
  const { s, portas } = backend({ duracao: { 0: 6 }, corteDoProxy: 3, outraAbaNoPrimeiroPost: true });
  const d = await conduzir(portas, RAPIDO);
  conferir("sela", d.fim === "selado");
  conferir("a etapa 0 comecou UMA vez, pela outra aba", umInicioPorEtapa(s), JSON.stringify(s.inicios));
}

console.log("falha REAL: a copia sumiu");
{
  const { s, portas } = backend({ abortarAoPostar: 3 });
  const d = await conduzir(portas, RAPIDO);
  conferir("termina como FALHA, com o motivo do backend", d.fim === "falha" && d.motivo.includes("SUMIU"), JSON.stringify(d));
  conferir("e para: nao insiste depois da falha", s.posts === 4);
}
{
  const { portas } = backend({ duracao: { 4: 24 }, corteDoProxy: 12, abortarDurante: { indice: 4, apos: 5 } });
  const relatos = [];
  const d = await conduzir({ ...portas, relatar: (r) => relatos.push(r.classe) }, RAPIDO);
  conferir("timeout primeiro, falha depois: o fim e FALHA, e nao timeout", d.fim === "falha" && relatos.includes("sem_resposta"));
}

console.log("servidor instavel nao e falha");
{
  const { s, portas } = backend({ instaveis: 3 });
  const d = await conduzir(portas, RAPIDO);
  conferir("tres 502 e depois sela", d.fim === "selado" && umInicioPorEtapa(s));
}
{
  const { portas } = backend({ instaveis: 1000 });
  const d = await conduzir(portas, { ...RAPIDO, maxInstaveis: 5 });
  conferir("502 persistente termina INDISPONIVEL, e nao FALHA", d.fim === "indisponivel");
}

if (falhas) {
  console.log(`\n${falhas} conferencia(s) do fluxo FALHARAM`);
  process.exit(1);
}
console.log("\nOK - o fluxo le o estado antes de postar, nunca repete etapa, e separa falha de timeout.");
