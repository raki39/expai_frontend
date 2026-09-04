import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { chamarApi } from "@/lib/api";
import { temSessao } from "@/lib/auth";
import { Botao } from "./botao";
import { Card, Dinheiro, Hash, Nota, Pill, Resultado, Tile, Tiles, Utc } from "./ui";
import { Curva, type DadosDaCurva } from "./curva";
import { Estado, Nav, Secao } from "./secoes";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------- contratos
 * Formas do que a api devolve. Nao ha calculo aqui: o painel exibe o que a
 * api afirma e nada mais (secao 10.2.1).
 * ---------------------------------------------------------------------- */

type Health = {
  status: string;
  app_env: string;
  build: string;
  db_path: string;
  db_path_absoluto: boolean;
  volume_gravavel: boolean;
  volume_montado: boolean | null;
  schema_version: number;
  config_version: number | null;
  config_hash: string | null;
  config_hash_confere: boolean | null;
  run_ativo: number | null;
  credenciais_configuradas: { anthropic: boolean; openai: boolean };
};

type Dataset = {
  existe: boolean;
  dataset_id?: number;
  venue?: string;
  symbol?: string;
  timeframe?: string;
  sha256?: string;
  fidelity_level?: number;
  barras_total?: number;
  barras_disponiveis?: number;
  barras_reservadas?: number;
  reserved_from_ms?: number;
  start_ms?: number;
  end_ms?: number;
};

type Agente = {
  run_id: number | null;
  caminho: {
    id: number;
    parent_event_id: number | null;
    node: string;
    kind: string;
    tier: string | null;
    provider: string | null;
    model: string | null;
    tokens_in: number | null;
    tokens_out: number | null;
    tokens_cache_read: number | null;
    tokens_cache_write: number | null;
    cost_usd_minor: number | null;
    cost_usd_micro: number | null;
    price_table_version: string | null;
    expectation: string | null;
    confidence_ppm: number | null;
  }[];
  propostas: {
    id: number;
    status: string;
    rejection_reason: string | null;
    expectation: string | null;
    confidence_ppm: number | null;
  }[];
  regra_ativa: {
    rule_id: number;
    regra_hash: string;
    family: string;
    params_json: string;
    expectation: string | null;
    confidence_ppm: number | null;
  } | null;
  patrimonio_final_cents?: number;
  /** Idas e voltas completas. `operacoes` era o nome, e ele valia isto
   *  aqui e o dobro em `execucoes` - o mesmo rotulo para dois numeros. */
  idas_e_voltas?: number;
  ordens_executadas?: number;
  config_version_id?: number;
  /** Por que o cerebro parou, do evento. Vinha so no corpo do POST: o
   *  painel mostrava a parada e nunca a causa. */
  parada?: {
    node: string;
    categoria: string | null;
    motivo: string | null;
    quando: string;
    /** Paradas gravadas antes da migracao 13 nao tem categoria. */
    registro_completo: boolean;
  } | null;
  /** Quem pode chamar isto de "resultado do agente", e por que.
   *  Decidido pela api - decidir sobre o experimento nao acontece
   *  aqui (regra 19). */
  atribuicao?: {
    atribuivel_ao_agente: boolean;
    o_que_executou: string;
    por_que: string;
  };
  custos_cents?: {
    execucao_total: number;
    reflexao_total: number;
    posicao_aberta: number;
  };
  gasto: {
    chamadas_com_custo: number;
    gasto_cents: number;
    gasto_micro: number;
    gasto_real_brl_cents: number;
  } | null;
  reflexoes?: number;
  b1_casado?: {
    run_id: number;
    /** O run que este controle casa (migracao 14). `null` nos controles
     *  gravados antes dela. */
    casa_run_id?: number | null;
    repeticoes: number;
    operacoes_alvo: number;
    fracao_bps?: number | null;
    p5: number;
    p50: number;
    p95: number;
  } | null;
  /** Onde o resultado caiu na distribuicao do acaso. Classificado pela
   *  api: classificar e decidir, e decidir sobre o experimento nao
   *  acontece no painel (regra 19). */
  faixa?: string;
  /** Duas perguntas, e o `ligado` diz qual esta sendo respondida.
   *
   *  `ligado: false` -> este run nao tem controle (todo run anterior a
   *  migracao 14). `ligado: true, casa: false` -> tem controle e ele nao
   *  casa o giro, o que agora e DEFEITO e nao ambiguidade.
   *
   *  Antes da ligacao a tela mostrou 37 idas e voltas ao lado de um controle
   *  de 70, porque o B1 vinha de outro run (D19). */
  b1_casado_confere?: {
    ligado: boolean;
    casa: boolean | null;
    operacoes_alvo: number | null;
    idas_e_voltas_do_run: number;
    por_que_importa: string;
  } | null;
  /** O pre-registro estruturado. Vem montado da api: parsear o
   *  `raw_response_json` aqui seria logica de negocio (regra 19). */
  pre_registro?: PreRegistro | null;
  /** O parecer INDEPENDENTE do validador (§8.1), ao lado da autoavaliacao
   *  do agente. Vinha so no corpo do POST do ciclo. */
  parecer_do_validador?: Parecer | null;
  hypothesis_id?: number | null;
  sobreposicao_amostral?: { sobreposicao_bps: number | null };
  condicoes_validade?: string;
  cache_de_respostas?: number;
  arredondamento_do_custo_ok?: boolean;
};

/** O pre-registro de §8.2. Imutavel a partir da gravacao. */
type PreRegistro = {
  id: number;
  enunciado: string;
  metrica_primaria: string;
  efeito_minimo: number;
  n_minimo: number;
  sharpe_esperado_milesimos: number;
  criterio_parada: string;
  condicoes_falseamento: {
    metrica: string;
    comparador: string;
    valor: number;
  }[];
  testavel: boolean;
  motivo_nao_testavel: string | null;
  horizonte_barras: number;
  content_hash: string;
};

/** O parecer do validador, recalculado do banco a cada leitura. */
type Parecer = {
  veredito: string | null;
  motivo: string | null;
  recalculado?: boolean;
  detalhe?: {
    amostra?: {
      n_bruto: number;
      n_efetivo: number;
      n_minimo: number;
      suficiente: boolean;
    };
    efeito?: { minimo_declarado: number; observado: number | null; alcancou: boolean };
    condicoes_falseamento?: {
      condicao: string;
      observado: number | null;
      disparou: boolean | null;
      por_que_nao_conferida: string | null;
    }[];
  };
};

type Separacao = {
  existe: boolean;
  dividido?: boolean;
  conjuntos?: {
    finalidade: string;
    barras: number;
    acesso: string;
  }[];
  acessivel_ao_agente?: string[];
  sem_vazamento?: {
    conferido: boolean;
    janelas: number;
    purga_barras: number;
    embargo_barras: number;
    purga_origem: string;
    problemas: string[];
  };
  holdout?: { usos: unknown[]; regra: string };
};

type Lote = {
  parametros?: {
    familia_max_hipoteses: number;
    fdr_procedimento: string;
    fdr_alvo_bps: number;
    dsr_minimo_milesimos: number;
  };
  fechamento?: {
    familia_max: number;
    testadas: number;
    sem_p_valor: number;
    tentativas_globais: number;
    sobreviventes: number[];
    fdr: {
      procedimento: string;
      m: number;
      /** Em ppm, e nao em milesimos: H(48) = 4,458797... e milesimos
       *  truncam para 4458, que formatado com quatro casas vira `4,4580` -
       *  um zero inventado onde o digito real e 8. */
      correcao_harmonica_ppm: number;
      limiar_efetivo_ppm: number;
      k: number;
    };
    membros: {
      hypothesis_id: number;
      estado: string;
      p_valor_ppm: number | null;
      por_que_sem_p: string | null;
    }[];
  };
};

type Creditos = {
  por_braco?: {
    braco: string;
    /** Orcamento e familia sao POR config_version. Sem esta coluna a tabela
     *  mostrava tres linhas "agente" e duas "B4" sob o mesmo rotulo. */
    config_version_id: number;
    vigente: boolean;
    hipoteses: number;
    reflexoes: number;
    orcamento: number;
    consumido: number;
    restante: number;
  }[];
  por_tipo?: { tipo: string; testes: number; creditos: number }[];
  pesos_do_documento?: Record<string, number>;
};

/** O braco de controle nao cognitivo (§14.3). */
type B4 = {
  existe: boolean;
  quantas?: number;
  agente_origem?: string;
  creditos?: {
    braco: string;
    orcamento: number;
    consumido: number;
    restante: number;
  } | null;
  hipoteses?: {
    hypothesis_id: number;
    run_id: number;
    testavel: number | boolean;
    content_hash: string;
    rule_id: number | null;
  }[];
};

/** A1a: os seis controles negativos determinísticos (§14.4). */
type A1a = {
  existe: boolean;
  quantas?: number;
  promovidos?: number[];
  familias?: {
    chave: string;
    familia_de_defeito: string;
    o_que_injeta: string;
    guarda_esperada: string;
    tipo: string;
  }[];
  hipoteses?: {
    hypothesis_id: number;
    run_id: number;
    chave: string;
    familia_de_defeito: string | null;
    tipo: string | null;
    estado: string | null;
    promovido: boolean;
  }[];
  creditos?: { orcamento: number; consumido: number; restante: number } | null;
};

/** A1b: o calibre acumulado das nulas estocásticas, nos dois desenhos. */
type A1bDesenho = {
  desenho: string;
  execucoes: number;
  execucoes_pedidas?: number;
  completo?: boolean;
  por_que_sem_numero?: string;
  promocao_do_lote?: {
    execucoes_com_promocao?: number;
    intervalo: { ponto_ppm: number; baixo_ppm: number; alto_ppm: number };
    limite_superior_ate_o_alvo: boolean;
    /** A leitura ANTIGA da D29, mantida visível: apagá-la esconderia que
     *  houve correção (D37). */
    ic_contem_o_alvo?: boolean;
    poder?: {
      piso_testavel: { implantados: number; promovidos: number; fracao_ppm: number | null };
      detectavel_por_by: { implantados: number; promovidos: number; fracao_ppm: number | null };
    };
  };
  com_o_portao_de_amostra?: {
    execucoes_com_promocao: number;
    intervalo: { alto_ppm: number };
  };
};

type A1b = {
  existe: boolean;
  gravadas?: number;
  execucoes_pedidas_por_desenho?: number;
  lote_por_execucao?: number;
  divergencias?: string[];
  horizonte_barras?: number;
  magnitudes?: {
    piso_testavel_milesimos: number;
    detectavel_por_by_milesimos: number;
    limiar_by_primeira_posicao_ppm: number;
  };
  desenhos?: Record<string, A1bDesenho>;
};

/** O relatório do Portão A. Três resultados, e `None` não é aprovado. */
type PortaoA = {
  existe: boolean;
  passa?: boolean;
  reprova?: boolean;
  pendente?: boolean;
  condicoes?: Record<string, boolean | null>;
  reprovando?: string[];
  pendentes?: string[];
  se_reprova?: string;
  portao_b?: { avaliado: boolean; por_que: string };
  a2?: {
    negativo: boolean | null;
    proporcional_ao_giro: boolean | null;
    por_que_sem_proporcional: string | null;
    capital_semente_cents: number;
    corridas: {
      run_id: number;
      operacoes_alvo: number;
      p50: number;
      perda_cents: number;
      perda_por_ida_e_volta_cents: number | null;
    }[];
  };
  a3?: {
    conferencias: Record<string, boolean | null>;
    execucoes_na_barra_da_decisao: number;
    /** NESTA familia. O global vem separado, porque os runs da 0A rodaram
     *  sobre a janela inteira quando a divisao nem existia. */
    execucoes_em_conjunto_do_validador: number;
    execucoes_em_conjunto_do_validador_global: number;
    acessos_ao_holdout_por_outro: number;
    /** FATO, e nao criterio: o walk-forward sao 30% dos 56.064 que a 0A usou
     *  inteiros, e aqueles resultados foram lidos. */
    walk_forward_ja_visto?: {
      execucoes: number;
      runs: number;
      o_que_isso_levanta: string;
      por_config_version: { config_version_id: number; execucoes: number }[];
    };
  };
  a4?: {
    conferencias: Record<string, boolean>;
    hipoteses_na_tabela: number;
    contador_global: number;
    testadas_sem_estado: number[];
  };
  nao_responde?: string[];
};

/** O Portao B. `avaliado: false` quando o A nao passou (R49) - e ai o corpo
 *  NAO traz criterio nenhum, nem parcial. */
type PortaoB = {
  existe?: boolean;
  avaliado: boolean;
  por_que?: string;
  portao_a?: { passa: boolean; reprovando: string[]; pendentes: string[] };
  quantas?: number;
  passaram?: number[];
  inconclusivas?: number[];
  sem_candidata?: boolean;
  por_que_sem_candidata?: string | null;
  ha_candidata_digna_de_auditoria?: boolean;
  auditoria?: string | null;
  o_que_aprovar_nao_significa?: string[];
  por_credito?: {
    agente_supera_b4: boolean | null;
    por_que_sem_comparacao: string | null;
    /** O criterio 4 sai `false` quando o agente perde E quando os dois
     *  empatam, e as duas coisas levam a conclusoes opostas (§14.3). */
    empate?: boolean;
    ambos_zerados?: boolean;
    o_que_o_empate_significa?: string | null;
    agente: { sustentadas: number; creditos_consumidos: number; por_credito_ppm: number | null };
    b4: { sustentadas: number; creditos_consumidos: number; por_credito_ppm: number | null };
  };
  candidatas?: {
    hypothesis_id: number;
    run_id: number;
    resultado: string;
    parecer_in_sample: string | null;
    patrimonio_final_cents: number;
    capital_semente_cents: number;
    excesso_sobre_b2_cents: number | null;
    excesso_sobre_b3_cents: number | null;
    criterios: Record<string, boolean | null>;
    reprovando: string[];
    sem_medida: string[];
    dsr?: { disponivel?: boolean; dsr_milesimos?: number; aprovado?: boolean; por_que?: string };
    walk_forward?: {
      executado: boolean;
      por_que?: string;
      quantas?: number;
      mantidas?: number;
      nao_observadas?: number;
      minimo_de_janelas?: number;
      janelas?: {
        ordem: number;
        barras: number;
        idas_e_voltas: number;
        observado: number | null;
        efeito_minimo: number;
        manteve: boolean | null;
      }[];
    };
  }[];
};

