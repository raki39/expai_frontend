import { NextResponse } from "next/server";
import { COOKIE_SESSAO, tokenConfere } from "@/lib/auth";

/**
 * Troca o PANEL_TOKEN por um cookie httpOnly.
 *
 * O cookie e httpOnly: JavaScript de pagina nao o le. E o token de servico
 * da `api` nao aparece em lugar nenhum do lado do navegador.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");

  if (!tokenConfere(token)) {
    return NextResponse.redirect(new URL("/login?erro=1", request.url), 303);
  }

  const resposta = NextResponse.redirect(new URL("/", request.url), 303);
  resposta.cookies.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return resposta;
}
