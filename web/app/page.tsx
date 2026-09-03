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
  sobreposicao_amostral?: { sobreposicao_bps: number | null };
  condicoes_validade?: string;
  cache_de_respostas?: number;
  arredondamento_do_custo_ok?: boolean;
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
    detalhe?: string;
  }>;
}) {
  if (!(await temSessao())) redirect("/login");

  const p = await searchParams;
  const [
    health, dataset, config, ledger, transacoes, sentinelas,
    simulador, execucoes, comparacao, agente, curva, relatorio,
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
                <strong>Isto e leitura, nao conclusao</strong> — e o resultado e
                em amostra, porque o cerebro observou a mesma janela em que
                operou.
              </p>
            </div>
          ) : null}
        </div>
      </Secao>

      {/* =================================================== 03 · DECISAO */}
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
            contexto="100% significa resultado inteiramente em amostra (D22)"
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
                . Na Fase 0A o cerebro observa a mesma janela em que a regra
                roda, entao o resultado e <strong>em amostra</strong>:
                suficiente para responder "o ciclo fecha?", insuficiente para
                qualquer afirmacao de desempenho. Arredondamento do custo
                conferido: <Pill ok={ag.arredondamento_do_custo_ok} />
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