type ConfigResposta = {
  version_id: number;
  config_hash: string;
  congelada: boolean;
  catalogo_desatualizado?: string[];
  config: {
    market_venue: string;
    market_symbol: string;
    timeframe: string;
    data_start: string;
    data_end: string;
    reserved_fraction: string;
    execution_reference: string;
    seed_capital_usd_cents: number;
    fx_brl_per_usd: string;
    fx_rate_date: string;
  };
};

type Ledger = {
  run_ativo: number | null;
  escopo?: "run" | "livro_inteiro";
  runs_somados?: number;
  eventos: number;
  transacoes: number;
  carteira: {
    simulado_usd: {
      caixa_minor: number;
      posicao_btc_minor: number;
      tesouraria_minor: number;
      custo_execucao_minor: number;
    };
    real_brl: { caixa_minor: number; despesa_inferencia_minor: number };
  };
  conferencias: {
    partidas_dobradas_ok: boolean;
    saldo_reconciliado_ok: boolean;
    vinculos_ok: boolean;
    sem_ponto_flutuante: boolean;
  };
};

type Transacoes = {
  items: {
    id: number;
    kind: string;
    occurred_at: string;
    posted_at: string | null;
    reverses_transaction_id: number | null;
    agent_event_id: number | null;
    lancamentos: number;
    memo: string;
  }[];
};

type Simulador = {
  run_ativo: number | null;
  run_exibido?: number | null;
  encerrado?: boolean;
  execucoes?: number;
  posicao_sats?: number;
  custos_cents?: {
    taxa: number;
    spread: number;
    slippage: number;
    penalidade: number;
    total: number;
  };
  fidelity_level?: number | null;
  fidelidade_homogenea?: boolean;
  condicoes_validade: string;
};

type Execucoes = {
  items: {
    id: number;
    side: string;
    decision_bar_ms: number;
    execution_bar_ms: number;
    quantity_sats: number;
    price_ref: number;
    price_exec: number;
    fee_cents: number;
    spread_cents: number;
    slippage_cents: number;
    penalty_cents: number;
    fidelity_level: number;
  }[];
};

type ComparacaoAviso = {
  sob_a_config_vigente?: boolean | null;
  config_version_vigente?: number;
  config_versions_da_comparacao?: number[];
};

type Comparacao = ComparacaoAviso & {
  existe: boolean;
  aviso?: string;
  condicoes_validade?: string;
  B2?: {
    run_id: number;
    equity_final_cents: number;
    ordens_executadas: number;
    /** Idas e voltas. Vem da api: o painel dividia ordens por dois na
     *  tela, o que supunha que toda compra fechou. */
    idas_e_voltas: number;
    digest: string;
  };
  B3?: {
    run_id: number;
    equity_final_cents: number;
    ordens_executadas: number;
    /** Idas e voltas. Vem da api: o painel dividia ordens por dois na
     *  tela, o que supunha que toda compra fechou. */
    idas_e_voltas: number;
    digest: string;
  };
  B1_representativa?: { run_id: number; equity_final_cents: number };
  B1?: {
    repeticoes: number;
    operacoes_alvo: number;
    p5: number;
    p50: number;
    p95: number;
    minimo: number;
    maximo: number;
  };
};

/** O relatorio de fechamento. Nenhum campo daqui e calculado no painel. */
type Relatorio = {
  existe: boolean;
  motivo?: string;
  run?: { id: number; state: string };
  refletiu?: { quantas: number; houve_cerebro: boolean };
  reprodutibilidade?: {
    mesma_semente: { digest_a: string; digest_b: string; iguais: boolean };
    semente_diferente: { digest: string; difere_do_primeiro: boolean };
    config_hash_igual_nas_tres: boolean;
    provado: boolean;
  } | null;
  vinculo?: {
    conferido?: boolean;
    motivo?: string;
    execution_id?: number;
    evento_cognitivo?: number;
    profundidade_da_cadeia?: number;
    execucoes_autorizadas?: number;
  };
  integridade?: { ok: boolean };
  resposta_da_0a?: {
    pergunta: string;
    condicoes: Record<string, boolean | null>;
    faltando: string[];
    fecha: boolean;
    se_nao_fecha: string;
  };
  nao_concluido?: string[];
};

/**
 * Como cada faixa se escreve na tela. Traducao, nao classificacao: quem
 * decide em qual faixa o resultado caiu e a api.
 *
 * Sao QUATRO, e as quatro importam. Com tres, "abaixo da mediana" servia
 * tambem para quem esta abaixo do p5 - e perder de 95% do acaso e afirmacao
 * diferente de perder de 51%.
 */
const FAIXA: Record<string, { tom: string; texto: string; alerta?: string }> = {
  acima_p95: { tom: "ok", texto: "acima do p95" },
  entre_p50_e_p95: { tom: "warn", texto: "entre a mediana e o p95" },
  entre_p5_e_p50: { tom: "bad", texto: "entre o p5 e a mediana" },
  abaixo_p5: {
    tom: "bad",
    texto: "abaixo do p5",
    alerta:
      "Ou seja: mais de 95% das entradas ao acaso, com esse mesmo giro e esse" +
      " mesmo dimensionamento, teriam terminado melhor.",
  },
  sem_controle: { tom: "warn", texto: "sem controle comparavel" },
};

type Sentinelas = {
  total: number;
  items: { id: number; label: string; created_at: string }[];
};

/**
 * Da um ponto de quebra a um identificador tecnico (`cruzamento_medias`).
 *
 * Sem espaco nenhum, o navegador so quebra ESSE tipo de string no meio do
 * caractere quando o espaco da tile acaba - medido: "cruzamento_med" +
 * "ias". Um espaco largura-zero depois de cada `_` da um ponto de quebra
 * exatamente onde o nome ja se separa em partes, sem mudar o texto visivel.
 */
function quebravel(texto: string, separadores: RegExp = /_/g): string {
  return texto.replace(separadores, (s) => s + "​");
}

