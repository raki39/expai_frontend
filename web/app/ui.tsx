/**
 * Pecas de apresentacao do painel. Nenhuma regra de negocio aqui - so forma
 * (secao 10.2.1). Se algum dia uma destas funcoes precisar decidir alguma
 * coisa sobre o experimento, ela esta no arquivo errado.
 */

import type { ReactNode } from "react";

/** Marcador de estado. Le-se mais rapido que "sim"/"nao" escrito por extenso. */
export function Pill({
  ok,
  sim = "sim",
  nao = "nao",
  indefinido = "n/a",
}: {
  ok: boolean | null | undefined;
  sim?: string;
  nao?: string;
  indefinido?: string;
}) {
  if (ok === null || ok === undefined) {
    return <span className="pill neutro">{indefinido}</span>;
  }
  return <span className={`pill ${ok ? "ok" : "bad"}`}>{ok ? sim : nao}</span>;
}

/**
 * Valor monetario a partir de INTEIROS de unidade menor.
 *
 * A divisao por 100 acontece so aqui, no ultimo instante antes de virar
 * pixel. Em nenhum outro ponto do sistema um valor monetario existe como
 * numero fracionario (regra 5).
 */
export function Dinheiro({
  minor,
  moeda,
}: {
  minor: number | null | undefined;
  moeda: "USD" | "BRL";
}) {
  if (minor === null || minor === undefined) return <span className="sub">—</span>;
  const texto = (minor / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: moeda,
    minimumFractionDigits: 2,
  });
  const sinal = minor < 0 ? "bad" : minor > 0 ? "" : "sub";
  return <span className={`num ${sinal}`}>{texto}</span>;
}

export function Hash({ valor }: { valor?: string | null }) {
  if (!valor) return <span className="sub">—</span>;
  return (
    <code className="hash" title={valor}>
      {valor.slice(0, 16)}…
    </code>
  );
}

export function Utc({ ms }: { ms?: number | null }) {
  if (ms === null || ms === undefined) return <span className="sub">—</span>;
  return <span>{new Date(ms).toISOString().replace(".000Z", "Z")}</span>;
}

export function Card({
  titulo,
  children,
  larga = false,
}: {
  titulo?: string;
  children: ReactNode;
  /** Ocupa a linha inteira da grade. Para tabela larga ou texto corrido. */
  larga?: boolean;
}) {
  return (
    <div className={larga ? "card larga" : "card"}>
      {titulo ? <h3>{titulo}</h3> : null}
      {children}
    </div>
  );
}

/**
 * A nota que explica o card, ancorada no rodape dele.
 *
 * Fica no fim da coluna de proposito: e o que faz cards vizinhos terminarem
 * na mesma linha em vez de escalonados conforme o tamanho do texto de cada
 * um. Era a causa visivel de "cards desalinhados".
 */
export function Nota({ children }: { children: ReactNode }) {
  return <p className="nota-rodape">{children}</p>;
}

/**
 * Faixa de numeros-chave: o que a secao responde, antes de qualquer tabela.
 *
 * Existe porque a queixa era de varredura - para saber como o run foi era
 * preciso ler tres tabelas e cruzar de cabeca.
 */
export function Tiles({ children }: { children: ReactNode }) {
  return <dl className="tiles">{children}</dl>;
}

/**
 * Um numero com o que ele significa.
 *
 * `rotulo` e FRASE, nao nome de campo: `patrimonio_final_cents` e o nome da
 * coluna no banco; "patrimonio final" e o que a pessoa procura na tela. O
 * nome tecnico continua alcancavel no JSON cru de cada secao.
 *
 * `contexto` e a linha que evita a leitura errada - "sobre US$ 1.000 de
 * capital semente" muda o que o numero acima quer dizer.
 */
export function Tile({
  rotulo,
  children,
  contexto,
  destaque = false,
  heroi = false,
}: {
  rotulo: string;
  children: ReactNode;
  contexto?: ReactNode;
  destaque?: boolean;
  /** O unico numero que a pagina inteira existe para mostrar. Um por tela. */
  heroi?: boolean;
}) {
  const classes = ["tile", destaque ? "destaque" : "", heroi ? "heroi" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes}>
      <dt>{rotulo}</dt>
      <dd>
        {children}
        {contexto ? <span className="contexto">{contexto}</span> : null}
      </dd>
    </div>
  );
}

/**
 * Resultado de uma acao. Mostra a mensagem que importa e guarda o JSON cru
 * atras de um `details` - ele continua acessivel, mas parou de dominar a
 * tela toda vez que algo acontece.
 */
export function Resultado({ status, detalhe }: { status?: string; detalhe?: string }) {
  if (!status) return null;
  // Qualquer 2xx e sucesso. Fixar em "201" fazia a rota de encerrar run,
  // que devolve 200, aparecer como recusada.
  const bom = status.startsWith("2");

  let resumo = bom ? "Concluido." : `Recusado (HTTP ${status}).`;
  let material = false;
  try {
    const corpo = JSON.parse(detalhe ?? "{}");
    const d = corpo?.detail ?? corpo;
    if (typeof d === "string") resumo = d;
    else if (d?.mensagem) resumo = d.mensagem;
    else if (corpo?.aviso) {
      resumo = corpo.aviso;
      material = true;
    }
  } catch {
    // Erro de infraestrutura raramente devolve JSON. Fica o resumo padrao.
  }

  return (
    <div className={`aviso ${bom ? (material ? "warn" : "ok") : "bad"}`}>
      <p>
        <strong>HTTP {status}</strong> — {resumo}
      </p>
      {detalhe ? (
        <details>
          <summary>resposta completa</summary>
          <pre>{formatar(detalhe)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function formatar(texto: string): string {
  try {
    return JSON.stringify(JSON.parse(texto), null, 2);
  } catch {
    return texto;
  }
}
