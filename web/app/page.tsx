import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { chamarApi } from "@/lib/api";
import { temSessao } from "@/lib/auth";
import { Botao } from "./botao";
import { Card, Dinheiro, Hash, Pill, Resultado, Utc } from "./ui";

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

type ConfigResposta = {
  version_id: number;
  config_hash: string;
  congelada: boolean;
  config: {
    market_venue: string;
    market_symbol: string;
    timeframe: string;
    data_start: string;
    data_end: string;
    reserved_fraction: string;
    seed_capital_usd_cents: number;
    fx_brl_per_usd: string;
    fx_rate_date: string;
  };
};

type Ledger = {
  run_ativo: number | null;
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

type Sentinelas = {
  total: number;
  items: { id: number; label: string; created_at: string }[];
};

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
  const { status, corpo } = await chamarApi("/api/dataset/ingest", {
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

async function abrirRun() {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const { status, corpo } = await chamarApi("/api/run", {
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
    `/api/run/${formData.get("run_id")}/encerrar`,
    { method: "POST", body: JSON.stringify({ estado: "concluido" }) },
  );
  revalidatePath("/");
  paraPainel(status, corpo, "run");
}

async function gravarSentinela(formData: FormData) {
  "use server";
  if (!(await temSessao())) redirect("/login");
  const label = String(formData.get("label") ?? "").trim();
  if (label) {
    await chamarApi("/api/sentinel", {
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
    detalhe?: string;
  }>;
}) {
  if (!(await temSessao())) redirect("/login");

  const p = await searchParams;
  const [health, dataset, config, ledger, transacoes, sentinelas] =
    await Promise.all([
      chamarApi("/api/health"),
      chamarApi("/api/dataset"),
      chamarApi("/api/config"),
      chamarApi("/api/ledger"),
      chamarApi("/api/ledger/transacoes?limite=12"),
      chamarApi("/api/sentinel"),
    ]);

  if (health.status !== 200) {
    return (
      <>
        <div className="topo">
          <h1>Fase 0A — painel</h1>
        </div>
        <h2>Falha ao alcancar a api</h2>
        <Card>
          <p className="bad">HTTP {health.status}</p>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {JSON.stringify(health.corpo, null, 2)}
          </pre>
          <p className="sub" style={{ marginTop: 12 }}>
            Confira, nesta ordem: <code>API_BASE_URL</code> com{" "}
            <code>https://</code> e sem barra no final;{" "}
            <code>API_SERVICE_TOKEN</code> identico na Vercel e na Railway; e o
            log de pre-voo da api mostrando <code>host</code> e{" "}
            <code>port</code> batendo com o target port do dominio.
          </p>
        </Card>
      </>
    );
  }

  const h = health.corpo as Health;
  const d = dataset.corpo as Dataset;
  const c = config.status === 200 ? (config.corpo as ConfigResposta) : null;
  const l = ledger.status === 200 ? (ledger.corpo as Ledger) : null;
  const tx = (transacoes.corpo as Transacoes)?.items ?? [];
  const s = sentinelas.corpo as Sentinelas;
  const cfg = c?.config ?? null;

  const tudoConfere =
    l !== null &&
    l.conferencias.partidas_dobradas_ok &&
    l.conferencias.saldo_reconciliado_ok &&
    l.conferencias.vinculos_ok &&
    l.conferencias.sem_ponto_flutuante;

  return (
    <>
      <div className="topo">
        <h1>Fase 0A — painel</h1>
        <div className="contexto">
          <span>
            ambiente <strong>{h.app_env}</strong>
          </span>
          <span>
            schema <strong>v{h.schema_version}</strong>
          </span>
          <span>
            build <code>{h.build.slice(0, 8)}</code>
          </span>
        </div>
      </div>

      {/* ============================================================ run */}
      <h2>Run</h2>
      <Card>
        <div className="linha">
          {l?.run_ativo ? (
            <>
              <span className="pill ok">run {l.run_ativo} ativo</span>
              <span className="sub">
                configuracao congelada enquanto durar (ADR 0008)
              </span>
              <form action={encerrarRun} style={{ marginLeft: "auto" }}>
                <input type="hidden" name="run_id" value={l.run_ativo} />
                <Botao pendente="encerrando…">Encerrar run</Botao>
              </form>
            </>
          ) : (
            <>
              <span className="pill neutro">nenhum run ativo</span>
              <span className="sub">
                abrir credita o capital semente como lancamento
              </span>
              <form action={abrirRun} style={{ marginLeft: "auto" }}>
                <Botao pendente="abrindo…">Abrir run</Botao>
              </form>
            </>
          )}
        </div>
        <Resultado status={p.run} detalhe={p.detalhe} />
      </Card>

      {/* ========================================================= ledger */}
      <h2>Ledger e carteira</h2>
      <div className="duas">
        <Card titulo="Livro simulado (USD)">
          <table>
            <tbody>
              <tr>
                <td>caixa da carteira</td>
                <td className="num">
                  <Dinheiro minor={l?.carteira.simulado_usd.caixa_minor} moeda="USD" />
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
          <table>
            <tbody>
              <tr>
                <td>caixa da tesouraria</td>
                <td className="num">
                  <Dinheiro minor={l?.carteira.real_brl.caixa_minor} moeda="BRL" />
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
                <td className="num">
                  {cfg ? `${cfg.fx_brl_per_usd} · ${cfg.fx_rate_date}` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="sub" style={{ margin: "10px 0 0", fontSize: 12 }}>
            Os dois livros nunca se somam. A taxa fica gravada em cada evento,
            para que variacao cambial nao vire desempenho (secao 4.2).
          </p>
        </Card>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Conferencias do livro</h3>
        <div className="linha">
          <Pill
            ok={l?.conferencias.partidas_dobradas_ok}
            sim="partidas dobradas"
            nao="DESEQUILIBRADO"
          />
          <Pill
            ok={l?.conferencias.saldo_reconciliado_ok}
            sim="saldo reconciliado"
            nao="SALDO DIVERGENTE"
          />
          <Pill
            ok={l?.conferencias.vinculos_ok}
            sim="evento ↔ lancamento"
            nao="VINCULO QUEBRADO"
          />
          <Pill
            ok={l?.conferencias.sem_ponto_flutuante}
            sim="sem ponto flutuante"
            nao="COLUNA REAL NO SCHEMA"
          />
          <span className="sub" style={{ marginLeft: "auto" }}>
            {l?.transacoes ?? 0} transacoes · {l?.eventos ?? 0} eventos
          </span>
        </div>
        {!tudoConfere ? (
          <div className="aviso bad">
            <p>
              <strong>Uma conferencia falhou.</strong> Saldo sem a prova de que o
              livro fecha e so um numero — nao use este estado para nada.
            </p>
          </div>
        ) : null}

        {tx.length ? (
          <table style={{ marginTop: 14 }}>
            <tbody>
              <tr>
                <td className="sub">id</td>
                <td className="sub">tipo</td>
                <td className="sub">quando</td>
                <td className="sub">lanc.</td>
                <td className="sub">nota</td>
              </tr>
              {tx.map((t) => (
                <tr key={t.id}>
                  <td style={{ width: "auto" }}>{t.id}</td>
                  <td>
                    <span
                      className={`pill ${
                        t.kind === "estorno" ? "warn" : "neutro"
                      }`}
                    >
                      {t.kind}
                    </span>
                  </td>
                  <td className="sub">{t.occurred_at}</td>
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
        ) : (
          <p className="sub" style={{ marginBottom: 0, marginTop: 12 }}>
            Nenhuma transacao ainda.
          </p>
        )}
      </div>

      {/* ======================================================== dataset */}
      <h2>Dataset</h2>
      <Card>
        {d.existe ? (
          <table>
            <tbody>
              <tr>
                <td>instrumento</td>
                <td>
                  <code>
                    {d.venue}:{d.symbol} {d.timeframe}
                  </code>{" "}
                  <span className="sub">fidelidade {d.fidelity_level}</span>
                </td>
              </tr>
              <tr>
                <td>sha256</td>
                <td>
                  <Hash valor={d.sha256} />
                </td>
              </tr>
              <tr>
                <td>janela</td>
                <td>
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
                  {d.barras_reservadas?.toLocaleString("pt-BR")}{" "}
                  <span className="sub">
                    desde <Utc ms={d.reserved_from_ms} />
                  </span>
                </td>
              </tr>
              <tr className="total">
                <td>total</td>
                <td className="num">{d.barras_total?.toLocaleString("pt-BR")}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="sub" style={{ marginTop: 0 }}>
            Dataset ainda nao ingerido.
          </p>
        )}

        <p className="sub" style={{ margin: "14px 0 0", fontSize: 12 }}>
          Unica e idempotente: repetir com os mesmos dados nao duplica nem
          sobrescreve. Leva ~35 s. Lacuna na serie faz a api <strong>recusar</strong>{" "}
          — marque a caixa para aceitar o relatorio explicitamente.
        </p>
        <form action={ingerirDataset} className="linha" style={{ marginTop: 10 }}>
          <Botao pendente="ingerindo… (~35 s)">
            {d.existe ? "Reexecutar ingestao" : "Ingerir dataset"}
          </Botao>
          <label className="caixa">
            <input type="checkbox" name="aceitar_lacunas" />
            aceitar lacunas
          </label>
        </form>
        <Resultado status={p.ingestao} detalhe={p.detalhe} />
      </Card>

      {/* =================================================== configuracao */}
      <h2>Configuracao</h2>
      <div className="duas">
        <Card titulo={`Versao ${h.config_version ?? "—"}`}>
          <table>
            <tbody>
              <tr>
                <td>config_hash</td>
                <td>
                  <Hash valor={h.config_hash} />
                </td>
              </tr>
              <tr>
                <td>janela de dados</td>
                <td>
                  {cfg ? (
                    <code>
                      {cfg.data_start} → {cfg.data_end}
                    </code>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
              <tr>
                <td>instrumento</td>
                <td>
                  {cfg ? (
                    <code>
                      {cfg.market_venue}:{cfg.market_symbol} {cfg.timeframe}
                    </code>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
              <tr>
                <td>fracao reservada</td>
                <td className="num">{cfg?.reserved_fraction ?? "—"}</td>
              </tr>
              <tr>
                <td>capital semente</td>
                <td className="num">
                  <Dinheiro minor={cfg?.seed_capital_usd_cents} moeda="USD" />
                </td>
              </tr>
              <tr>
                <td>congelada</td>
                <td>
                  {/* Ambar, nao vermelho: congelar durante run e a regra
                      funcionando (ADR 0008), nao uma falha. */}
                  <span className={`pill ${c?.congelada ? "warn" : "ok"}`}>
                    {c?.congelada ? "congelada · run ativo" : "editavel"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card titulo="Credenciais e volume">
          <table>
            <tbody>
              <tr>
                <td>credencial anthropic</td>
                <td>
                  <Pill ok={h.credenciais_configuradas.anthropic} />
                </td>
              </tr>
              <tr>
                <td>credencial openai</td>
                <td>
                  <Pill ok={h.credenciais_configuradas.openai} />
                </td>
              </tr>
              <tr>
                <td>banco</td>
                <td>
                  <code style={{ fontSize: 12 }}>{h.db_path}</code>
                </td>
              </tr>
              <tr>
                <td>volume gravavel</td>
                <td>
                  <Pill ok={h.volume_gravavel} />
                </td>
              </tr>
              <tr>
                <td>volume montado</td>
                <td>
                  <Pill ok={h.volume_montado} indefinido="nao aplicavel" />
                </td>
              </tr>
            </tbody>
          </table>
          <p className="sub" style={{ margin: "10px 0 0", fontSize: 12 }}>
            Presenca da credencial, nunca o valor (secao 10.2.4). Gravavel e
            montado sao perguntas diferentes: a primeira nao prova persistencia.
          </p>
        </Card>
      </div>

      <Card>
        <p className="sub" style={{ margin: "0 0 4px", fontSize: 12 }}>
          Alterar cria uma <strong>nova versao</strong> com autor, data, valor
          anterior e novo (secao 10.2.3). Nada e sobrescrito. Alteracao material
          invalida comparacao com runs anteriores.
        </p>
        <form action={alterarConfig} className="forma">
          <div className="linha">
            <input name="author" placeholder="autor" required style={{ flex: 1 }} />
            <input
              name="note"
              placeholder="motivo da mudanca"
              style={{ flex: 2 }}
            />
          </div>
          <textarea
            name="changes"
            rows={2}
            required
            spellCheck={false}
            defaultValue={'{"b3_fast": 20, "b3_slow": 50}'}
            style={{ fontFamily: "inherit", fontSize: 12 }}
          />
          <div className="linha">
            <Botao pendente="criando…">Criar nova versao</Botao>
            {c?.congelada ? (
              <span className="sub">
                ha run ativo: a api vai recusar (409). Encerre o run antes.
              </span>
            ) : null}
          </div>
        </form>
        <Resultado status={p.config} detalhe={p.detalhe} />
      </Card>

      {/* ====================================================== sentinela */}
      <h2>Sentinela de persistencia</h2>
      <Card>
        <p className="sub" style={{ marginTop: 0, fontSize: 12 }}>
          Grave um marcador, dispare um redeploy do servico <code>api</code> e
          volte aqui. Se o marcador sumir, o banco esta no filesystem efemero.
        </p>
        <form action={gravarSentinela} className="linha">
          <input
            name="label"
            placeholder="antes-do-redeploy"
            required
            style={{ flex: 1 }}
          />
          <Botao pendente="gravando…">Gravar</Botao>
        </form>
        {s.total > 0 ? (
          <table style={{ marginTop: 14 }}>
            <tbody>
              {s.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.created_at}</td>
                  <td>{i.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="sub" style={{ marginBottom: 0 }}>
            Nenhuma sentinela ainda.
          </p>
        )}
      </Card>
    </>
  );
}
