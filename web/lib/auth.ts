import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";

/**
 * Autenticacao humana no painel.
 *
 * Sao duas camadas distintas (ADR 0007):
 *  - PANEL_TOKEN ......... acesso do humano a este servico
 *  - API_SERVICE_TOKEN ... acesso deste servico a `api`
 *
 * O segundo NUNCA chega ao navegador: vive so aqui, no servidor.
 */

export const COOKIE_SESSAO = "painel_sessao";

function comparaConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function tokenDoPainel(): string {
  return process.env.PANEL_TOKEN ?? "";
}

/** Confere o token digitado no login. */
export function tokenConfere(candidato: string): boolean {
  const esperado = tokenDoPainel();
  // Falha fechado: sem token no servidor, ninguem entra.
  if (!esperado) return false;
  return comparaConstante(candidato, esperado);
}

/** Ha sessao valida no cookie? */
export async function temSessao(): Promise<boolean> {
  const store = await cookies();
  const valor = store.get(COOKIE_SESSAO)?.value;
  if (!valor) return false;
  return tokenConfere(valor);
}
