/**
 * O FLUXO da certificação em etapas — sem React, sem rede, e por isso testável.
 *
 * O componente injeta as três portas (postar, ler, esperar); `conduzir` decide
 * só a ORDEM das chamadas. Qual é a próxima etapa, se pode selar e por que
 * abortou vem sempre do backend (secao 10.2.1: o painel não tem lógica de
 * negócio).
 *
 * ## As garantias, e onde cada uma mora
 *
 * | garantia | como |
 * |---|---|
 * | não depende da resposta HTTP longa | toda volta LÊ o estado antes de postar; a resposta do POST só é exibida |
 * | não avança com etapa em andamento | se o estado diz `em_andamento`, a volta espera e lê de novo — nunca posta |
 * | timeout, conexão perdida ou aba fechada não apagam nada | a execução mora no backend; quem volta lê `proxima` |
 * | recarregar retoma do ponto certo | o ponto é o `proxima` do servidor, e não um contador do navegador |
 * | repetir não roda duas vezes | o backend recusa com 409 "em andamento", e o fluxo espera |
 * | falha real ≠ timeout | 409 e 4xx são DECISÃO do backend e encerram; sem resposta e 5xx só esperam |
 */

export type EtapaA1a = {
  indice: number;
  etapa: string;
  estado: "pendente" | "em_andamento" | "interrompida" | "concluida" | "falhou";
  tentativas: number;
  micros: number | null;
};

export type EstadoA1a = {
  existe?: boolean;
  iniciada?: boolean;
  execucao_id?: number;
  alvo_de_certificacao_hash?: string;
  plano?: string[];
  etapas?: EtapaA1a[];
  concluidas?: number;
  total?: number;
  proxima?: number | null;
  pode_selar?: boolean;
  em_andamento?: boolean;
  abortada?: { motivo: string; abortada_em: string } | null;
  selado?: { passa: boolean; selado_em: string } | null;
  copia?: {
    bytes_no_selo: number;
    selada_em: string;
    descartada: { motivo: string; residuo: boolean } | null;
  } | null;
  motivo?: string;
  passa?: boolean;
};

/** `status: null` = não houve resposta: timeout do cliente ou conexão perdida. */
export type Resposta = { status: number | null; corpo: any };

export type Classe =
  | "progresso" // 200: a etapa rodou, ou não faltava nada
  | "em_andamento" // 409 "em andamento": outra etapa está rodando
  | "sem_resposta" // timeout do cliente, conexão perdida, 504 do proxy
  | "servidor_instavel" // 500, 502, 503: nem decisão do backend, nem o cliente
  | "falha_real"; // 409 ou 4xx: o backend DECIDIU — abortada, recusada, pedido inválido

export function classificar(r: Resposta): Classe {
  if (r.status === null || r.status === 504) return "sem_resposta";
  if (r.status === 200) return "progresso";
  const detalhe = String(r.corpo?.detail ?? "");
  if (r.status === 409 && detalhe.includes("em andamento")) return "em_andamento";
  if (r.status >= 400 && r.status < 500) return "falha_real";
  return "servidor_instavel";
}

export type Relato = {
  estado: EstadoA1a | null;
  aviso: string | null;
  classe: Classe | "leitura";
};

export type Portas = {
  postar: (corpo: Record<string, unknown>) => Promise<Resposta>;
  ler: () => Promise<EstadoA1a | null>;
  esperar: (ms: number) => Promise<void>;
  relatar?: (r: Relato) => void;
};

export type Desfecho =
  | { fim: "selado"; estado: EstadoA1a }
  // O backend DECIDIU: abortada ou recusada. E o unico fim que e FALHA.
  | { fim: "falha"; motivo: string; estado: EstadoA1a | null }
  // O servidor nao respondeu por tempo demais. Nada foi decidido.
  | { fim: "indisponivel"; motivo: string; estado: EstadoA1a | null }
  // Teto de voltas, ou `acompanhar` que terminou. Nada foi decidido.
  | { fim: "parado"; motivo: string; estado: EstadoA1a | null };

export const AUTOR = "painel";
export const ESPERA_MS = 5000;

export type Opcoes = {
  novaExecucao?: boolean;
  esperaMs?: number;
  maxVoltas?: number;
  maxInstaveis?: number;
};

