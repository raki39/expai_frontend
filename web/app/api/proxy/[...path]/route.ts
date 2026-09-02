import { NextResponse } from "next/server";
import { chamarApi } from "@/lib/api";
import { temSessao } from "@/lib/auth";

/**
 * Proxy puro para a `api`.
 *
 * O navegador nunca fala com a `api` diretamente: em producao ela nao tem
 * dominio publico e vive em `*.railway.internal`, que codigo de navegador
 * nao resolve. Esta rota acrescenta o token de servico e encaminha.
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
