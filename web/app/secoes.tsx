/**
 * Estrutura da pagina: cabecalho, barra de estado e navegacao.
 *
 * As secoes sao agrupadas pela PERGUNTA que respondem, e nao pela numeracao
 * do `05-painel.md` secao 6. Os nove blocos continuam todos presentes - o
 * criterio 1 do incremento 6 exige isso e ha teste conferindo - mas
 * empilhados na ordem do documento a tela obrigava a saltar entre assuntos
 * para montar uma ideia so.
 *
 * O mapa entre os dois esta em `BLOCOS`, logo abaixo: sem ele a conferencia
 * item a item viraria uma leitura de tela, que e a forma de garantia que
 * este projeto ja viu falhar quatro vezes.
 *
 * Nenhuma regra de negocio aqui (secao 10.2.1). Isto e forma.
 */

import type { ReactNode } from "react";

/** Onde cada bloco de §10.4 / §6 do 05-painel foi parar. */
export const BLOCOS: { bloco: string; secao: string }[] = [
  { bloco: "1 estado do experimento", secao: "resumo + #experimento" },
  { bloco: "2 curva contra os baselines", secao: "#resultado" },
  { bloco: "3 ordens e execucoes simuladas", secao: "#execucao" },
  { bloco: "4 carteira e ledger", secao: "#dinheiro" },
  { bloco: "5 custos e consumo de tokens", secao: "#decisao" },
  { bloco: "6 regra proposta e ativa", secao: "#decisao" },
  { bloco: "7 logs e estado do experimento", secao: "#dinheiro + #decisao" },
  { bloco: "8 caminho percorrido", secao: "#decisao" },
  { bloco: "9 configuracao", secao: "#ajustes" },
];

export const SECOES: { id: string; n: string; titulo: string; pergunta: string }[] = [
  { id: "experimento", n: "01", titulo: "Executar", pergunta: "o que da para fazer agora?" },
  { id: "resultado", n: "02", titulo: "Resultado", pergunta: "o agente ganhou do acaso?" },
  { id: "decisao", n: "03", titulo: "Decisao", pergunta: "como ele chegou nessa regra, e quanto custou?" },
  { id: "execucao", n: "04", titulo: "Execucao", pergunta: "o que foi feito no mercado?" },
  { id: "dinheiro", n: "05", titulo: "Dinheiro", pergunta: "as contas fecham?" },
  { id: "ajustes", n: "06", titulo: "Configuracao", pergunta: "sob que parametros isso rodou?" },
  { id: "substrato", n: "07", titulo: "Substrato", pergunta: "o volume persiste mesmo?" },
];

export function Nav() {
  return (
    <nav className="nav" aria-label="secoes do painel">
      {SECOES.map((s) => (
        <a key={s.id} href={`#${s.id}`} title={s.pergunta}>
          <b>{s.n}</b>
          {s.titulo}
        </a>
      ))}
    </nav>
  );
}

export function Secao({
  id,
  children,
  nota,
}: {
  id: string;
  children: ReactNode;
  nota?: string;
}) {
  const meta = SECOES.find((s) => s.id === id);
  return (
    <section id={id}>
      <h2 data-n={meta?.n}>
        {meta?.titulo}
        <span className="nota">{nota ?? meta?.pergunta}</span>
      </h2>
      {children}
    </section>
  );
}

/** Uma celula da barra de estado. */
export function Estado({
  rotulo,
  children,
}: {
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}