/**
 * Conduz a certificação até o selo, até uma falha real, ou até o teto.
 *
 * A regra que torna isto seguro está no começo de cada volta: o estado é LIDO
 * antes de qualquer POST. Um POST cuja resposta se perdeu (timeout do proxy em
 * 60 s, rede, aba fechada) não deixa o fluxo confuso — a volta seguinte lê o
 * servidor e age sobre o que ele diz.
 */
export async function conduzir(portas: Portas, opcoes: Opcoes = {}): Promise<Desfecho> {
  const esperaMs = opcoes.esperaMs ?? ESPERA_MS;
  const maxVoltas = opcoes.maxVoltas ?? 600;
  const maxInstaveis = opcoes.maxInstaveis ?? 24;
  const relatar = portas.relatar ?? (() => {});
  let nova = opcoes.novaExecucao ?? false;
  let instaveis = 0;

  for (let volta = 0; volta < maxVoltas; volta++) {
    // 1. O ESTADO primeiro, sempre.
    const estado = await portas.ler();
    if (estado === null) {
      instaveis++;
      if (instaveis > maxInstaveis) {
        return { fim: "indisponivel", motivo: "o estado nao pode ser lido", estado: null };
      }
      relatar({ estado: null, aviso: "sem resposta ao ler o estado — tentando de novo", classe: "leitura" });
      await portas.esperar(esperaMs);
      continue;
    }
    if (estado.selado) return { fim: "selado", estado };
    if (estado.em_andamento) {
      relatar({
        estado,
        aviso: "uma etapa esta em andamento no backend — acompanhando, sem postar",
        classe: "em_andamento",
      });
      await portas.esperar(esperaMs);
      continue;
    }
    if (estado.abortada && !nova) {
      return { fim: "falha", motivo: estado.abortada.motivo, estado };
    }

    // 2. O PEDIDO sai do estado do SERVIDOR, e nunca de um contador daqui.
    const corpo = estado.pode_selar && !nova
      ? { author: AUTOR, selar: true }
      : { author: AUTOR, nova_execucao: nova };
    const r = await portas.postar(corpo);
    nova = false;
    const classe = classificar(r);

    if (classe === "progresso") {
      instaveis = 0;
      relatar({ estado: r.corpo as EstadoA1a, aviso: null, classe });
      continue;
    }
    if (classe === "falha_real") {
      return {
        fim: "falha",
        motivo: String(r.corpo?.detail ?? `HTTP ${r.status}`),
        estado: await portas.ler(),
      };
    }
    if (classe === "servidor_instavel") {
      instaveis++;
      if (instaveis > maxInstaveis) {
        return { fim: "indisponivel", motivo: `HTTP ${r.status} repetido`, estado };
      }
    }
    relatar({
      estado,
      aviso:
        classe === "sem_resposta"
          ? "sem resposta (timeout do cliente ou do proxy, ou conexao perdida). A etapa segue no backend — acompanhando o estado"
          : classe === "em_andamento"
            ? "outra chamada ja esta rodando esta etapa — acompanhando"
            : `o servidor respondeu HTTP ${r.status} — nao e decisao dele; lendo o estado de novo`,
      classe,
    });
    await portas.esperar(esperaMs);
  }
  return { fim: "parado", motivo: "teto de voltas atingido", estado: await portas.ler() };
}

/**
 * Só ACOMPANHA: lê o estado até nenhuma etapa estar em andamento. Nunca posta.
 *
 * É o que o painel faz ao carregar com uma etapa rodando no backend — depois de
 * um recarregamento, ou de a aba ter sido fechada no meio. Continuar para a
 * etapa seguinte é um clique; acompanhar não é.
 */
export async function acompanhar(
  portas: Pick<Portas, "ler" | "esperar" | "relatar">,
  opcoes: { esperaMs?: number; maxVoltas?: number } = {},
): Promise<Desfecho> {
  const esperaMs = opcoes.esperaMs ?? ESPERA_MS;
  const maxVoltas = opcoes.maxVoltas ?? 600;
  const relatar = portas.relatar ?? (() => {});
  let estado: EstadoA1a | null = null;
  for (let volta = 0; volta < maxVoltas; volta++) {
    estado = await portas.ler();
    if (estado?.selado) return { fim: "selado", estado };
    if (estado && !estado.em_andamento) {
      return { fim: "parado", motivo: "nenhuma etapa em andamento", estado };
    }
    relatar({ estado, aviso: "acompanhando a etapa em andamento", classe: "leitura" });
    await portas.esperar(esperaMs);
  }
  return { fim: "parado", motivo: "teto de voltas atingido", estado };
}
