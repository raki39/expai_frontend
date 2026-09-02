import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { chamarApi } from "@/lib/api";
import { temSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

type Sentinelas = {
  total: number;
  items: { id: number; label: string; created_at: string }[];
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

function utc(ms?: number) {
  return ms === undefined ? "—" : new Date(ms).toISOString().replace(".000Z", "Z");
}

/** Grava uma sentinela: e o que prova que o volume sobrevive ao redeploy. */
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

/**
 * Dispara a ingestao unica. O resultado - inclusive o relatorio de lacunas
 * quando a api recusa - fica no `searchParams` para a proxima renderizacao.
 */
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
  redirect(
    `/?ingestao=${status}&detalhe=${encodeURIComponent(
      JSON.stringify(corpo).slice(0, 1500),
    )}`,
  );
}

function Sim({ v }: { v: boolean }) {
  return <span className={v ? "ok" : "bad"}>{v ? "sim" : "nao"}</span>;
}

export default async function Painel({
  searchParams,
}: {
  searchParams: Promise<{ ingestao?: string; detalhe?: string }>;
}) {
  if (!(await temSessao())) redirect("/login");

  const { ingestao, detalhe } = await searchParams;
  const health = await chamarApi("/api/health");
  const sentinelas = await chamarApi("/api/sentinel");
  const dataset = await chamarApi("/api/dataset");

  if (health.status !== 200) {
    return (
      <>
        <h1>Fase 0A — painel</h1>
        <p className="sub">Incremento 0 — substrato</p>
        <h2>Falha ao alcancar a api</h2>
        <div className="card">
          <p className="bad">HTTP {health.status}</p>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {JSON.stringify(health.corpo, null, 2)}
          </pre>
          <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>
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
  const s = sentinelas.corpo as Sentinelas;
  const d = dataset.corpo as Dataset;

  return (
    <>
      <h1>Fase 0A — painel</h1>
      <p className="sub">Incrementos 0 e 1 — substrato e dataset</p>

      <h2>Substrato</h2>
      <div className="card">
        <table>
          <tbody>
            <tr><td>ambiente</td><td>{h.app_env}</td></tr>
            <tr><td>build</td><td><code>{h.build}</code></td></tr>
            <tr><td>banco</td><td><code>{h.db_path}</code></td></tr>
            <tr><td>caminho absoluto</td><td><Sim v={h.db_path_absoluto} /></td></tr>
            <tr><td>volume gravavel</td><td><Sim v={h.volume_gravavel} /></td></tr>
            <tr>
              <td>volume montado</td>
              <td>
                {h.volume_montado === null ? (
                  <span className="sub">nao aplicavel</span>
                ) : (
                  <Sim v={h.volume_montado} />
                )}
                {h.volume_montado === false ? (
                  <div className="bad" style={{ marginTop: 4 }}>
                    Gravavel mas NAO persistente: e diretorio da imagem. O
                    banco some no proximo deploy.
                  </div>
                ) : null}
              </td>
            </tr>
            <tr><td>versao do schema</td><td>{h.schema_version}</td></tr>
            <tr><td>run ativo</td><td>{h.run_ativo ?? "nenhum"}</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Configuracao</h2>
      <div className="card">
        <table>
          <tbody>
            <tr><td>versao</td><td>{h.config_version ?? "—"}</td></tr>
            <tr>
              <td>config_hash</td>
              <td><code>{h.config_hash?.slice(0, 16) ?? "—"}…</code></td>
            </tr>
            <tr>
              <td>credencial anthropic</td>
              <td><Sim v={h.credenciais_configuradas.anthropic} /></td>
            </tr>
            <tr>
              <td>credencial openai</td>
              <td><Sim v={h.credenciais_configuradas.openai} /></td>
            </tr>
          </tbody>
        </table>
        <p className="sub" style={{ margin: "10px 0 0" }}>
          Presenca da credencial, nunca o valor (secao 10.2.4).
        </p>
      </div>

      <h2>Dataset</h2>
      <div className="card">
        {d.existe ? (
          <table>
            <tbody>
              <tr>
                <td>instrumento</td>
                <td>
                  <code>
                    {d.venue}:{d.symbol} {d.timeframe}
                  </code>
                </td>
              </tr>
              <tr><td>sha256</td><td><code>{d.sha256?.slice(0, 16)}…</code></td></tr>
              <tr><td>fidelidade</td><td>{d.fidelity_level}</td></tr>
              <tr><td>primeira barra</td><td>{utc(d.start_ms)}</td></tr>
              <tr><td>ultima barra</td><td>{utc(d.end_ms)}</td></tr>
              <tr><td>barras (total)</td><td>{d.barras_total?.toLocaleString("pt-BR")}</td></tr>
              <tr>
                <td>disponiveis</td>
                <td>{d.barras_disponiveis?.toLocaleString("pt-BR")}</td>
              </tr>
              <tr>
                <td>reservadas</td>
                <td>
                  {d.barras_reservadas?.toLocaleString("pt-BR")}{" "}
                  <span className="sub">a partir de {utc(d.reserved_from_ms)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="sub" style={{ marginTop: 0 }}>
            Dataset ainda nao ingerido.
          </p>
        )}

        <p className="sub" style={{ margin: "12px 0 8px" }}>
          A ingestao e unica e idempotente: repetir com os mesmos dados nao
          duplica nem sobrescreve nada. Leva algumas dezenas de segundos.
          Lacuna na serie faz a api <strong>recusar</strong> — marque a caixa
          para aceitar o relatorio explicitamente.
        </p>
        <form action={ingerirDataset} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button type="submit">
            {d.existe ? "Reexecutar ingestao" : "Ingerir dataset"}
          </button>
          <label className="sub" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" name="aceitar_lacunas" />
            aceitar lacunas
          </label>
        </form>

        {ingestao ? (
          <div style={{ marginTop: 12 }}>
            <p className={ingestao === "201" ? "ok" : "bad"} style={{ margin: 0 }}>
              HTTP {ingestao}
            </p>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                overflowX: "auto",
                fontSize: 12,
                margin: "6px 0 0",
              }}
            >
              {detalhe}
            </pre>
          </div>
        ) : null}
      </div>

      <h2>Sentinela de persistencia</h2>
      <div className="card">
        <p className="sub" style={{ marginTop: 0 }}>
          Grave um marcador, dispare um redeploy do servico <code>api</code> e
          volte aqui. Se o marcador sumir, o banco esta no filesystem efemero.
        </p>
        <form action={gravarSentinela} style={{ display: "flex", gap: 8 }}>
          <input
            name="label"
            placeholder="antes-do-redeploy"
            required
            style={{ flex: 1 }}
          />
          <button type="submit">Gravar</button>
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
          <p className="sub" style={{ marginBottom: 0 }}>Nenhuma sentinela ainda.</p>
        )}
      </div>
    </>
  );
}
