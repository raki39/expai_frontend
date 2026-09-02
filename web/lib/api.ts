/**
 * Cliente da `api`, usado APENAS no servidor.
 *
 * Em producao aponta para a rede privada da Railway
 * (`http://<servico>.railway.internal:<porta>`), que o navegador nao resolve.
 * E isso que permite a `api` nao ter dominio publico e o token de servico
 * nunca sair daqui.
 *
 * Este modulo nao contem regra de negocio: a `api` e a unica autoridade
 * (secao 10.2.1 - "o Painel nao contem logica de negocio: nenhuma").
 */

export function baseDaApi(): string {
  return process.env.API_BASE_URL ?? "http://localhost:8000";
}

function tokenDeServico(): string {
  return process.env.API_SERVICE_TOKEN ?? "";
}

export type RespostaApi = {
  status: number;
  corpo: unknown;
};

export async function chamarApi(
  caminho: string,
  init: RequestInit = {},
): Promise<RespostaApi> {
  const url = `${baseDaApi()}${caminho}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${tokenDeServico()}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const resposta = await fetch(url, {
    ...init,
    headers,
    // O painel sempre mostra o estado agora, nunca um estado cacheado.
    cache: "no-store",
  });

  const texto = await resposta.text();
  let corpo: unknown = texto;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    // Deixa como texto: erro de infraestrutura raramente devolve JSON.
  }
  return { status: resposta.status, corpo };
}
