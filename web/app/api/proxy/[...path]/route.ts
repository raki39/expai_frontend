import { NextResponse } from "next/server";
import { chamarApi } from "@/lib/api";
import { temSessao } from "@/lib/auth";

/**
 * A ingestao do dataset baixa ~46 arquivos da Binance numa unica requisicao:
 * medido em 34s a partir do Brasil, e a Railway fica bem mais perto da borda
 * CloudFront que atende. Os 10s padrao da Vercel nao bastam.
 *
 * Se ainda assim estourar, nao ha estrago: a ingestao e atomica (rollback) e
 * idempotente (ADR 0012, criterio 2), entao repetir e seguro.
 */
export const maxDuration = 60;

/**
 * Proxy puro para a `api`.
 *
 * O navegador nunca fala com a `api` diretamente. Ela TEM dominio publico
 * (ADR 0010 - o painel vive na Vercel e a alcanca pela internet), mas exige
 * token de servico em toda rota, e esse token nao pode chegar ao navegador.
 * Esta rota roda no servidor, acrescenta o token e encaminha.
 *
 * Efeito colateral util: como a chamada e servidor-para-servidor, ela nao
 * passa por CORS.
 *
 * Sem logica de negocio aqui (secao 10.2.1).
 */

async function repassar(
  request: Request,
  contexto: { params: Promise<{ path: string[] }> },
  metodo: "GET" | "POST",
): Promise<NextResponse> {
  if (!(await temSessao())) {
    return NextResponse.json({ detail: "nao autenticado" }, { status: 401 });
  }

  const { path } = await contexto.params;
  const busca = new URL(request.url).search;
  const caminho = `/api/${path.join("/")}${busca}`;

  const corpoEnviado = metodo === "POST" ? await request.text() : undefined;
  const { status, corpo } = await chamarApi(caminho, {
    method: metodo,
    body: corpoEnviado,
  });

  // Nem toda rota devolve JSON: `/api/relatorio/markdown` devolve texto, e
  // `chamarApi` deixa como string quando o parse falha. Empacotar isso em
  // `NextResponse.json` entregaria o relatorio inteiro entre aspas, com as
  // quebras de linha escapadas - ilegivel exatamente para quem o abriu para
  // ler. Isto e transporte, nao regra de negocio (secao 10.2.1).
  if (typeof corpo === "string") {
    return new NextResponse(corpo, {
      status,
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }

  return NextResponse.json(corpo, { status });
}

export async function GET(
  request: Request,
  contexto: { params: Promise<{ path: string[] }> },
) {
  return repassar(request, contexto, "GET");
}

export async function POST(
  request: Request,
  contexto: { params: Promise<{ path: string[] }> },
) {
  return repassar(request, contexto, "POST");
}
