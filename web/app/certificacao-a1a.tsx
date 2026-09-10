"use client";

import { useState } from "react";

/**
 * A certificacao do A1a em ETAPAS — OP-1.
 *
 * O painel chama a proxima etapa sozinho e mostra o progresso. Ele NAO decide
 * nada (secao 10.2.1): qual e a proxima, se pode selar e por que abortou vem
 * do backend (`proxima`, `pode_selar`, `abortada`). O que este componente faz
 * e repetir o pedido e esperar.
 *
 * Tres respostas, e nenhuma e erro de rede disfarcado:
 * - 200: a etapa rodou (ou nao faltava nada) — segue;
 * - 409 "em andamento": outra etapa esta rodando — espera e le o estado;
 * - timeout do proxy: a etapa `lucro_so_sem_custos` leva ~2 min em producao e
 *   o proxy da Vercel corta em 60 s. O backend CONTINUA; o painel le o estado
 *   ate ela terminar. O pedido repetido nunca roda a etapa duas vezes.
 *
 * Recomecar depois de um ABORTO e botao proprio: o backend recusa sem
 * `nova_execucao`, e um laco automatico nao pode transformar aborto em
 * recomeco sem ninguem ver.
 */

export type EtapaA1a = {
  indice: number;
  etapa: string;
  estado: "pendente" | "em_andamento" | "interrompida" | "concluida" | "falhou";
  tentativas: number;
  micros: number | null;
};

export type EstadoCertificacaoA1a = {
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

const ROTA = "/api/proxy/certificacao/a1a";
const ESPERA_MS = 5000;
// 8 etapas + selo + esperas da etapa longa. Um teto, e nao uma estimativa: o
// laco para antes se o backend disser que acabou.
const MAX_VOLTAS = 80;

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postar(corpo: object): Promise<{ status: number; json: any } | null> {
  try {
    const r = await fetch(ROTA, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  } catch {
    return null;
  }
}

async function ler(): Promise<EstadoCertificacaoA1a | null> {
  try {
    const r = await fetch(ROTA, { cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

const CLASSE: Record<EtapaA1a["estado"], string> = {
  concluida: "ok",
  em_andamento: "warn",
  interrompida: "warn",
  falhou: "bad",
  pendente: "",
};

export function CertificacaoA1a({ inicial }: { inicial: EstadoCertificacaoA1a | null }) {
  const [estado, setEstado] = useState<EstadoCertificacaoA1a | null>(inicial);
  const [rodando, setRodando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function certificar(novaExecucao: boolean) {
    setRodando(true);
    setAviso(null);
    let nova = novaExecucao;
    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      const r = await postar({ author: "painel", nova_execucao: nova });
      nova = false;
      if (r && r.status === 200) {
        if (r.json.selado || r.json.passa !== undefined) {
          setEstado((await ler()) ?? r.json);
          break;
        }
        setEstado(r.json);
        if (r.json.proxima === null && r.json.pode_selar) {
          const s = await postar({ author: "painel", selar: true });
          if (s && s.status !== 200) setAviso(String(s.json?.detail ?? s.status));
          setEstado((await ler()) ?? s?.json ?? null);
          break;
        }
        continue;
      }
      const detalhe = String(r?.json?.detail ?? "");
      if (r && r.status === 409 && !detalhe.includes("em andamento")) {
        // Abortada ou recusada: o motivo e do backend, e o laco para aqui.
        setAviso(detalhe);
        setEstado(await ler());
        break;
      }
      // Em andamento, ou o proxy cortou a espera: a etapa segue no backend.
      setAviso(
        r === null || r.status >= 500
          ? "o proxy cortou a espera; a etapa continua no backend — lendo o estado"
          : "uma etapa esta em andamento — lendo o estado",
      );
      await esperar(ESPERA_MS);
      const atual = await ler();
      if (atual) setEstado(atual);
    }
    setRodando(false);
  }

  const etapas = estado?.etapas ?? [];
  const selado = estado?.selado ?? null;
  const abortada = estado?.abortada ?? null;

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3>Certificacao da vigente — A1a em {estado?.plano?.length ?? 8} etapas</h3>
      <p className="sub" style={{ margin: "0 0 8px", fontSize: 12.5 }}>
        Uma copia descartavel SELADA, uma etapa por pedido, e o estado no banco.
        O plano saiu da medicao dos 207 s: uma etapa por unidade indivisivel. A
        etapa <code>lucro_so_sem_custos</code> leva ~2 min e passa do limite do
        proxy — ela conclui no backend, e o painel espera.
      </p>
      <p style={{ margin: "0 0 8px" }}>
        {selado ? (
          <span className={"pill " + (selado.passa ? "ok" : "bad")}>
            selado {selado.passa ? "— passa" : "— NAO passa"} em {selado.selado_em}
          </span>
        ) : abortada ? (
          <span className="pill bad">abortada</span>
        ) : estado?.iniciada ? (
          <span className="pill warn">
            {estado.concluidas ?? 0} de {estado.total ?? 8} etapas
            {estado.em_andamento ? " — uma em andamento" : ""}
          </span>
        ) : (
          <span className="pill">nenhuma execucao para este alvo</span>
        )}{" "}
        {estado?.alvo_de_certificacao_hash ? (
          <span className="sub" style={{ fontSize: 12 }}>
            alvo <code>{estado.alvo_de_certificacao_hash.slice(0, 16)}</code>
          </span>
        ) : null}
      </p>

      {abortada ? (
        <div className="aviso bad" style={{ marginTop: 0 }}>
          <p style={{ margin: 0, fontSize: 12.5 }}>
            <strong>Abortada em {abortada.abortada_em}.</strong> {abortada.motivo}
          </p>
        </div>
      ) : null}

      {etapas.length ? (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>etapa</th>
              <th>estado</th>
              <th className="num">tentativas</th>
              <th className="num">segundos</th>
            </tr>
          </thead>
          <tbody>
            {etapas.map((e) => (
              <tr key={e.indice}>
                <td>{e.indice}</td>
                <td>
                  <code>{e.etapa}</code>
                </td>
                <td>
                  <span className={"pill " + CLASSE[e.estado]}>{e.estado}</span>
                </td>
                <td className="num">{e.tentativas}</td>
                <td className="num">
                  {e.micros === null ? "—" : (e.micros / 1_000_000).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {estado?.copia ? (
        <p className="sub" style={{ margin: "8px 0 0", fontSize: 12 }}>
          copia selada em {estado.copia.selada_em},{" "}
          {(estado.copia.bytes_no_selo / 1_000_000).toFixed(1)} MB
          {estado.copia.descartada
            ? " — descartada (" + estado.copia.descartada.motivo +
              (estado.copia.descartada.residuo ? ", com residuo" : "") + ")"
            : " — em uso"}
        </p>
      ) : null}

      <div className="acoes">
        {abortada ? (
          <button type="button" disabled={rodando} onClick={() => certificar(true)}>
            {rodando ? "certificando…" : "Comecar NOVA execucao"}
          </button>
        ) : (
          <button
            type="button"
            disabled={rodando || Boolean(selado)}
            onClick={() => certificar(false)}
          >
            {rodando
              ? "certificando…"
              : estado?.iniciada
                ? "Continuar as etapas"
                : "Certificar o A1a"}
          </button>
        )}
        {aviso ? (
          <span className="sub" style={{ fontSize: 12.5 }}>
            {aviso}
          </span>
        ) : null}
      </div>
    </div>
  );
}
