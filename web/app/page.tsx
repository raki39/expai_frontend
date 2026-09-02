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

function Sim({ v }: { v: boolean }) {
  return <span className={v ? "ok" : "bad"}>{v ? "sim" : "nao"}</span>;
}

export default async function Painel() {
  if (!(await temSessao())) redirect("/login");

  const health = await chamarApi("/api/health");
  const sentinelas = await chamarApi("/api/sentinel");

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
            Em producao, confira: o servico <code>api</code> ligado em{" "}
            <code>::</code> (a rede privada resolve IPv6), o{" "}
            <code>API_BASE_URL</code> apontando para{" "}
            <code>*.railway.internal</code> com <code>http</code>, e o{" "}
            <code>API_SERVICE_TOKEN</code> igual nos dois servicos.
          </p>
        </div>
      </>
    );
  }

  const h = health.corpo as Health;
  const s = sentinelas.corpo as Sentinelas;

  return (
    <>
      <h1>Fase 0A — painel</h1>
      <p className="sub">Incremento 0 — substrato</p>

      <h2>Substrato</h2>
      <div className="card">
        <table>
          <tbody>
            <tr><td>ambiente</td><td>{h.app_env}</td></tr>
            <tr><td>build</td><td><code>{h.build}</code></td></tr>
            <tr><td>banco</td><td><code>{h.db_path}</code></td></tr>
            <tr><td>caminho absoluto</td><td><Sim v={h.db_path_absoluto} /></td></tr>
            <tr><td>volume gravavel</td><td><Sim v={h.volume_gravavel} /></td></tr>
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