/** Preco vem com 8 casas decimais, como inteiro. A divisao acontece so aqui. */
function preco(escalado: number): string {
  return (escalado / 1e8).toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function btc(sats: number): string {
  return (sats / 1e8).toLocaleString("pt-BR", { maximumFractionDigits: 8 });
}

/* ----------------------------------------------------------------- acoes */

function paraPainel(status: number, corpo: unknown, campo: string): never {
  redirect(
    `/?${campo}=${status}&detalhe=${encodeURIComponent(
      JSON.stringify(corpo).slice(0, 4000),
    )}`,
  );
}

async function ingerirDataset(formData: FormData) {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi("/api/dataset/ingestao", {
    method: "POST",
    body: JSON.stringify({
      author: "painel",
      aceitar_lacunas: formData.get("aceitar_lacunas") === "on",
    }),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "ingestao");
}

/** Cria uma nova versao de configuracao (ADR 0008). O painel nao valida nada. */
async function alterarConfig(formData: FormData) {
  "use server";
  if (!(await temSessao())) redirect("/login");
  let changes: unknown;
  try {
    changes = JSON.parse(String(formData.get("changes") ?? "{}"));
  } catch {
    paraPainel(400, { detail: "JSON invalido no campo de alteracoes" }, "config");
  }
  const { status, corpo } = await chamarApi("/api/config", {
    method: "POST",
    body: JSON.stringify({
      author: String(formData.get("author") ?? "").trim(),
      note: String(formData.get("note") ?? "").trim(),
      changes,
    }),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "config");
}

/** Regrava a config vigente sob o hash correto, apos mudanca de schema. */
async function reancorarConfig(formData: FormData) {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi("/api/config/reancorar", {
    method: "POST",
    body: JSON.stringify({
      author: String(formData.get("author") ?? "painel").trim() || "painel",
    }),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "config");
}

async function abrirRun() {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi("/api/ledger/run", {
    method: "POST",
    body: JSON.stringify({ author: "painel" }),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "run");
}

async function encerrarRun(formData: FormData) {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi(
    `/api/ledger/run/${formData.get("run_id")}/encerrar`,
    { method: "POST", body: JSON.stringify({ estado: "concluido" }) },
  );
  revalidatePath("/");
  paraPainel(status, corpo, "run");
}

async function rodarComparacao() {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi("/api/baselines", {
    method: "POST",
    body: JSON.stringify({ author: "painel" }),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "comparacao");
}

async function rodarAgente() {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi("/api/agente", {
    method: "POST",
    body: JSON.stringify({ author: "painel" }),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "agente");
}

async function rodarB4() {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi("/api/b4", {
    method: "POST",
    body: JSON.stringify({ author: "painel" }),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "b4");
}

async function rodarA1a() {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi("/api/a1a", {
    method: "POST",
    body: JSON.stringify({ author: "painel" }),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "a1a");
}

async function rodarA1b(formData: FormData) {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const quantas = Number(formData.get("quantas") ?? 25);
  const { status, corpo } = await chamarApi("/api/a1b", {
    method: "POST",
    body: JSON.stringify({ author: "painel", quantas }),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "a1b");
}

async function rodarPortaoB() {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi("/api/relatorio/portao-b", {
    method: "POST",
    body: JSON.stringify({ author: "painel" }),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "portaob");
}

async function rodarAuditoria(formData: FormData) {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi("/api/relatorio/auditoria", {
    method: "POST",
    body: JSON.stringify({
      author: "painel",
      hypothesis_id: Number(formData.get("hypothesis_id")),
    }),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "auditoria");
}

async function provarReprodutibilidade() {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi("/api/relatorio/reprodutibilidade", {
    method: "POST",
    body: JSON.stringify({}),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "reprodutibilidade");
}

async function adotarCatalogo(formData: FormData) {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi("/api/config/catalogo", {
    method: "POST",
    body: JSON.stringify({
      author: String(formData.get("author") ?? "").trim(),
      note: "adocao do catalogo de provedores verificado",
    }),
  });
  revalidatePath("/");
  paraPainel(status, corpo, "config");
}

async function gravarSentinela(formData: FormData) {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const label = String(formData.get("label") ?? "").trim();
  if (label) {
    await chamarApi("/api/diagnostico/sentinela", {
      method: "POST",
      body: JSON.stringify({ label }),
    });
  }
  revalidatePath("/");
}

/* ---------------------------------------------------------------- pagina */

export default async function Painel({
  searchParams,
}: {
  searchParams: Promise<{
    ingestao?: string;
    config?: string;
    run?: string;
    comparacao?: string;
    agente?: string;
    b4?: string;
    portaob?: string;
    auditoria?: string;
    a1a?: string;
    a1b?: string;
    detalhe?: string;
  }>;
}) {
  if (!(await temSessao())) redirect("/login");

  const p = await searchParams;
  const [
    health, dataset, config, ledger, transacoes, sentinelas,
    simulador, execucoes, comparacao, agente, curva, relatorio,
    separacao, lote, creditos, b4, a1a, a1b, portaoA, portaoB,
  ] = await Promise.all([
    chamarApi("/api/substrato/health"),
    chamarApi("/api/dataset"),
    chamarApi("/api/config"),
    chamarApi("/api/ledger"),
    chamarApi("/api/ledger/transacoes?limite=12"),
    chamarApi("/api/diagnostico/sentinela"),
    chamarApi("/api/simulador"),
    chamarApi("/api/simulador/execucoes?limite=10"),
    chamarApi("/api/baselines"),
    chamarApi("/api/agente"),
    chamarApi("/api/baselines/curva"),
    chamarApi("/api/relatorio"),
    chamarApi("/api/dataset/separacao"),
    chamarApi("/api/validador/lote"),
    chamarApi("/api/validador/creditos"),
    chamarApi("/api/b4"),
    chamarApi("/api/a1a"),
    chamarApi("/api/a1b"),
    chamarApi("/api/relatorio/portao-a"),
    chamarApi("/api/relatorio/portao-b"),
  ]);

  if (health.status !== 200) {
    return (
      <>
        <div className="topo">
          <h1>Fase 0A — painel</h1>
        </div>
        <div className="card">
          <p className="bad" style={{ marginTop: 0 }}>
            Falha ao alcancar a api — HTTP {health.status}
          </p>
          <details open>
            <summary>resposta</summary>
            <pre>{JSON.stringify(health.corpo, null, 2)}</pre>
          </details>
          <p className="sub" style={{ marginTop: 12 }}>
            Confira, nesta ordem: <code>API_BASE_URL</code> com{" "}
            <code>https://</code> e sem barra no final;{" "}
            <code>API_SERVICE_TOKEN</code> identico na Vercel e na Railway; e o
            log de pre-voo da api mostrando <code>host</code> e{" "}
            <code>port</code> batendo com o target port do dominio.
          </p>
        </div>
      </>
    );
  }

  const h = health.corpo as Health;
  const d = dataset.corpo as Dataset;
  const c = config.status === 200 ? (config.corpo as ConfigResposta) : null;
  const l = ledger.status === 200 ? (ledger.corpo as Ledger) : null;
  const tx = (transacoes.corpo as Transacoes)?.items ?? [];
  const s = sentinelas.corpo as Sentinelas;
  const sim = simulador.corpo as Simulador;
  const exec = (execucoes.corpo as Execucoes)?.items ?? [];
  const cmp = comparacao.corpo as Comparacao;
  const ag = agente.corpo as Agente;
  const cv = curva.corpo as DadosDaCurva;
  const rel = relatorio.status === 200 ? (relatorio.corpo as Relatorio) : null;
  const cfg = c?.config ?? null;
  const sep = separacao.status === 200 ? (separacao.corpo as Separacao) : null;
  const lt = lote.status === 200 ? (lote.corpo as Lote) : null;
  const cr = creditos.status === 200 ? (creditos.corpo as Creditos) : null;
  const b = b4.status === 200 ? (b4.corpo as B4) : null;
  const ca = a1a.status === 200 ? (a1a.corpo as A1a) : null;
  const cb = a1b.status === 200 ? (a1b.corpo as A1b) : null;
  const pa = portaoA.status === 200 ? (portaoA.corpo as PortaoA) : null;
  const pb = portaoB.status === 200 ? (portaoB.corpo as PortaoB) : null;
  const pre = ag.pre_registro ?? null;
  const par = ag.parecer_do_validador ?? null;

    const faixa = ag.faixa ? FAIXA[ag.faixa] : undefined;
  const comparacaoVelha = cmp.existe && cmp.sob_a_config_vigente === false;
  const conferenciasOk =
    l &&
    l.conferencias.partidas_dobradas_ok &&
    l.conferencias.saldo_reconciliado_ok &&
    l.conferencias.vinculos_ok &&
    l.conferencias.sem_ponto_flutuante;

  return (
    <>
      <div className="topo">
        <h1>Fase 0A — painel do experimento</h1>
        <div className="contexto">
          <span>build {h.build}</span>
          <span>{h.app_env}</span>
          <span>schema v{h.schema_version}</span>
          {/* O estado inteiro num arquivo, para sair da tela e virar anexo.
              Texto copiado do navegador perde a estrutura: campo vira prosa
              e quem le do outro lado tem de adivinhar o que era rotulo.
              O pacote e montado na api, pelas mesmas funcoes que servem
              cada tela - o painel so baixa (secao 10.2.1). */}
          <a className="baixar" href="/api/proxy/relatorio/exportar" download>
            ↓ exportar estado (JSON)
          </a>
        </div>
      </div>

      {/* ===================================================== barra de estado
          A resposta a "onde estamos" sem rolar a pagina. Tudo aqui vem pronto
          da api: o painel nao deriva nem calcula nada (secao 10.2.1). */}
      <dl className="resumo">
        <Estado rotulo="run ativo">
          {h.run_ativo ? (
            <span className="ok">#{h.run_ativo}</span>
          ) : (
            <span className="sub">nenhum</span>
          )}
        </Estado>
        <Estado rotulo="config">
          v{h.config_version ?? "—"}{" "}
          {h.config_hash_confere === false ? (
            <span className="pill bad">hash nao descreve</span>
          ) : (
            <Hash valor={h.config_hash} />
          )}
        </Estado>
        <Estado rotulo="dataset">
          {d.existe ? (
            <>
              {d.barras_disponiveis?.toLocaleString("pt-BR")}{" "}
              <small className="sub">barras · fid. {d.fidelity_level}</small>
            </>
          ) : (
            <span className="warn">nao ingerido</span>
          )}
        </Estado>
        <Estado rotulo="ultimo run do agente">
          {ag.run_id ? (
            <>
              #{ag.run_id}{" "}
              <small className="sub">
                {ag.reflexoes ?? "?"} reflexoes
              </small>
            </>
          ) : (
            <span className="sub">nunca rodou</span>
          )}
        </Estado>
        <Estado rotulo="livro fecha">
          <Pill ok={conferenciasOk} sim="sim" nao="NAO" />
        </Estado>
      </dl>

      <Nav />

      {/* ================================================== 01 · EXECUTAR */}
      <Secao id="experimento">
        {/* Um card por acao, com o custo dela dito na frente. A acao que
            gasta dinheiro de verdade nao pode parecer com as outras. */}
        <div className="tres">
          <Card titulo="1 · Dataset">
            <p className="sub" style={{ margin: "0 0 8px", fontSize: 12.5 }}>
              Ingestao unica e idempotente, ~35 s. Lacuna na serie faz a api{" "}
              <strong>recusar</strong>.
            </p>
            {d.existe ? (
              <p style={{ margin: 0 }} className="mono">
                <span className="pill ok">pronto</span>{" "}
                <span className="sub">
                  {d.venue}:{d.symbol} {d.timeframe}
                </span>
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                <span className="pill warn">falta ingerir</span>
              </p>
            )}
            <div className="acoes">
              <form action={ingerirDataset} className="linha">
                <Botao pendente="ingerindo… (~35 s)">
                  {d.existe ? "Reexecutar" : "Ingerir dataset"}
                </Botao>
                <label className="caixa">
                  <input type="checkbox" name="aceitar_lacunas" />
                  aceitar lacunas
                </label>
              </form>
              <Resultado status={p.ingestao} detalhe={p.detalhe} />
            </div>
          </Card>

          <Card titulo="2 · Baselines">
            <p className="sub" style={{ margin: "0 0 8px", fontSize: 12.5 }}>
              B1, B2 e B3 sobre a mesma janela.{" "}
              <strong>Nenhum LLM e envolvido</strong> — se o encanamento nao
              fecha sem o modelo, o problema nao e o modelo.
            </p>
            <p style={{ margin: 0 }}>
              {cmp.existe ? (
                comparacaoVelha ? (
                  <span className="pill bad">de outra config</span>
                ) : (
                  <span className="pill ok">sob a config vigente</span>
                )
              ) : (
                <span className="pill warn">nunca rodou</span>
              )}
            </p>
            <div className="acoes">
              <form action={rodarComparacao} className="linha">
                <Botao pendente="rodando B1, B2 e B3…">
                  {cmp.existe ? "Reexecutar comparacao" : "Rodar comparacao"}
                </Botao>
                <span className="sub">de graca</span>
              </form>
              <Resultado status={p.comparacao} detalhe={p.detalhe} />
            </div>
          </Card>

          <Card titulo="3 · Agente">
            <p className="sub" style={{ margin: "0 0 8px", fontSize: 12.5 }}>
              Observa em Python, reflete, propoe regra do catalogo, registra a
              intencao e so entao executa. Produz junto o{" "}
              <strong>B1 casado com o giro dele</strong>.
            </p>
            <p style={{ margin: 0 }}>
              {ag.run_id ? (
                <span className="pill ok">run #{ag.run_id}</span>
              ) : (
                <span className="pill warn">nunca rodou</span>
              )}
            </p>
            <div className="acoes">
              <form action={rodarAgente} className="linha">
                <Botao pendente="refletindo e executando…" classe="gasta">
                  {ag.run_id ? "Rodar de novo" : "Rodar o agente"}
                </Botao>
                <span className="warn" style={{ fontSize: 12 }}>
                  gasta dinheiro de verdade
                </span>
              </form>
              <Resultado status={p.agente} detalhe={p.detalhe} />
            </div>
          </Card>

          <Card titulo="4 · B4 (controle)">
            <p className="sub" style={{ margin: "0 0 8px", fontSize: 12.5 }}>
              Busca aleatoria e varredura de parametro sobre o mesmo catalogo,
              pelo <strong>mesmo validador</strong> e com o{" "}
              <strong>mesmo orcamento</strong>. Sem ele, aprovar nao distingue
              &quot;a reflexao gera hipoteses melhores&quot; de &quot;o LLM e
              um custo decorativo&quot; (§14.3).
            </p>
            <p style={{ margin: 0 }}>
              {b?.quantas ? (
                <span className="pill ok">{b.quantas} hipoteses</span>
              ) : (
                <span className="pill warn">nunca rodou</span>
              )}
            </p>
            <div className="acoes">
              <form action={rodarB4} className="linha">
                <Botao pendente="buscando e executando…">
                  {b?.quantas ? "Rodar de novo" : "Rodar o B4"}
                </Botao>
                <span className="sub" style={{ fontSize: 12 }}>
                  nao gasta dinheiro — so CPU
                </span>
              </form>
              <Resultado status={p.b4} detalhe={p.detalhe} />
            </div>
          </Card>

          {/* Os dois controles do PROTOCOLO. B4 controla o agente; estes
              controlam quem julga — e §14.4 avalia o Portao A "antes de
              qualquer resultado do agente ser considerado". */}
          <Card titulo="5 · A1a (controles de defeito)">
            <p className="sub" style={{ margin: "0 0 8px", fontSize: 12.5 }}>
              Seis hipoteses <strong>construidas para revelar defeito</strong>,
              uma por familia de §14.4, injetadas{" "}
              <strong>pelo mesmo caminho das reais</strong>.{" "}
              <strong>Tolerancia zero</strong>: uma unica promocao reprova a
              fase.
            </p>
            <p style={{ margin: 0 }}>
              {ca?.quantas ? (
                (ca.promovidos ?? []).length ? (
                  <span className="pill bad">
                    {(ca.promovidos ?? []).length} promovido(s)
                  </span>
                ) : (
                  <span className="pill ok">{ca.quantas} injetados</span>
                )
              ) : (
                <span className="pill warn">nunca rodou</span>
              )}
            </p>
            <div className="acoes">
              <form action={rodarA1a} className="linha">
                <Botao pendente="injetando os seis…">
                  {ca?.quantas ? "Injetar de novo" : "Injetar os controles"}
                </Botao>
                <span className="sub" style={{ fontSize: 12 }}>
                  nao gasta dinheiro — so CPU
                </span>
              </form>
              <Resultado status={p.a1a} detalhe={p.detalhe} />
            </div>
          </Card>

          <Card titulo="6 · A1b (calibre)">
            <p className="sub" style={{ margin: "0 0 8px", fontSize: 12.5 }}>
              Nulas estocasticas em execucoes repetidas, nos dois desenhos da
              D29. Roda <strong>em pedacos</strong>: sao 400 execucoes a ~0,85 s
              cada, e uma requisicao de seis minutos nao e desenho, e aposta no
              timeout.
            </p>
            <p style={{ margin: 0 }}>
              {cb?.gravadas ? (
                <span
                  className={`pill ${
                    cb.gravadas >= 2 * (cb.execucoes_pedidas_por_desenho ?? 200)
                      ? "ok"
                      : "warn"
                  }`}
                >
                  {cb.gravadas} de{" "}
                  {2 * (cb.execucoes_pedidas_por_desenho ?? 200)} execucoes
                </span>
              ) : (
                <span className="pill warn">nunca rodou</span>
              )}
            </p>
            <div className="acoes">
              <form action={rodarA1b} className="linha">
                <label className="caixa">
                  <input
                    type="number"
                    name="quantas"
                    defaultValue={25}
                    min={1}
                    max={50}
                    style={{ width: 64 }}
                  />
                  execucoes
                </label>
                <Botao pendente="calibrando…">Rodar um pedaco</Botao>
              </form>
              <Resultado status={p.a1b} detalhe={p.detalhe} />
            </div>
          </Card>
        </div>

        {h.run_ativo ? (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="linha">
              <span className="pill warn">run #{h.run_ativo} aberto</span>
              <span className="sub" style={{ flex: 1, fontSize: 12.5 }}>
                Com run aberto a configuracao fica congelada e comparacao e
                agente sao recusados: alterar parametro no meio de um run
                quebraria a reprodutibilidade dele.
              </span>
              <form action={encerrarRun} className="linha">
                <input type="hidden" name="run_id" value={h.run_ativo} />
                <Botao pendente="encerrando…">Encerrar run</Botao>
              </form>
            </div>
            <Resultado status={p.run} detalhe={p.detalhe} />
          </div>
        ) : null}
      </Secao>

      {/* ================================================= 02 · RESULTADO */}
      <Secao id="resultado">
        {/* DE QUEM E ESTE RESULTADO - antes de qualquer numero.
            Um run em que o cerebro parou ainda tem patrimonio, ainda tem
            giro e ainda tem curva. O que ele nao tem e uma decisao
            cognitiva por tras, e sem este bloco a tela apresentava tudo
            isso como desempenho do agente. Foi o que aconteceu com o run
            27: "entre o p50 e o p95" sobre 244 idas e voltas que a regra
            padrao produziu depois de o provedor falhar.

            Quem decide e a api (regra 19); aqui so se mostra. */}
        {ag.atribuicao && !ag.atribuicao.atribuivel_ao_agente ? (
          <div className="aviso warn" style={{ marginTop: 0 }}>
            <p>
              <strong>Este resultado nao e do agente.</strong> Executou:{" "}
              <strong>{ag.atribuicao.o_que_executou}</strong>.
            </p>
            <p className="sub" style={{ fontSize: 12.5 }}>
              {ag.atribuicao.por_que}
            </p>
            {ag.parada ? (
              <p className="sub" style={{ fontSize: 12.5, marginBottom: 0 }}>
                Parou em <code>{ag.parada.node}</code>
                {ag.parada.categoria ? (
                  <>
                    {" "}
                    por <code>{ag.parada.categoria}</code>: {ag.parada.motivo}
                  </>
                ) : (
                  <>
                    {" "}
                    — <strong>sem categoria registrada</strong>: esta parada e
                    anterior a migracao 13, e o motivo dela existe so no log da
                    plataforma. Um run novo registra a causa aqui.
                  </>
                )}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* O CONTROLE CASA O GIRO DESTE RUN?
            A D19 existe para impedir comparar giros diferentes: cada ida e
            volta paga um pedagio fixo, entao quem opera menos ganha do B1 sem
            acertar nada. Quando o controle nao casa, a tabela inteira abaixo
            compara coisas diferentes - e ela parece plausivel do mesmo jeito.

            Aconteceu: a tela mostrou 37 idas e voltas do run ao lado de um
            controle de 70, porque o run exibido era outro. */}
        {ag.b1_casado_confere && !ag.b1_casado_confere.ligado ? (
          <div className="aviso" style={{ marginTop: 0 }}>
            <p style={{ marginBottom: 0 }}>
              <strong>Este run nao tem controle ligado.</strong> A ligacao
              entre o B1 casado e o run que ele casa existe desde a migracao
              14; runs anteriores a ela nao tem nenhuma, e nao ha comparacao
              com o acaso a fazer aqui —{" "}
              {ag.b1_casado_confere.por_que_importa}
            </p>
          </div>
        ) : null}

        {ag.b1_casado_confere &&
        ag.b1_casado_confere.ligado &&
        ag.b1_casado_confere.casa === false ? (
          <div className="aviso bad" style={{ marginTop: 0 }}>
            <p style={{ marginBottom: 0 }}>
              <strong>O controle ligado nao casa o giro deste run.</strong> O
              run fez {ag.b1_casado_confere.idas_e_voltas_do_run} idas e voltas
              e o controle foi casado com{" "}
              {ag.b1_casado_confere.operacoes_alvo ?? "?"}. Com a ligacao isto
              e defeito, e nao ambiguidade: toda comparacao abaixo mede giro, e
              nao escolha de momento — {ag.b1_casado_confere.por_que_importa}
            </p>
          </div>
        ) : null}

        {/* A faixa de numeros-chave: o que a secao responde, antes das
            tabelas. O HEROI e o excesso sobre o controle, e nao o patrimonio
            absoluto - a regra 14 e explicita: desempenho SEMPRE como excesso
            sobre baseline. "Sobrou US$ 620" nao responde pergunta nenhuma
            sem dizer quanto o acaso teria deixado. */}
        <Tiles>
          <Tile
            rotulo="Excesso sobre o acaso"
            heroi
            destaque
            contexto="contra a mediana do B1 casado — mesmo giro, mesmo tamanho de posicao"
          >
            <Dinheiro
              minor={cv.excesso_cents?.agente_sobre_B1_casado_p50}
              moeda="USD"
            />
          </Tile>
          <Tile
            rotulo="Onde caiu na distribuicao"
            contexto={
              ag.atribuicao && !ag.atribuicao.atribuivel_ao_agente
                ? "nao se afirma: o resultado nao e do agente"
                : ag.b1_casado
                  ? `${ag.b1_casado.repeticoes.toLocaleString("pt-BR")} repeticoes ao acaso`
                  : "sem controle comparavel"
            }
          >
            <span className={faixa?.tom}>{faixa?.texto ?? "—"}</span>
          </Tile>
          <Tile
            rotulo="Patrimonio final"
            contexto={
              cfg?.seed_capital_usd_cents ? (
                <>
                  sobre <Dinheiro minor={cfg.seed_capital_usd_cents} moeda="USD" />{" "}
                  de capital semente
                </>
              ) : undefined
            }
          >
            <Dinheiro minor={ag.patrimonio_final_cents} moeda="USD" />
          </Tile>
          <Tile
            rotulo="Idas e voltas"
            contexto={
              ag.b1_casado
                ? `o controle fez as mesmas ${ag.b1_casado.operacoes_alvo}`
                : undefined
            }
          >
            {(ag.idas_e_voltas ?? 0).toLocaleString("pt-BR")}
          </Tile>
          {/* `?? 0` aqui era mentira com consequencia: por D23, zero
              reflexoes significa que o agente E o B3. A tela mostrou "0" num
              run com duas reflexoes so porque a api nao mandava o campo -
              ausencia virando afirmacao, que e o que a secao 5.2 proibe no
              custo e vale igual aqui. */}
          <Tile
            rotulo="Reflexoes neste run"
            contexto={
              ag.reflexoes === undefined
                ? "a api nao informou"
                : ag.reflexoes === 0
                  ? "com zero, o agente e o proprio B3 (D23)"
                  : "cada uma custou dinheiro de verdade"
            }
          >
            {ag.reflexoes ?? "—"}
          </Tile>
        </Tiles>
        {comparacaoVelha ? (
          <div className="aviso bad" style={{ marginTop: 0 }}>
            <p>
              Esta comparacao rodou sob a{" "}
              <strong>
                config_version {cmp.config_versions_da_comparacao?.join(", ")}
              </strong>
              , e a vigente e a <strong>{cmp.config_version_vigente}</strong>.
              Alteracao material invalida comparacao que a atravesse (secao
              10.2.3): <strong>estes numeros nao descrevem a configuracao
              atual.</strong> Reexecute antes de compara-los com qualquer coisa.
            </p>
          </div>
        ) : null}

        <div className="card">
          <h3>Patrimonio ao longo da janela</h3>
          <Curva dados={cv} semente_cents={cfg?.seed_capital_usd_cents} />
          <p className="sub" style={{ marginTop: 10, fontSize: 12 }}>
            {cv.aviso}
          </p>
        </div>

        <div className="card">
          <h3>Resultado final e excesso sobre baseline</h3>
          <div className="rolavel">
            <table className="dados">
              <tbody>
                <tr className="cabeca">
                  <td>quem</td>
                  <td>o que mede</td>
                  <td className="num">patrimonio</td>
                  <td className="num">idas e voltas</td>
                  <td className="num">excesso</td>
                </tr>

                {ag.patrimonio_final_cents !== undefined ? (
                  <tr>
                    <td>
                      <strong>agente</strong>{" "}
                      <span className="sub">run {ag.run_id}</span>
                    </td>
                    <td className="sub">
                      a regra que o cerebro propos, com o custo do proprio
                      pensamento dentro
                    </td>
                    <td className="num">
                      <Dinheiro minor={ag.patrimonio_final_cents} moeda="USD" />
                    </td>
                    <td className="num">
                      {(ag.idas_e_voltas ?? 0).toLocaleString("pt-BR")}
                    </td>
                    <td className="num">
                      {/* Regra 14: desempenho SEMPRE como excesso sobre
                          baseline. O absoluto responde "quanto sobrou", que
                          nao e a pergunta do experimento. */}
                      <Dinheiro
                        minor={cv.excesso_cents?.agente_sobre_B1_casado_p50}
                        moeda="USD"
                      />
                    </td>
                  </tr>
                ) : null}

                {ag.b1_casado ? (
                  <tr>
                    <td>
                      <strong>B1 casado</strong> · p50
                    </td>
                    <td className="sub">
                      o acaso com <strong>o mesmo giro e o mesmo tamanho de
                      posicao</strong> do agente. E o unico B1 comparavel com
                      ele (D19, secao 14.3)
                    </td>
                    <td className="num">
                      <Dinheiro minor={ag.b1_casado.p50} moeda="USD" />
                    </td>
                    <td className="num">{ag.b1_casado.operacoes_alvo}</td>
                    <td className="sub num">referencia</td>
                  </tr>
                ) : null}

                {ag.b1_casado ? (
                  <tr>
                    <td className="sub">B1 casado · p5 → p95</td>
                    <td className="sub">
                      {ag.b1_casado.repeticoes.toLocaleString("pt-BR")}{" "}
                      repeticoes ·{" "}
                      {ag.b1_casado.fracao_bps != null
                        ? `${ag.b1_casado.fracao_bps / 100}% do caixa`
                        : "fracao nao registrada"}
                    </td>
                    <td className="num sub">
                      <Dinheiro minor={ag.b1_casado.p5} moeda="USD" /> →{" "}
                      <Dinheiro minor={ag.b1_casado.p95} moeda="USD" />
                    </td>
                    <td colSpan={2} />
                  </tr>
                ) : null}

                {cmp.B2 ? (
                  <tr>
                    <td>
                      <strong>B2</strong> buy and hold
                    </td>
                    <td className="sub">ganho sobre exposicao passiva</td>
                    <td className="num">
                      <Dinheiro minor={cmp.B2.equity_final_cents} moeda="USD" />
                    </td>
                    <td className="num">1</td>
                    <td className="num">
                      <Dinheiro
                        minor={cv.excesso_cents?.agente_sobre_B2}
                        moeda="USD"
                      />
                    </td>
                  </tr>
                ) : null}

                {cmp.B3 ? (
                  <tr>
                    <td>
                      <strong>B3</strong> SMA congelado
                    </td>
                    <td className="sub">ganho sobre uma regra trivial</td>
                    <td className="num">
                      <Dinheiro minor={cmp.B3.equity_final_cents} moeda="USD" />
                    </td>
                    <td className="num">{cmp.B3.idas_e_voltas ?? "—"}</td>
                    <td className="num">
                      <Dinheiro
                        minor={cv.excesso_cents?.agente_sobre_B3}
                        moeda="USD"
                      />
                    </td>
                  </tr>
                ) : null}

                {cmp.B1 ? (
                  <tr>
                    <td className="sub">B1 do B3 · p50</td>
                    <td className="sub">
                      casado com o giro do <strong>B3</strong>, nao com o do
                      agente — serve para ler o B3, nao o agente
                    </td>
                    <td className="num sub">
                      <Dinheiro minor={cmp.B1.p50} moeda="USD" />
                    </td>
                    <td className="num sub">{cmp.B1.operacoes_alvo}</td>
                    <td />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Quatro faixas, e nao tres. "Abaixo da mediana" para quem esta
              abaixo do p5 e verdade e subestima: perder de 95% do acaso e
              afirmacao diferente de perder de 51%, e arredondar a leitura para
              o lado confortavel e a mesma doenca de sempre. */}
          {faixa ? (
            <div className={`aviso ${faixa.tom}`}>
              <p>
                O agente esta <strong>{faixa.texto}</strong> da distribuicao do
                acaso com o mesmo giro e o mesmo tamanho de posicao.
                {faixa.alerta ? (
                  <>
                    {" "}
                    <strong>{faixa.alerta}</strong>
                  </>
                ) : null}{" "}
                <strong>Isto e leitura, nao conclusao</strong>
                {/* A frase SEGUE o numero, e nao o contrario.
                    Ela dizia sempre "o resultado e em amostra, porque o
                    cerebro observou a mesma janela em que operou" - texto da
                    0A, verdadeiro sob a D22. A D34 separou as janelas e a
                    sobreposicao caiu para zero; a frase continuou afirmando o
                    oposto do campo ao lado dela. */}
                {(ag.sobreposicao_amostral?.sobreposicao_bps ?? 0) > 0 ? (
                  <>
                    {" "}
                    — e o resultado e <strong>em amostra</strong>, porque o
                    cerebro observou a mesma janela em que operou.
                  </>
                ) : (
                  <>
                    . O cerebro observou <code>exploracao</code> e as maos
                    executaram <code>in_sample</code> (D34): a sobreposicao
                    amostral e zero, o que remove uma objecao e nao substitui
                    o veredito do validador.
                  </>
                )}
              </p>
            </div>
          ) : null}
        </div>
      </Secao>

      {/* ============================================== 03 · CONHECIMENTO */}
      <Secao id="conhecimento">
        {/* A pergunta da 0B, e ela nao e a da secao 02.
            §14.4: "a Fase 0 e primariamente um teste do VALIDADOR, e
            secundariamente um teste do agente". Ganhar do acaso num run e
            resultado; o protocolo aceitar a hipotese e outra coisa - e as
            duas podem discordar, como discordam aqui.

            Esta secao nao existia. Conferir a 0B exigia exportar o JSON e ler
            a mao, o que aconteceu nos tres primeiros runs da fase. */}
        {!pre ? (
          <div className="aviso warn" style={{ marginTop: 0 }}>
            <p style={{ marginBottom: 0 }}>
              <strong>Nenhuma hipotese pre-registrada neste run.</strong> Sem
              proposta aceita nao ha hipotese, e sem hipotese o validador nao
              tem sobre o que opinar. Veja a secao 02 para saber por que.
            </p>
          </div>
        ) : (
          <>
            <Tiles>
              <Tile
                rotulo="Veredito do validador"
                heroi
                destaque
                contexto="independente do agente (§8.1) — e 'inconclusivo' nunca vira sucesso (§14.4)"
              >
                <span
                  className={
                    par?.veredito === "sustentada"
                      ? "good"
                      : par?.veredito === "refutada"
                        ? "bad"
                        : "warn"
                  }
                >
                  {par?.veredito ?? "—"}
                </span>
              </Tile>
              <Tile
                rotulo="Amostra"
                contexto={
                  par?.detalhe?.amostra
                    ? `n_minimo declarado: ${par.detalhe.amostra.n_minimo.toLocaleString("pt-BR")}`
                    : "sem amostra medida"
                }
              >
                <span
                  className={par?.detalhe?.amostra?.suficiente ? "good" : "warn"}
                >
                  {par?.detalhe?.amostra
                    ? par.detalhe.amostra.n_efetivo.toLocaleString("pt-BR")
                    : "—"}
                </span>
              </Tile>
              <Tile
                rotulo="Efeito minimo"
                contexto="declarado ANTES de executar, e imutavel (§8.2)"
              >
                <Dinheiro minor={pre.efeito_minimo} moeda="USD" />
              </Tile>
              <Tile
                rotulo="Testavel no horizonte"
                contexto={
                  pre.testavel
                    ? `${pre.horizonte_barras.toLocaleString("pt-BR")} barras de execucao`
                    : (pre.motivo_nao_testavel ?? "nao testavel")
                }
              >
                <span className={pre.testavel ? "good" : "bad"}>
                  {pre.testavel ? "sim" : "nao"}
                </span>
              </Tile>
            </Tiles>

            <div className="card">
              <p className="sub" style={{ marginTop: 0, fontSize: 12.5 }}>
                <strong>Pre-registro #{pre.id}</strong> ·{" "}
                <code>{quebravel(pre.metrica_primaria)}</code> ·{" "}
                parada por <code>{quebravel(pre.criterio_parada)}</code> ·{" "}
                Sharpe declarado{" "}
                {(pre.sharpe_esperado_milesimos / 1000).toFixed(2)} ·{" "}
                <Hash valor={pre.content_hash} />
              </p>
              <p style={{ marginTop: 8, marginBottom: 0 }}>{pre.enunciado}</p>
              {par?.motivo ? (
                <p className="sub" style={{ marginTop: 10, marginBottom: 0 }}>
                  <strong>Parecer:</strong> {par.motivo}
                </p>
              ) : null}
            </div>

            {/* As condicoes de falseamento, com o que foi observado. Sao elas
                que tornam o veredito uma conta em vez de uma leitura: na 0A a
                expectativa era prosa e a avaliacao saia `None`. */}
            <div className="tabela">
              <table>
                <caption>
                  Condicoes de falseamento — o que refutaria esta hipotese
                </caption>
                <thead>
                  <tr>
                    <th>condicao</th>
                    <th className="num">observado</th>
                    <th>disparou?</th>
                  </tr>
                </thead>
                <tbody>
                  {(par?.detalhe?.condicoes_falseamento ?? []).map((cl, i) => (
                    <tr key={i}>
                      <td>
                        <code>{quebravel(cl.condicao)}</code>
                      </td>
                      <td className="num">
                        {cl.observado != null
                          ? cl.observado.toLocaleString("pt-BR")
                          : "—"}
                      </td>
                      <td>
                        {cl.disparou == null ? (
                          <span className="sub">
                            {cl.por_que_nao_conferida ?? "nao conferida"}
                          </span>
                        ) : (
                          // `disparou: true` significa que a hipotese foi
                          // CONTRARIADA - vermelho. O componente `Pill`
                          // pinta `ok=true` de verde, e inverter o booleano
                          // para caber nele deixaria a leitura ao contrario
                          // aqui no codigo.
                          <span
                            className={`pill ${cl.disparou ? "bad" : "ok"}`}
                          >
                            {cl.disparou ? "sim" : "nao"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!(par?.detalhe?.condicoes_falseamento ?? []).length ? (
                    <tr>
                      <td colSpan={3} className="sub">
                        Sem clausulas conferidas — o pre-registro exige ao menos
                        uma, imposta por CHECK no banco.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* O LOTE fechado. O limiar efetivo e o numero que decide promocao, e
            ele nao e o alfa: BY divide o alfa por H(m). */}
        {lt?.fechamento ? (
          <Tiles>
            <Tile
              rotulo="Procedimento"
              contexto={`H(${lt.fechamento.fdr.m}) = ${(
                lt.fechamento.fdr.correcao_harmonica_ppm / 1_000_000
              ).toFixed(4)} — escolhido antes da primeira hipotese (§8.6)`}
            >
              {lt.fechamento.fdr.procedimento}
            </Tile>
            <Tile
              rotulo="Limiar efetivo"
              contexto={`alvo de FDR ${(
                (lt.parametros?.fdr_alvo_bps ?? 0) / 100
              ).toFixed(0)}% dividido pela correcao`}
            >
              {(lt.fechamento.fdr.limiar_efetivo_ppm / 10000).toFixed(4)}%
            </Tile>
            <Tile
              rotulo="Familia"
              contexto={`teto de ${lt.fechamento.familia_max} fixado antes de comecar — a hipotese seguinte e RECUSADA, nunca truncada`}
            >
              {lt.fechamento.testadas} / {lt.fechamento.familia_max}
            </Tile>
            <Tile
              rotulo="Sobreviventes"
              contexto="passou em BY E no DSR — §8.6 pede as duas"
            >
              <span
                className={lt.fechamento.sobreviventes.length ? "good" : "warn"}
              >
                {lt.fechamento.sobreviventes.length}
              </span>
            </Tile>
            <Tile
              rotulo="Tentativas no contador global"
              contexto="alimenta o DSR e NUNCA e zerado: descartar tentativas fracassadas e o mecanismo que produz falsas descobertas (§8.6)"
            >
              {lt.fechamento.tentativas_globais}
            </Tile>
            {cr?.por_braco?.length ? (
              <Tile
                rotulo="Creditos de teste"
                contexto={`orcamento de ${cr.por_braco[0].orcamento} por braco (D30), pesos 1/3/5/10 de §8.6.1`}
              >
                {cr.por_braco[0].consumido} usado
                {cr.por_braco[0].consumido === 1 ? "" : "s"}
              </Tile>
            ) : null}
          </Tiles>
        ) : null}

        {/* OS DOIS BRACOS, por credito gasto.
            §14.3, R44: "mede se a reflexao produz hipoteses melhores POR
            CREDITO GASTO". Por hipotese nao serve - o agente gasta uma
            reflexao paga por hipotese e B4 gasta CPU, e o que a fase compara e
            o que cada credito comprou.

            §14.3 tambem diz o que fazer se empatarem, e vale estar escrito na
            tela: "se B4 empatar com o agente, isso nao mata o projeto -
            significa que o valor esta na infraestrutura de validacao, e a
            conclusao correta e remover o LLM do laco de geracao". */}
        {cr?.por_braco?.length ? (
          <div className="tabela">
            <table>
              <caption>
                Os dois bracos, por credito gasto — a comparacao que a fase
                existe para fazer (§14.3)
              </caption>
              <thead>
                <tr>
                  <th>braco</th>
                  <th className="num">config</th>
                  <th className="num">hipoteses</th>
                  <th className="num">creditos</th>
                  <th className="num">restante</th>
                  <th>reflexoes</th>
                </tr>
              </thead>
              <tbody>
                {/* Uma linha por (braco, config_version), e a linha DIZ qual
                    config e. Antes eram tres linhas "agente" e duas "B4" sob
                    o mesmo rotulo, com `hipoteses` e `reflexoes` do braco
                    VIGENTE em todas - numeros de um experimento ao lado do
                    consumo de outro, embaixo de uma legenda afirmando que a
                    comparacao exige a mesma config_version. */}
                {cr.por_braco.map((br) => (
                  <tr
                    key={`${br.braco}-${br.config_version_id}`}
                    style={br.vigente ? undefined : { opacity: 0.55 }}
                  >
                    <td>
                      <strong>{br.braco === "b4" ? "B4" : "agente"}</strong>
                      <span className="sub">
                        {br.braco === "b4"
                          ? " busca aleatoria e varredura"
                          : " reflexao com modelo"}
                      </span>
                    </td>
                    <td className="num">
                      {br.vigente ? (
                        <span className="pill ok">v{br.config_version_id}</span>
                      ) : (
                        <span className="sub">v{br.config_version_id}</span>
                      )}
                    </td>
                    <td className="num">{br.hipoteses}</td>
                    <td className="num">{br.consumido}</td>
                    <td className="num sub">{br.restante}</td>
                    <td>
                      {br.reflexoes === 0 ? (
                        <span className="pill ok">zero</span>
                      ) : (
                        <span className="sub">{br.reflexoes}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sub" style={{ fontSize: 12, marginBottom: 0 }}>
              Sobreviventes por credito e o numero do Portao A (§14.4, criterio
              &quot;supera B4 por credito consumido&quot;), e ele exige que os
              dois bracos tenham rodado sob a mesma <code>config_version</code>{" "}
              — por isso a coluna existe, e as linhas de outras config estao
              esmaecidas. Somar as linhas seria comparar experimentos
              diferentes.
            </p>
          </div>
        ) : null}

        {/* A SEPARACAO. O agente nao alcanca walk-forward nem holdout, e isso
            e da estrutura da consulta - `acesso` entra como literal no SQL,
            nunca como parametro (§8.5.1). */}
        {sep?.dividido ? (
          <div className="tabela">
            <table>
              <caption>
                Separacao por finalidade — a fronteira e da estrutura, nao da
                disciplina do agente (§8.5.1)
              </caption>
              <thead>
                <tr>
                  <th>conjunto</th>
                  <th className="num">barras</th>
                  <th>quem alcanca</th>
                </tr>
              </thead>
              <tbody>
                {(sep.conjuntos ?? []).map((cj) => (
                  <tr key={cj.finalidade}>
                    <td>
                      <code>{quebravel(cj.finalidade)}</code>
                    </td>
                    <td className="num">
                      {cj.barras.toLocaleString("pt-BR")}
                    </td>
                    <td>
                      <span
                        className={`pill ${
                          cj.acesso === "agente" ? "neutro" : "ok"
                        }`}
                      >
                        {cj.acesso}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sub" style={{ fontSize: 12, marginBottom: 0 }}>
              Vazamento conferido em {sep.sem_vazamento?.janelas ?? 0} janelas
              de walk-forward · purga {sep.sem_vazamento?.purga_barras} barras (
              {sep.sem_vazamento?.purga_origem}) · embargo{" "}
              {sep.sem_vazamento?.embargo_barras} ·{" "}
              {sep.sem_vazamento?.problemas.length ? (
                <span className="bad">
                  {sep.sem_vazamento.problemas.length} problema(s)
                </span>
              ) : (
                <span className="good">nenhum problema</span>
              )}{" "}
              · holdout consumido por {sep.holdout?.usos.length ?? 0} hipotese(s),
              uso unico imposto por UNIQUE no banco
            </p>
          </div>
        ) : (
          <div className="aviso bad">
            <p style={{ marginBottom: 0 }}>
              <strong>O dataset nao tem separacao por finalidade.</strong> Rodar
              o agente e recusado: sem os quatro conjuntos de §8.5.1, a hipotese
              nasceria olhando dados que deveriam estar selados. Use o botao de
              ingestao na secao 01 para criar a divisao.
            </p>
          </div>
        )}

        <details>
          <summary>json cru — validador, lote, creditos, separacao, b4</summary>
          <pre>
            {JSON.stringify(
              {
                pre_registro: pre,
                parecer: par,
                lote: lt,
                creditos: cr,
                separacao: sep,
                b4: b,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </Secao>

      {/* =================================================== 04 · PORTAO A */}
      <Secao id="portao-a">
        {/* A RESPOSTA primeiro, e ela tem tres estados.
            `pendente` nao e `passa`: o Portao A e "obrigatorio,
            eliminatorio", e um criterio que ninguem mediu nao e um criterio
            satisfeito. */}
        <div
          className={`aviso ${
            pa?.reprova ? "bad" : pa?.passa ? "ok" : ""
          }`}
          style={{ marginTop: 0 }}
        >
          <p style={{ marginBottom: 6 }}>
            <strong>
              {!pa?.existe
                ? "Sem configuracao para avaliar."
                : pa.reprova
                  ? "O Portao A REPROVA."
                  : pa.passa
                    ? "O Portao A passa."
                    : "O Portao A esta PENDENTE."}
            </strong>{" "}
            {pa?.reprova ? (
              <>Falhando: {(pa.reprovando ?? []).join(", ")}.</>
            ) : pa?.pendente ? (
              <>Ainda nao medido: {(pa.pendentes ?? []).join(", ")}.</>
            ) : null}
          </p>
          {pa?.reprova ? (
            <p className="sub" style={{ margin: 0, fontSize: 12.5 }}>
              {pa.se_reprova}
            </p>
          ) : null}
        </div>

        {pa?.condicoes ? (
          <div className="card" style={{ marginTop: 14 }}>
            <h3>As condicoes, cada uma derivada de consulta</h3>
            <table>
              <thead>
                <tr>
                  <th>criterio</th>
                  <th>resposta</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(pa.condicoes).map(([nome, ok]) => (
                  <tr key={nome}>
                    <td>
                      <code>{quebravel(nome)}</code>
                    </td>
                    <td>
                      <span
                        className={`pill ${
                          ok === true ? "ok" : ok === false ? "bad" : "warn"
                        }`}
                      >
                        {ok === true ? "sim" : ok === false ? "NAO" : "nao medido"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sub" style={{ marginBottom: 0, fontSize: 12.5 }}>
              <strong>nao medido</strong> nao e <strong>sim</strong>. No
              relatorio da 0A um <code>None</code> era neutro, e ali estava
              certo; aqui o portao e eliminatorio, e um criterio que ninguem
              mediu nao e um criterio satisfeito.
            </p>
          </div>
        ) : null}

        {/* ------------------------------------------------ A1a */}
        {ca?.quantas ? (
          <div className="card" style={{ marginTop: 14 }}>
            <h3>A1a — os seis controles, e o que aconteceu com cada um</h3>
            <table>
              <thead>
                <tr>
                  <th>familia de defeito</th>
                  <th>tipo</th>
                  <th>estado</th>
                  <th>promovido</th>
                </tr>
              </thead>
              <tbody>
                {(ca.hipoteses ?? []).map((hp) => (
                  <tr key={hp.hypothesis_id}>
                    <td>{hp.familia_de_defeito ?? hp.chave}</td>
                    <td>
                      <span className="pill neutro">{hp.tipo ?? "?"}</span>
                    </td>
                    <td>
                      <code>{quebravel(hp.estado ?? "—")}</code>
                    </td>
                    <td>
                      <span
                        className={`pill ${hp.promovido ? "bad" : "ok"}`}
                      >
                        {hp.promovido ? "SIM — reprova" : "nao"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* ------------------------------------------------ A1b */}
        {cb?.gravadas ? (
          <div className="card" style={{ marginTop: 14 }}>
            <h3>A1b — o calibre, nos dois desenhos</h3>
            {cb.magnitudes ? (
              <p className="sub" style={{ marginTop: 0, fontSize: 12.5 }}>
                As duas magnitudes de sinal implantado sao{" "}
                <strong>derivadas</strong> e <strong>nao coincidem</strong>: o
                piso testavel de §8.3 vale{" "}
                <strong>
                  {(cb.magnitudes.piso_testavel_milesimos / 1000).toFixed(3)}
                </strong>{" "}
                (calibrado em t = 2) e o que BY exige na primeira posicao vale{" "}
                <strong>
                  {(cb.magnitudes.detectavel_por_by_milesimos / 1000).toFixed(3)}
                </strong>{" "}
                (limiar de {cb.magnitudes.limiar_by_primeira_posicao_ppm} ppm).
                O planejamento de amostra e a correcao de multiplicidade sao
                reguas diferentes na mesma decisao.
              </p>
            ) : null}
            <table>
              <thead>
                <tr>
                  <th>desenho</th>
                  <th className="num">execucoes</th>
                  <th className="num">IC 95%</th>
                  <th>criterio</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(cb.desenhos ?? {}).map((dz) => (
                  <tr key={dz.desenho}>
                    <td>
                      <code>{quebravel(dz.desenho)}</code>
                    </td>
                    <td className="num">
                      {dz.execucoes} / {dz.execucoes_pedidas ?? "?"}
                    </td>
                    <td className="num mono">
                      {dz.promocao_do_lote
                        ? `${(dz.promocao_do_lote.intervalo.baixo_ppm / 10000).toFixed(2)}% – ${(dz.promocao_do_lote.intervalo.alto_ppm / 10000).toFixed(2)}%`
                        : "—"}
                    </td>
                    <td>
                      {!dz.completo ? (
                        <span className="pill warn">incompleto</span>
                      ) : dz.promocao_do_lote?.limite_superior_ate_o_alvo ? (
                        <span className="pill ok">dentro do alvo</span>
                      ) : (
                        <span className="pill bad">acima do alvo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sub" style={{ fontSize: 12.5 }}>
              O criterio e <strong>limite superior ≤ 10%</strong>, e nao &quot;o
              IC contem 10%&quot; — D37 (ADR 0024). Sob BY a segunda leitura e
              aritmeticamente inalcancavel: na nula global ele rejeita com
              probabilidade no maximo <code>alfa / H(48)</code> = 2,24%, entao o
              IC nunca chega a 10%. Ela reprovaria um BY correto por ele ser
              conservador.
            </p>

            {/* O PODER, ao lado do FDR. §14.4: "ambos os numeros sao
                registrados", e a frase esta na mesma linha em que o documento
                explica por que: "um sistema que rejeita ruido perfeitamente
                mas tambem rejeita efeitos verdadeiros implantados nao esta
                calibrado, esta apenas surdo".

                Ele existia no JSON e nao aparecia na tela - decima sexta vez
                que um numero deste projeto mora onde ninguem le. */}
            {(() => {
              const pd = Object.values(cb.desenhos ?? {}).find(
                (dz) => dz.promocao_do_lote?.poder,
              )?.promocao_do_lote?.poder;
              if (!pd) return null;
              const linhas = [
                ["piso testavel (§8.3, t = 2)", pd.piso_testavel],
                ["detectavel por BY (t = 3,31)", pd.detectavel_por_by],
              ] as const;
              return (
                <div className="tabela">
                  <table>
                    <caption>
                      Poder — a outra metade que §14.4 manda registrar
                    </caption>
                    <thead>
                      <tr>
                        <th>magnitude implantada</th>
                        <th className="num">implantados</th>
                        <th className="num">promovidos</th>
                        <th className="num">fracao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map(([rotulo, p]) => (
                        <tr key={rotulo}>
                          <td>{rotulo}</td>
                          <td className="num">
                            {p.implantados.toLocaleString("pt-BR")}
                          </td>
                          <td className="num">
                            {p.promovidos.toLocaleString("pt-BR")}
                          </td>
                          <td className="num mono">
                            {p.fracao_ppm == null
                              ? "—"
                              : `${(p.fracao_ppm / 10000).toFixed(2)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="sub" style={{ fontSize: 12, marginBottom: 0 }}>
                    Um sistema que rejeita ruido perfeitamente mas tambem
                    rejeita efeitos verdadeiros implantados nao esta calibrado,
                    esta apenas surdo (§14.4). E o poder medido aqui e{" "}
                    <strong>limite superior</strong>: o horizonte usado e o
                    in-sample inteiro, e uma hipotese real observa so as barras
                    em que esteve com posicao aberta.
                  </p>
                </div>
              );
            })()}
            {(cb.divergencias ?? []).length ? (
              <div className="aviso bad">
                <p style={{ margin: 0 }}>
                  {(cb.divergencias ?? []).join("; ")}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ------------------------------------------------ A2 e A4 */}
        {pa?.a2 ? (
          <div className="duas" style={{ marginTop: 14 }}>
            <Card titulo="A2 · o simulador e honesto?">
              <p className="sub" style={{ marginTop: 0, fontSize: 12.5 }}>
                Se operar ao acaso desse lucro, nada medido ali significaria
                coisa alguma (§8.4.1.3). Na 0A isto era sanidade; §14.4 o torna{" "}
                <strong>portao</strong>.
              </p>
              <table>
                <thead>
                  <tr>
                    <th className="num">giro</th>
                    <th className="num">perda</th>
                    <th className="num">por ida e volta</th>
                  </tr>
                </thead>
                <tbody>
                  {pa.a2.corridas.map((cr2) => (
                    <tr key={cr2.run_id}>
                      <td className="num">{cr2.operacoes_alvo}</td>
                      <td className="num">
                        <Dinheiro minor={cr2.perda_cents} moeda="USD" />
                      </td>
                      <td className="num mono">
                        {cr2.perda_por_ida_e_volta_cents == null
                          ? "—"
                          : (cr2.perda_por_ida_e_volta_cents / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pa.a2.por_que_sem_proporcional ? (
                <p className="sub" style={{ marginBottom: 0, fontSize: 12.5 }}>
                  {pa.a2.por_que_sem_proporcional}
                </p>
              ) : null}
            </Card>

            <Card titulo="A3 e A4 · vazamento e contabilidade">
              <p className="sub" style={{ marginTop: 0, fontSize: 12.5 }}>
                As mesmas perguntas que a suite faz, feitas ao{" "}
                <strong>banco de producao</strong>: um teste verde numa maquina
                nao diz nada sobre as linhas que existem aqui.
              </p>
              <table>
                <tbody>
                  {Object.entries({
                    ...(pa.a3?.conferencias ?? {}),
                    ...(pa.a4?.conferencias ?? {}),
                  }).map(([nome, ok]) => (
                    <tr key={nome}>
                      <td>
                        <code>{quebravel(nome)}</code>
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            ok === true ? "ok" : ok === false ? "bad" : "warn"
                          }`}
                        >
                          {ok === true ? "ok" : ok === false ? "NAO" : "?"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pa.a4 ? (
                <p className="sub" style={{ marginBottom: 0, fontSize: 12.5 }}>
                  {pa.a4.hipoteses_na_tabela} hipoteses na tabela contra{" "}
                  {pa.a4.contador_global} no contador global — conferido nos{" "}
                  <strong>dois sentidos</strong>, porque so um deixaria o
                  registro acumular linhas que nenhuma tentativa produziu.
                </p>
              ) : null}

              {/* O FATO que o portao NAO gateia, e que precisa ser lido.
                  Um numero de milhares de execucoes sem atribuicao nao
                  permite decidir nada - ele tanto pode ser o codigo de hoje
                  vazando quanto os runs da 0A, que rodaram sobre a janela
                  inteira quando a divisao por finalidade nem existia. */}
              {pa.a3?.walk_forward_ja_visto &&
              pa.a3.walk_forward_ja_visto.execucoes > 0 ? (
                <div className="aviso warn" style={{ marginTop: 10 }}>
                  <p style={{ marginBottom: 6 }}>
                    <strong>
                      O walk-forward ja foi executado —{" "}
                      {pa.a3.walk_forward_ja_visto.execucoes.toLocaleString(
                        "pt-BR",
                      )}{" "}
                      execucoes em{" "}
                      {pa.a3.walk_forward_ja_visto.runs} run(s) de outras
                      config_versions.
                    </strong>
                  </p>
                  <p className="sub" style={{ margin: 0, fontSize: 12.5 }}>
                    {pa.a3.walk_forward_ja_visto.o_que_isso_levanta} — nao
                    reprova o portao, e nao esta gateado: transformar isto em
                    criterio seria decidir sozinho o alcance de §8.5.1.
                  </p>
                </div>
              ) : null}
            </Card>
          </div>
        ) : null}

        {pa?.portao_b ? (
          <div className="aviso" style={{ marginTop: 14 }}>
            <p style={{ margin: 0 }}>
              <strong>Portao B: nao avaliado.</strong> {pa.portao_b.por_que}
            </p>
          </div>
        ) : null}

        {pa?.nao_responde ? (
          <div className="card" style={{ marginTop: 14 }}>
            <h3>O que o Portao A nao responde</h3>
            <ul className="sub" style={{ fontSize: 12.5 }}>
              {pa.nao_responde.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <details>
          <summary>json cru — portao A, a1a, a1b</summary>
          <pre>
            {JSON.stringify({ portao_a: pa, a1a: ca, a1b: cb }, null, 2)}
          </pre>
        </details>
      </Secao>

      {/* =================================================== 05 · PORTAO B */}
      <Secao id="portao-b">
        {/* A RECUSA vem primeiro quando ela e o caso. R49: sem o A aprovado
            INTEGRALMENTE, nao ha criterio nenhum a mostrar - nem parcial,
            nem "so para ver". Um numero exibido e um numero que alguem le. */}
        {!pb?.avaliado ? (
          <div className="aviso" style={{ marginTop: 0 }}>
            <p style={{ marginBottom: 6 }}>
              <strong>O Portao B nao foi avaliado.</strong>
            </p>
            <p className="sub" style={{ margin: 0, fontSize: 12.5 }}>
              {pb?.por_que ??
                "sem configuracao vigente nao ha o que avaliar"}
            </p>
          </div>
        ) : (
          <>
            <div
              className={`aviso ${
                pb.ha_candidata_digna_de_auditoria ? "warn" : ""
              }`}
              style={{ marginTop: 0 }}
            >
              <p style={{ marginBottom: 6 }}>
                <strong>
                  {pb.sem_candidata
                    ? "Nenhuma candidata nesta config_version."
                    : pb.ha_candidata_digna_de_auditoria
                      ? `${(pb.passaram ?? []).length} candidata(s) digna(s) de auditoria.`
                      : "Nenhuma candidata passou nos seis criterios."}
                </strong>
              </p>
              <p className="sub" style={{ margin: 0, fontSize: 12.5 }}>
                {pb.sem_candidata
                  ? pb.por_que_sem_candidata
                  : pb.auditoria ??
                    "O Portao B nao aprova um edge: ele decide se existe" +
                      " estrategia que mereca seguir para auditoria e forward."}
              </p>
            </div>

            {/* A COMPARACAO POR CREDITO, que e o criterio 4 e vale para o
                lote inteiro - §14.3 pergunta do braco, e nao da candidata. */}
            {pb.por_credito ? (
              <div className="tabela" style={{ marginTop: 14 }}>
                <table>
                  <caption>
                    Criterio 4 — sobreviventes por credito consumido (§14.3)
                  </caption>
                  <thead>
                    <tr>
                      <th>braco</th>
                      <th className="num">sustentadas</th>
                      <th className="num">creditos</th>
                      <th className="num">por credito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["agente", "b4"] as const).map((br) => (
                      <tr key={br}>
                        <td>
                          <strong>{br === "b4" ? "B4" : "agente"}</strong>
                        </td>
                        <td className="num">
                          {pb.por_credito![br].sustentadas}
                        </td>
                        <td className="num">
                          {pb.por_credito![br].creditos_consumidos}
                        </td>
                        <td className="num mono">
                          {pb.por_credito![br].por_credito_ppm == null
                            ? "—"
                            : (
                                pb.por_credito![br].por_credito_ppm! / 10000
                              ).toFixed(2) + "%"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pb.por_credito.por_que_sem_comparacao ? (
                  <p className="sub" style={{ fontSize: 12, marginBottom: 0 }}>
                    {pb.por_credito.por_que_sem_comparacao}
                  </p>
                ) : null}
                {pb.por_credito.o_que_o_empate_significa ? (
                  <div className="aviso warn" style={{ marginTop: 10 }}>
                    <p style={{ margin: 0, fontSize: 12.5 }}>
                      <strong>
                        {pb.por_credito.ambos_zerados
                          ? "Os dois bracos deram zero."
                          : "Os dois bracos empataram."}
                      </strong>{" "}
                      {pb.por_credito.o_que_o_empate_significa}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Uma tabela por candidata: os seis criterios, e o resultado. */}
            {(pb.candidatas ?? []).map((c) => (
              <div className="card" style={{ marginTop: 14 }} key={c.hypothesis_id}>
                <h3>
                  Hipotese #{c.hypothesis_id}{" "}
                  <span
                    className={`pill ${
                      c.resultado === "passou"
                        ? "ok"
                        : c.resultado === "rejeitado"
                          ? "bad"
                          : "warn"
                    }`}
                  >
                    {c.resultado}
                  </span>
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th>criterio de §14.4</th>
                      <th>resposta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(c.criterios).map(([nome, ok]) => (
                      <tr key={nome}>
                        <td>
                          <code>{quebravel(nome)}</code>
                        </td>
                        <td>
                          <span
                            className={`pill ${
                              ok === true ? "ok" : ok === false ? "bad" : "warn"
                            }`}
                          >
                            {ok === true
                              ? "sim"
                              : ok === false
                                ? "NAO"
                                : "nao medido"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {c.walk_forward?.executado ? (
                  <table>
                    <caption>
                      Walk-forward — {c.walk_forward.mantidas} de{" "}
                      {c.walk_forward.quantas} janelas mantiveram, e o minimo e{" "}
                      {c.walk_forward.minimo_de_janelas}
                    </caption>
                    <thead>
                      <tr>
                        <th className="num">janela</th>
                        <th className="num">barras</th>
                        <th className="num">idas e voltas</th>
                        <th className="num">observado</th>
                        <th>manteve</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(c.walk_forward.janelas ?? []).map((j) => (
                        <tr key={j.ordem}>
                          <td className="num">{j.ordem}</td>
                          <td className="num">
                            {j.barras.toLocaleString("pt-BR")}
                          </td>
                          <td className="num">{j.idas_e_voltas}</td>
                          <td className="num">
                            {j.observado == null ? (
                              "—"
                            ) : (
                              <Dinheiro minor={j.observado} moeda="USD" />
                            )}
                          </td>
                          <td>
                            <span
                              className={`pill ${
                                j.manteve === true
                                  ? "ok"
                                  : j.manteve === false
                                    ? "bad"
                                    : "warn"
                              }`}
                            >
                              {j.manteve === true
                                ? "sim"
                                : j.manteve === false
                                  ? "nao"
                                  : "nao observado"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="sub" style={{ fontSize: 12.5 }}>
                    <strong>Walk-forward nao executado.</strong>{" "}
                    {c.walk_forward?.por_que}
                  </p>
                )}
              </div>
            ))}

            <div className="acoes" style={{ marginTop: 14 }}>
              <form action={rodarPortaoB} className="linha">
                <Botao pendente="rodando o walk-forward…">
                  Rodar o walk-forward
                </Botao>
                <span className="sub" style={{ fontSize: 12 }}>
                  nao gasta dinheiro — CPU e runs
                </span>
              </form>
              <Resultado status={p.portaob} detalhe={p.detalhe} />
            </div>

            {/* A AUDITORIA de §14.4.1, e ela so aparece quando ha candidata
                aprovada - como o botao de reancorar so aparece quando ha
                deriva. Um botao permanentemente inutil convida a clicar nele
                para ver o que acontece, e o que acontece e abrir runs. */}
            {(pb.passaram ?? []).length ? (
              <div className="aviso warn" style={{ marginTop: 14 }}>
                <p style={{ marginBottom: 8 }}>
                  <strong>
                    Passar no Portao B dispara AUDITORIA, e nao comemoracao.
                  </strong>{" "}
                  §14.4.1: a probabilidade de um bug produzir este sinal e maior
                  que a de haver edge real em fidelidade 1–2, entao o resultado
                  e tratado como <strong>suspeita de defeito ate prova em
                  contrario</strong>.
                </p>
                {(pb.passaram ?? []).map((hid) => (
                  <form action={rodarAuditoria} className="linha" key={hid}>
                    <input type="hidden" name="hypothesis_id" value={hid} />
                    <Botao pendente="auditando…">
                      Auditar a hipotese #{hid}
                    </Botao>
                    <span className="sub" style={{ fontSize: 12 }}>
                      semente trocada e custo dobrado — abre runs, sem dinheiro
                    </span>
                  </form>
                ))}
                <Resultado status={p.auditoria} detalhe={p.detalhe} />
              </div>
            ) : null}
          </>
        )}

        {pb?.o_que_aprovar_nao_significa ? (
          <div className="card" style={{ marginTop: 14 }}>
            <h3>O que aprovar aqui NAO significa</h3>
            <ul className="sub" style={{ fontSize: 12.5 }}>
              {pb.o_que_aprovar_nao_significa.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <details>
          <summary>json cru — portao B</summary>
          <pre>{JSON.stringify(pb, null, 2)}</pre>
        </details>
      </Secao>

      {/* =================================================== 06 · DECISAO */}
      <Secao id="decisao">
        <Tiles>
          <Tile
            rotulo="Custo do pensamento"
            contexto="dinheiro real que saiu da conta neste run"
          >
            <Dinheiro minor={ag.gasto?.gasto_real_brl_cents} moeda="BRL" />
          </Tile>
          <Tile
            rotulo="Chamadas que custaram"
            contexto={
              ag.gasto && ag.reflexoes !== undefined
                ? `de ${ag.reflexoes} reflexoes — o resto veio do cache`
                : undefined
            }
          >
            {ag.gasto?.chamadas_com_custo ?? 0}
          </Tile>
          <Tile
            rotulo="Regra em vigor"
            contexto={
              ag.regra_ativa ? "proposta pelo cerebro" : "padrao, derivada da config (D23)"
            }
          >
            {quebravel(ag.regra_ativa?.family ?? "cruzamento_medias")}
          </Tile>
          <Tile
            rotulo="Confianca declarada"
            contexto="antes de executar, junto da expectativa (regra 17)"
          >
            {ag.regra_ativa?.confidence_ppm != null
              ? `${(ag.regra_ativa.confidence_ppm / 10000).toFixed(0)}%`
              : "—"}
          </Tile>
          <Tile
            rotulo="Sobreposicao com a janela executada"
            contexto="zero e o desenho da 0B: o cerebro observa exploracao e as maos executam in_sample (D34, que revisa a D22)"
          >
            {ag.sobreposicao_amostral?.sobreposicao_bps != null
              ? `${(ag.sobreposicao_amostral.sobreposicao_bps / 100).toFixed(0)}%`
              : "—"}
          </Tile>
        </Tiles>
        {ag.run_id ? (
          <>
            {ag.regra_ativa ? (
              <div className="card">
                <h3>Regra proposta e intencao declarada</h3>
                <table className="kv">
                  <tbody>
                    <tr>
                      <td>familia</td>
                      <td className="mono">
                        <code>{ag.regra_ativa.family}</code>
                      </td>
                    </tr>
                    <tr>
                      <td>parametros</td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {ag.regra_ativa.params_json}
                      </td>
                    </tr>
                    <tr>
                      <td>hash de conteudo</td>
                      <td>
                        <Hash valor={ag.regra_ativa.regra_hash} />
                      </td>
                    </tr>
                    <tr>
                      <td>confianca declarada</td>
                      <td className="mono">
                        {ag.regra_ativa.confidence_ppm != null
                          ? `${(ag.regra_ativa.confidence_ppm / 10_000).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="aviso ok">
                  <p className="sub" style={{ fontSize: 12.5 }}>
                    Expectativa gravada <strong>antes</strong> de qualquer
                    execucao, e nunca editada. A avaliacao posterior sera evento
                    novo, ao lado dela — nunca por cima (regra 17).
                  </p>
                  <p>{ag.regra_ativa.expectation}</p>
                </div>
              </div>
            ) : (
              <div className="aviso warn" style={{ marginTop: 0 }}>
                <p>
                  Nenhuma regra veio do cerebro neste run — as maos rapidas
                  rodaram a <strong>regra padrao</strong>, que e o mesmo
                  cruzamento do B3. Um resultado assim{" "}
                  <strong>nao esta medindo cerebro nenhum</strong>.
                </p>
              </div>
            )}

            <div className="card">
              <h3>Caminho percorrido, e o que cada etapa custou</h3>
              <div className="rolavel">
                <table className="dados">
                  <tbody>
                    <tr className="cabeca">
                      <td>no</td>
                      <td>tier</td>
                      <td className="num">entrada</td>
                      <td className="num">saida</td>
                      <td className="num">cache lido</td>
                      <td className="num">cache gravado</td>
                      <td className="num">custo</td>
                    </tr>
                    {ag.caminho.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <code>{e.node}</code>{" "}
                          <span className="sub">{e.kind}</span>
                        </td>
                        <td className="sub mono">{e.tier ?? "—"}</td>
                        {/* Nulo aparece como travessao e NUNCA como zero: "o
                            provedor nao informou" e "foi zero" sao afirmacoes
                            diferentes (secao 5.2). */}
                        <td className="num sub">{e.tokens_in ?? "—"}</td>
                        <td className="num sub">{e.tokens_out ?? "—"}</td>
                        <td className="num sub">{e.tokens_cache_read ?? "—"}</td>
                        <td className="num sub">
                          {e.tokens_cache_write ?? "—"}
                        </td>
                        <td className="num">
                          {e.cost_usd_micro
                            ? `US$ ${(e.cost_usd_micro / 1_000_000).toFixed(6)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="total">
                      <td>total do run</td>
                      <td colSpan={4} className="sub">
                        {ag.gasto?.chamadas_com_custo ?? 0} chamada(s) com custo
                        · saiu da conta{" "}
                        <Dinheiro
                          minor={ag.gasto?.gasto_real_brl_cents}
                          moeda="BRL"
                        />
                      </td>
                      <td className="sub num">
                        cache: {ag.cache_de_respostas ?? 0}
                      </td>
                      <td className="num">
                        {ag.gasto
                          ? `US$ ${(ag.gasto.gasto_micro / 1_000_000).toFixed(6)}`
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {ag.propostas.some((x) => x.status === "rejeitada") ? (
                <div className="aviso bad">
                  <p>
                    {ag.propostas.filter((x) => x.status === "rejeitada").length}{" "}
                    proposta(s) rejeitada(s), e a regra ativa anterior
                    permaneceu:
                  </p>
                  <p className="sub" style={{ fontSize: 12 }}>
                    {ag.propostas
                      .filter((x) => x.status === "rejeitada")
                      .map((x) => x.rejection_reason)
                      .join(" · ")}
                  </p>
                </div>
              ) : null}

              <p className="sub" style={{ marginTop: 12, fontSize: 12 }}>
                Sobreposicao entre a janela observada e a executada:{" "}
                <strong>
                  {ag.sobreposicao_amostral?.sobreposicao_bps != null
                    ? `${(ag.sobreposicao_amostral.sobreposicao_bps / 100).toFixed(0)}%`
                    : "—"}
                </strong>
                .{" "}
                {(ag.sobreposicao_amostral?.sobreposicao_bps ?? 0) > 0
                  ? `Na 0A o cerebro observava a mesma janela em que a regra
                     roda, entao o resultado e em amostra: suficiente para
                     responder "o ciclo fecha?", insuficiente para qualquer
                     afirmacao de desempenho.`
                  : `Na 0B o cerebro observa exploracao e as maos executam
                     in_sample (D34, secao 8.5.1), entao o resultado nao e em
                     amostra. Isso remove uma objecao — nao promove nada: quem
                     conclui e o validador, na secao 03.`}{" "}
                Arredondamento do custo conferido:{" "}
                <Pill ok={ag.arredondamento_do_custo_ok} />
              </p>
              <details>
                <summary>condicoes de validade deste run</summary>
                <pre>{ag.condicoes_validade}</pre>
              </details>
            </div>
          </>
        ) : (
          <div className="card">
            <p className="sub" style={{ margin: 0 }}>
              O agente ainda nao rodou. Enquanto isso, o experimento tem
              baselines e nao tem cerebro.
            </p>
          </div>
        )}
      </Secao>

      {/* ================================================== 04 · EXECUCAO */}
      <Secao id="execucao">
        <Tiles>
          <Tile rotulo="Idas e voltas" contexto="uma compra e a venda que a fecha">
            {(ag.idas_e_voltas ?? 0).toLocaleString("pt-BR")}
          </Tile>
          <Tile
            rotulo="Execucoes"
            contexto="linhas de ordem — o dobro das idas e voltas, quando todas fecham"
          >
            {(sim.execucoes ?? 0).toLocaleString("pt-BR")}
          </Tile>
          <Tile rotulo="Custo total de execucao" contexto="taxa, spread, slippage e penalidade">
            <Dinheiro minor={ag.custos_cents?.execucao_total} moeda="USD" />
          </Tile>
          <Tile rotulo="Fidelidade da simulacao" contexto="nivel 1 — barras OHLCV, sem book">
            {sim.fidelity_level ?? "—"}
          </Tile>
        </Tiles>
        <div className="duas">
          <Card titulo="Custos, decompostos">
            {/* Um campo "custo" agregado nao passaria no criterio 3 do
                incremento 3: sem separar, e impossivel saber depois qual
                componente comeu o resultado. */}
            <table className="kv">
              <tbody>
                <tr>
                  <td>taxa (taker)</td>
                  <td className="num">
                    <Dinheiro minor={sim.custos_cents?.taxa} moeda="USD" />
                  </td>
                </tr>
                <tr>
                  <td>spread</td>
                  <td className="num">
                    <Dinheiro minor={sim.custos_cents?.spread} moeda="USD" />
                  </td>
                </tr>
                <tr>
                  <td>slippage</td>
                  <td className="num">
                    <Dinheiro minor={sim.custos_cents?.slippage} moeda="USD" />
                  </td>
                </tr>
                <tr>
                  <td>penalidade</td>
                  <td className="num">
                    <Dinheiro minor={sim.custos_cents?.penalidade} moeda="USD" />
                  </td>
                </tr>
                <tr className="total">
                  <td>total</td>
                  <td className="num">
                    <Dinheiro minor={sim.custos_cents?.total} moeda="USD" />
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card titulo="Estado da simulacao">
            <table className="kv">
              <tbody>
                <tr>
                  <td>execucoes</td>
                  <td className="num">
                    {(sim.execucoes ?? 0).toLocaleString("pt-BR")}
                    {sim.encerrado && sim.run_exibido ? (
                      <span className="sub">
                        {" "}
                        · run {sim.run_exibido} (encerrado)
                      </span>
                    ) : null}
                  </td>
                </tr>
                <tr>
                  <td>posicao</td>
                  <td className="num">
                    {sim.posicao_sats ? `${btc(sim.posicao_sats)} BTC` : "zerada"}
                  </td>
                </tr>
                <tr>
                  <td>fidelidade declarada</td>
                  <td className="num">
                    {/* O nivel viaja junto do numero e aparece na tela: custo
                        sem a fidelidade que o produziu convida a conclusao que
                        a 0A nao sustenta. */}
                    {sim.fidelidade_homogenea === false ? (
                      <span className="pill bad">MISTA — nao declarar</span>
                    ) : (
                      <span className="pill neutro">
                        nivel {sim.fidelity_level ?? d.fidelity_level ?? "—"}
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>

        <div className="card">
          <h3>Execucoes recentes</h3>
          {exec.length ? (
            <div className="rolavel">
              <table className="dados">
                <tbody>
                  <tr className="cabeca">
                    <td>lado</td>
                    <td>decisao</td>
                    <td>execucao</td>
                    <td className="num">quantidade</td>
                    <td className="num">referencia</td>
                    <td className="num">executado</td>
                  </tr>
                  {exec.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <span
                          className={`pill ${
                            e.side === "compra" ? "neutro" : "neutro"
                          }`}
                        >
                          {e.side}
                        </span>
                      </td>
                      {/* Os dois instantes aparecem SEPARADOS: e a latencia
                          estrutural, e ve-la e o que impede alguem de supor
                          execucao na barra da decisao. */}
                      <td className="sub mono" style={{ fontSize: 12 }}>
                        <Utc ms={e.decision_bar_ms} />
                      </td>
                      <td className="sub mono" style={{ fontSize: 12 }}>
                        <Utc ms={e.execution_bar_ms} />
                      </td>
                      <td className="num sub">{btc(e.quantity_sats)}</td>
                      <td className="num sub">{preco(e.price_ref)}</td>
                      <td className="num">{preco(e.price_exec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="sub" style={{ margin: 0 }}>
              Nenhuma execucao ainda.
            </p>
          )}
        </div>
      </Secao>

      {/* ================================================== 05 · DINHEIRO */}
      <Secao id="dinheiro">
        {l?.escopo === "livro_inteiro" ? (
          <div className="aviso warn" style={{ marginTop: 0 }}>
            <p>
              Nenhum run ativo — os saldos abaixo sao do{" "}
              <strong>livro inteiro</strong>, somando os {l.runs_somados} runs
              que ja existiram. <strong>Nao e a carteira de um run.</strong>
            </p>
          </div>
        ) : null}

        <div className="duas">
          <Card titulo="Livro simulado (USD)">
            <table className="kv">
              <tbody>
                <tr>
                  <td>caixa</td>
                  <td className="num">
                    <Dinheiro
                      minor={l?.carteira.simulado_usd.caixa_minor}
                      moeda="USD"
                    />
                  </td>
                </tr>
                <tr>
                  <td>posicao em BTC</td>
                  <td className="num">
                    <Dinheiro
                      minor={l?.carteira.simulado_usd.posicao_btc_minor}
                      moeda="USD"
                    />
                  </td>
                </tr>
                <tr>
                  <td>custo de execucao</td>
                  <td className="num">
                    <Dinheiro
                      minor={l?.carteira.simulado_usd.custo_execucao_minor}
                      moeda="USD"
                    />
                  </td>
                </tr>
                <tr>
                  <td>tesouraria (reflexao)</td>
                  <td className="num">
                    <Dinheiro
                      minor={l?.carteira.simulado_usd.tesouraria_minor}
                      moeda="USD"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card titulo="Livro real (BRL)">
            <table className="kv">
              <tbody>
                <tr>
                  <td>caixa da tesouraria</td>
                  <td className="num">
                    <Dinheiro
                      minor={l?.carteira.real_brl.caixa_minor}
                      moeda="BRL"
                    />
                  </td>
                </tr>
                <tr>
                  <td>despesa de inferencia</td>
                  <td className="num">
                    <Dinheiro
                      minor={l?.carteira.real_brl.despesa_inferencia_minor}
                      moeda="BRL"
                    />
                  </td>
                </tr>
                <tr>
                  <td>taxa de cambio</td>
                  <td className="num sub">
                    {cfg?.fx_brl_per_usd} · {cfg?.fx_rate_date}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="sub" style={{ marginTop: 10, fontSize: 12 }}>
              Os dois livros nunca se somam. A taxa fica gravada em cada evento,
              para que variacao cambial nao vire desempenho (secao 4.2).
            </p>
          </Card>
        </div>

        <div className="card">
          <h3>Conferencias do livro</h3>
          <div className="linha" style={{ gap: 8 }}>
            <Pill ok={l?.conferencias.partidas_dobradas_ok} sim="partidas dobradas" nao="PARTIDAS DOBRADAS" />
            <Pill ok={l?.conferencias.saldo_reconciliado_ok} sim="saldo reconciliado" nao="SALDO DIVERGE" />
            <Pill ok={l?.conferencias.vinculos_ok} sim="evento ↔ lancamento" nao="VINCULO QUEBRADO" />
            <Pill ok={l?.conferencias.sem_ponto_flutuante} sim="sem ponto flutuante" nao="COLUNA REAL" />
            <span className="sub" style={{ fontSize: 12 }}>
              {l?.transacoes.toLocaleString("pt-BR")} transacoes ·{" "}
              {l?.eventos} eventos
            </span>
          </div>

          {tx.length ? (
            <div className="rolavel" style={{ marginTop: 14 }}>
              <table className="dados">
                <tbody>
                  <tr className="cabeca">
                    <td>id</td>
                    <td>tipo</td>
                    <td>quando</td>
                    <td className="num">lanc.</td>
                    <td>nota</td>
                  </tr>
                  {tx.map((t) => (
                    <tr key={t.id}>
                      <td className="mono" style={{ width: "auto" }}>
                        {t.id}
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            t.kind === "estorno" ? "warn" : "neutro"
                          }`}
                        >
                          {t.kind}
                        </span>
                      </td>
                      <td className="sub mono" style={{ fontSize: 12 }}>
                        {t.occurred_at}
                      </td>
                      <td className="num">{t.lancamentos}</td>
                      <td className="sub">
                        {t.reverses_transaction_id
                          ? `estorna ${t.reverses_transaction_id}`
                          : t.memo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>
              Nenhuma transacao ainda.
            </p>
          )}
        </div>
      </Secao>

      {/* =============================================== 06 · CONFIGURACAO */}
      <Secao id="ajustes">
        {h.config_hash_confere === false ? (
          <div className="aviso bad" style={{ marginTop: 0 }}>
            <p>
              <strong>O hash gravado nao descreve mais esta configuracao.</strong>{" "}
              Acontece quando o schema ganha um campo: o payload continua o
              mesmo, mas reconstrui-lo produz outro objeto. Abrir run fica
              bloqueado — e isso e o mecanismo funcionando.
            </p>
            <form action={reancorarConfig} className="linha" style={{ marginTop: 10 }}>
              <input name="author" placeholder="autor" required style={{ flex: 1 }} />
              <Botao pendente="reancorando…">Reancorar configuracao</Botao>
            </form>
          </div>
        ) : null}

        {c?.catalogo_desatualizado?.length ? (
          <div className="aviso warn" style={{ marginTop: 0 }}>
            <p>
              <strong>Catalogo de provedores desatualizado no banco:</strong>{" "}
              <code>{c.catalogo_desatualizado.join(", ")}</code>
            </p>
            <p className="sub" style={{ fontSize: 12 }}>
              O banco e a autoridade sobre o experimento — isto nao e "o banco
              esta errado", e a constatacao de que ele discorda do catalogo
              verificado. Adotar toca <strong>apenas</strong> tiers, tabela de
              precos e a versao dela. <strong>E material:</strong> preco
              alimenta o teto de gasto, e o teto decide quantas reflexoes cabem
              num run.
            </p>
            <form action={adotarCatalogo} className="linha" style={{ marginTop: 10 }}>
              <input name="author" placeholder="autor" required style={{ flex: 1 }} />
              <Botao pendente="adotando…">Adotar catalogo verificado</Botao>
            </form>
          </div>
        ) : null}

        <div className="duas">
          <Card titulo={`Versao ${h.config_version ?? "—"} — vigente`}>
            <table className="kv">
              <tbody>
                <tr>
                  <td>config_hash</td>
                  <td className="num">
                    <Hash valor={h.config_hash} />
                  </td>
                </tr>
                <tr>
                  <td>instrumento</td>
                  <td className="num mono">
                    {cfg?.market_venue}:{cfg?.market_symbol} {cfg?.timeframe}
                  </td>
                </tr>
                <tr>
                  <td>janela de dados</td>
                  <td className="num mono">
                    {cfg?.data_start} → {cfg?.data_end}
                  </td>
                </tr>
                <tr>
                  <td>fracao reservada</td>
                  <td className="num mono">{cfg?.reserved_fraction}</td>
                </tr>
                <tr>
                  <td>referencia da execucao</td>
                  <td className="num mono">{cfg?.execution_reference}</td>
                </tr>
                <tr>
                  <td>capital semente</td>
                  <td className="num">
                    <Dinheiro
                      minor={cfg?.seed_capital_usd_cents}
                      moeda="USD"
                    />
                  </td>
                </tr>
                <tr>
                  <td>estado</td>
                  <td className="num">
                    <span className={`pill ${c?.congelada ? "warn" : "neutro"}`}>
                      {c?.congelada ? "congelada (run ativo)" : "editavel"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card titulo="Dataset fixado">
            {d.existe ? (
              <table className="kv">
                <tbody>
                  <tr>
                    <td>sha256</td>
                    <td className="num">
                      <Hash valor={d.sha256} />
                    </td>
                  </tr>
                  <tr>
                    <td>janela</td>
                    <td className="num sub mono" style={{ fontSize: 12 }}>
                      <Utc ms={d.start_ms} /> → <Utc ms={d.end_ms} />
                    </td>
                  </tr>
                  <tr>
                    <td>barras disponiveis</td>
                    <td className="num">
                      {d.barras_disponiveis?.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                  <tr>
                    <td>barras reservadas</td>
                    <td className="num">
                      {d.barras_reservadas?.toLocaleString("pt-BR")}
                      <span className="sub">
                        {" "}
                        desde <Utc ms={d.reserved_from_ms} />
                      </span>
                    </td>
                  </tr>
                  <tr className="total">
                    <td>total</td>
                    <td className="num">
                      {d.barras_total?.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="sub" style={{ margin: 0 }}>
                Dataset ainda nao ingerido.
              </p>
            )}
          </Card>
        </div>

        <Card titulo="Alterar parametros do experimento">
          <p className="sub" style={{ margin: "0 0 4px", fontSize: 12.5 }}>
            Cria uma <strong>nova versao</strong> com autor, data, valor
            anterior e novo (secao 10.2.3). Nada e sobrescrito. Alteracao
            material invalida comparacao com runs anteriores.{" "}
            <strong>Isto edita parametros, nunca a estrategia</strong> — a
            estrategia vem da reflexao do agente e o painel nao a toca.
          </p>
          <form action={alterarConfig} className="forma">
            <div className="linha">
              <input name="author" placeholder="autor" required style={{ flex: 1 }} />
              <input name="note" placeholder="motivo da mudanca" style={{ flex: 2 }} />
            </div>
            <textarea
              name="changes"
              rows={2}
              required
              spellCheck={false}
              defaultValue={'{"b3_fast": 20, "b3_slow": 50}'}
              style={{ fontSize: 12 }}
            />
            <div className="linha">
              <Botao pendente="gravando versao…">Criar nova versao</Botao>
            </div>
          </form>
          <Resultado status={p.config} detalhe={p.detalhe} />
        </Card>
      </Secao>

      {/* ================================================= 07 · SUBSTRATO */}
      <Secao id="fechamento">
        {/* O relatorio da 0A. Nenhum numero e calculado aqui: a resposta
            inteira vem de /api/relatorio, onde ela e DERIVADA de doze
            consultas ao banco. O painel so desenha (secao 10.2.1). */}
        {!rel?.existe ? (
          <div className="card">
            <p className="sub" style={{ marginTop: 0 }}>
              {rel?.motivo ?? "Relatorio indisponivel."} Rode o ciclo do agente
              na secao <a href="#experimento">01</a> para que haja o que relatar.
            </p>
          </div>
        ) : (
          <>
            <div
              className={rel.resposta_da_0a?.fecha ? "aviso ok" : "aviso warn"}
              style={{ marginTop: 0 }}
            >
              <p style={{ marginTop: 0 }}>
                <strong>{rel.resposta_da_0a?.pergunta}</strong>{" "}
                {rel.resposta_da_0a?.fecha ? (
                  <span className="good">Sim.</span>
                ) : (
                  <span className="bad">Ainda nao.</span>
                )}
              </p>
              {rel.resposta_da_0a?.fecha ? (
                <p className="sub" style={{ fontSize: 12.5, marginBottom: 0 }}>
                  As doze condicoes abaixo foram conferidas contra o banco.
                  Nenhuma delas e digitada: cada uma e um booleano que sai de
                  uma consulta. Uma resposta em prosa sobreviveria a qualquer
                  regressao futura sem mudar uma letra.
                </p>
              ) : (
                <>
                  <p className="sub" style={{ fontSize: 12.5 }}>
                    {rel.resposta_da_0a?.se_nao_fecha}
                  </p>
                  <p className="sub" style={{ fontSize: 12.5, marginBottom: 0 }}>
                    Falta: <code>{rel.resposta_da_0a?.faltando.join(", ")}</code>
                  </p>
                </>
              )}
            </div>

            <div className="grade grade-livre">
              <Card titulo="As doze condicoes">
                <table className="kv">
                  <tbody>
                    {Object.entries(rel.resposta_da_0a?.condicoes ?? {}).map(
                      ([nome, valor]) => (
                        <tr key={nome}>
                          <td>{nome.replace(/_/g, " ")}</td>
                          <td className="num">
                            <Pill ok={valor} indefinido="nao se aplica" />
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
                <Nota>
                  <strong>Nao se aplica nao e nao.</strong> Com o teto em zero
                  nao ha custo de decisao a registrar (D23), e reprovar o run
                  por essa ausencia confundiria "nao sei" com "nao" — a mesma
                  confusao que a secao 5.2 proibe no custo.
                </Nota>
              </Card>

              <Card titulo="Reprodutibilidade (R12)">
                {rel.reprodutibilidade ? (
                  <>
                    <table className="kv">
                      <tbody>
                        <tr>
                          <td>mesma semente, A</td>
                          <td className="num">
                            <Hash
                              valor={rel.reprodutibilidade.mesma_semente.digest_a}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>mesma semente, B</td>
                          <td className="num">
                            <Hash
                              valor={rel.reprodutibilidade.mesma_semente.digest_b}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>semente diferente, C</td>
                          <td className="num">
                            <Hash
                              valor={
                                rel.reprodutibilidade.semente_diferente.digest
                              }
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="linha" style={{ gap: 8, marginTop: 10 }}>
                      <Pill
                        ok={rel.reprodutibilidade.mesma_semente.iguais}
                        sim="A = B"
                        nao="A != B"
                      />
                      <Pill
                        ok={
                          rel.reprodutibilidade.semente_diferente
                            .difere_do_primeiro
                        }
                        sim="C diferente de A"
                        nao="C igual a A"
                      />
                      <Pill
                        ok={rel.reprodutibilidade.config_hash_igual_nas_tres}
                        sim="mesmo config_hash"
                        nao="config_hash mudou"
                      />
                    </div>
                    <p className="sub" style={{ fontSize: 12, marginTop: 10 }}>
                      As duas metades importam. Sem a segunda, um digest
                      constante passaria na primeira sempre — inclusive quando
                      nada estivesse sendo medido.
                    </p>
                  </>
                ) : (
                  <p className="sub" style={{ marginTop: 0 }}>
                    Prova ainda nao rodada nesta base.
                  </p>
                )}
                <form action={provarReprodutibilidade} style={{ marginTop: 10 }}>
                  <Botao pendente="provando…">Rodar a prova</Botao>
                </form>
                <Nota>
                  Tres runs de B1 pelo ledger.{" "}
                  <strong>Nenhuma chamada de LLM</strong> — a prova nao pode
                  custar dinheiro nem depender de o cache estar quente.
                </Nota>
              </Card>

              <Card titulo="Vinculo nos dois sentidos (R25.2)">
                {rel.vinculo?.conferido ? (
                  <p className="sub" style={{ marginTop: 0 }}>
                    Da execucao <code>#{rel.vinculo.execution_id}</code>{" "}
                    chega-se ao evento cognitivo{" "}
                    <code>#{rel.vinculo.evento_cognitivo}</code>, subindo{" "}
                    {rel.vinculo.profundidade_da_cadeia} niveis — e desse evento
                    se volta a mesma execucao, entre as{" "}
                    {rel.vinculo.execucoes_autorizadas} que a regra autorizou.
                  </p>
                ) : (
                  <p className="sub" style={{ marginTop: 0 }}>
                    {rel.vinculo?.motivo ?? "Nao conferido."}
                  </p>
                )}
                <Nota>
                  Conferido nos dois sentidos de proposito: um vinculo que so
                  funciona num deles passaria em duas consultas isoladas.
                </Nota>
              </Card>

              <Card titulo="Relatorio completo">
                <p className="sub" style={{ marginTop: 0 }}>
                  As dez secoes, geradas do banco:{" "}
                  <a href="/api/proxy/relatorio/markdown" target="_blank">
                    abrir em Markdown
                  </a>
                  .
                </p>
                <details>
                  <summary>o que a 0A nao conclui, em nenhuma hipotese</summary>
                  <ul className="sub" style={{ fontSize: 12.5 }}>
                    {(rel.nao_concluido ?? []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </details>
                <details>
                  <summary>JSON cru</summary>
                  <pre>{JSON.stringify(rel, null, 2)}</pre>
                </details>
              </Card>
            </div>
          </>
        )}
      </Secao>

      <Secao id="substrato">
        <div className="duas">
          <Card titulo="Credenciais e volume">
            <table className="kv">
              <tbody>
                <tr>
                  <td>credencial anthropic</td>
                  <td className="num">
                    <Pill ok={h.credenciais_configuradas.anthropic} />
                  </td>
                </tr>
                <tr>
                  <td>credencial openai</td>
                  <td className="num">
                    <Pill ok={h.credenciais_configuradas.openai} />
                  </td>
                </tr>
                <tr>
                  <td>banco</td>
                  <td className="num mono" style={{ fontSize: 12 }}>
                    {quebravel(h.db_path, /[\\/]/g)}
                  </td>
                </tr>
                <tr>
                  <td>volume gravavel</td>
                  <td className="num">
                    <Pill ok={h.volume_gravavel} />
                  </td>
                </tr>
                <tr>
                  <td>volume montado</td>
                  <td className="num">
                    <Pill ok={h.volume_montado} />
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="sub" style={{ marginTop: 10, fontSize: 12 }}>
              Presenca da credencial, <strong>nunca o valor</strong> (secao
              10.2.4). Gravavel e montado sao perguntas diferentes: a primeira
              nao prova persistencia.
            </p>
          </Card>

          <Card titulo="Sentinela de persistencia">
            <p className="sub" style={{ margin: "0 0 10px", fontSize: 12.5 }}>
              Grava um marcador, dispara um redeploy, confere se ele sobreviveu.
              "Consigo escrever" nao e "isto persiste" — foi assim que o
              primeiro deploy perdeu dados em silencio.
            </p>
            <form action={gravarSentinela} className="linha">
              <input name="label" placeholder="rotulo" style={{ flex: 1 }} />
              <Botao pendente="gravando…">Gravar</Botao>
            </form>
            {s?.items?.length ? (
              <table className="kv" style={{ marginTop: 12 }}>
                <tbody>
                  {s.items.slice(0, 5).map((x) => (
                    <tr key={x.id}>
                      <td className="mono">#{x.id}</td>
                      <td className="num sub">
                        {x.label}
                        <span className="sub"> · {x.created_at}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>
                Nenhuma sentinela gravada.
              </p>
            )}
          </Card>
        </div>
      </Secao>
    </>
  );
}
