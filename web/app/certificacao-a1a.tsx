"use client";

import { useEffect, useRef, useState } from "react";
import {
  acompanhar,
  conduzir,
  type Desfecho,
  type EstadoA1a,
  type EtapaA1a,
  type Relato,
  type Resposta,
} from "./fluxo-certificacao";

export type { EstadoA1a as EstadoCertificacaoA1a } from "./fluxo-certificacao";

/**
 * A certificação do A1a em ETAPAS — OP-1.
 *
 * O painel chama a próxima etapa sozinho e mostra o progresso, e NÃO decide
 * nada (secao 10.2.1). A ordem das chamadas mora em `fluxo-certificacao.ts`,
 * que é testado contra um backend simulado (`npm run conferir-fluxo`); aqui só
 * ficam as três portas e a tela.
 *
 * **A regra que torna uma etapa de 2 minutos inofensiva:** toda volta LÊ o
 * estado antes de postar. O proxy da Vercel corta em 60 s; o backend conclui a
 * etapa mesmo assim, e a volta seguinte vê isso no estado — em vez de depender
 * da resposta que se perdeu.
 */

const ROTA = "/api/proxy/certificacao/a1a";
// Um pouco acima dos 60 s do proxy: se nem o 504 dele chegar, a chamada vira
// "sem resposta" em vez de ficar pendurada para sempre.
const TETO_DO_POST_MS = 70_000;
const TETO_DA_LEITURA_MS = 30_000;

async function postar(corpo: Record<string, unknown>): Promise<Resposta> {
  try {
    const r = await fetch(ROTA, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TETO_DO_POST_MS),
    });
    return { status: r.status, corpo: await r.json().catch(() => ({})) };
  } catch {
    return { status: null, corpo: {} };
  }
}

async function ler(): Promise<EstadoA1a | null> {
  try {
    const r = await fetch(ROTA, {
      cache: "no-store",
      signal: AbortSignal.timeout(TETO_DA_LEITURA_MS),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

function esperar(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

type Aviso = { tipo: "espera" | "falha" | "indisponivel"; texto: string };

const CLASSE: Record<EtapaA1a["estado"], string> = {
  concluida: "ok",
  em_andamento: "warn",
  interrompida: "warn",
  falhou: "bad",
  pendente: "",
};

export function CertificacaoA1a({ inicial }: { inicial: EstadoA1a | null }) {
  const [estado, setEstado] = useState<EstadoA1a | null>(inicial);
  const [modo, setModo] = useState<"parado" | "conduzindo" | "acompanhando">(
    inicial?.em_andamento ? "acompanhando" : "parado",
  );
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const vivo = useRef(true);

  function relatar(r: Relato) {
    if (!vivo.current) return;
    if (r.estado) setEstado(r.estado);
    setAviso(r.aviso ? { tipo: "espera", texto: r.aviso } : null);
  }

  function encerrar(d: Desfecho) {
    if (!vivo.current) return;
    if (d.estado) setEstado(d.estado);
    if (d.fim === "falha") {
      setAviso({ tipo: "falha", texto: `FALHA — decisao do backend: ${d.motivo}` });
    } else if (d.fim === "indisponivel") {
      setAviso({
        tipo: "indisponivel",
        texto: `o servidor nao respondeu (${d.motivo}). Nada foi decidido: continuar retoma do ponto certo`,
      });
    } else {
      setAviso(d.fim === "parado" && d.motivo !== "nenhuma etapa em andamento"
        ? { tipo: "espera", texto: d.motivo }
        : null);
    }
    setModo("parado");
  }

  // Ao CARREGAR com uma etapa rodando no backend - depois de recarregar, ou de
  // a aba ter sido fechada no meio -, o painel so ACOMPANHA. Continuar para a
  // etapa seguinte e um clique.
  useEffect(() => {
    vivo.current = true;
    if (inicial?.em_andamento) {
      acompanhar({ ler, esperar, relatar }).then(encerrar);
    }
    return () => {
      vivo.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function certificar(novaExecucao: boolean) {
    setModo("conduzindo");
    setAviso(null);
    encerrar(await conduzir({ postar, ler, esperar, relatar }, { novaExecucao }));
  }

  const etapas = estado?.etapas ?? [];
  const selado = estado?.selado ?? null;
  const abortada = estado?.abortada ?? null;
  const ocupado = modo !== "parado";

  return (
    <div className="card" style={{ marginTop: 14 }} data-fluxo="le-o-estado-antes-de-postar@1">
      <h3>Certificacao da vigente — A1a em {estado?.plano?.length ?? 8} etapas</h3>
      <p className="sub" style={{ margin: "0 0 8px", fontSize: 12.5 }}>
        Uma copia descartavel SELADA, uma etapa por pedido, e o estado no banco.
        O painel le o estado antes de cada pedido: uma etapa que passa dos 60 s
        do proxy conclui no backend, e o painel acompanha em vez de pedir de
        novo. Fechar a aba nao apaga nada — ao voltar, ele retoma de onde o
        servidor diz.
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
            {estado.em_andamento ? " — uma em andamento no backend" : ""}
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

      {aviso ? (
        <div
          className={"aviso " + (aviso.tipo === "falha" ? "bad" : "")}
          style={{ marginTop: 8 }}
        >
          <p style={{ margin: 0, fontSize: 12.5 }}>{aviso.texto}</p>
        </div>
      ) : null}

      <div className="acoes">
        {abortada ? (
          <button type="button" disabled={ocupado} onClick={() => certificar(true)}>
            {ocupado ? "certificando…" : "Comecar NOVA execucao"}
          </button>
        ) : (
          <button
            type="button"
            disabled={ocupado || Boolean(selado)}
            onClick={() => certificar(false)}
          >
            {modo === "acompanhando"
              ? "acompanhando a etapa em andamento…"
              : modo === "conduzindo"
                ? "certificando…"
                : selado
                  ? "selado"
                  : estado?.iniciada && estado.proxima !== null && estado.proxima !== undefined
                    ? `Continuar a partir da etapa ${estado.proxima}`
                    : "Certificar o A1a"}
          </button>
        )}
      </div>
    </div>
  );
}
