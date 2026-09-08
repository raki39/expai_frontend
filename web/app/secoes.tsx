/**
 * Estrutura da pagina: cabecalho, barra de estado e navegacao.
 *
 * As secoes sao agrupadas pela PERGUNTA que respondem, e nao pela numeracao
 * do `05-painel.md` secao 6. Os nove blocos continuam todos presentes - o
 * criterio 1 do incremento 6 exige isso - mas empilhados na ordem do
 * documento a tela obrigava a saltar entre assuntos para montar uma ideia so.
 *
 * O mapa entre os dois esta em `BLOCOS`, logo abaixo, e quem o confere e
 * `npm run conferir-blocos`: os nove presentes, cada um apontando para uma
 * secao que existe, e cada secao de fato renderizada em `page.tsx`.
 *
 * Este comentario ja afirmou que havia teste conferindo quando nao havia, e
 * `BLOCOS` ficou declarado sem nunca ser lido. Foi assim que o script nasceu.
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

/** O que a tela acrescenta, e que nao e bloco de §6 do 05-painel. */
export const ALEM_DOS_BLOCOS: { assunto: string; secao: string }[] = [
  { assunto: "relatorio de fechamento (incremento 7)", secao: "#fechamento" },
  { assunto: "sentinela de persistencia (incremento 0)", secao: "#substrato" },
  // A 0B inteira. O plano dizia "nao ha tela nova ate haver o que mostrar", e
  // agora ha: hipotese pre-registrada, veredito do validador, lote fechado com
  // BY e creditos consumidos. Sem esta secao, conferir a fase exigia exportar
  // JSON e ler a mao - foi o que aconteceu nos tres primeiros runs da 0B.
  { assunto: "conhecimento: pre-registro, parecer, lote e creditos (0B)", secao: "#conhecimento" },
  { assunto: "separacao por finalidade (incremento 9)", secao: "#conhecimento" },
  // O PRODUTO da 0B. Secao propria, e nao uma caixa dentro de #conhecimento:
  // a 03 pergunta se o protocolo aceita UMA hipotese, e esta pergunta se o
  // protocolo FUNCIONA. Sao perguntas de niveis diferentes, e §14.4 diz que a
  // segunda vem antes - "avaliado antes de qualquer resultado do agente ser
  // considerado".
  { assunto: "portao A: controles negativos, calibre e integridade (0B)", secao: "#portao-a" },
  // O produto do incremento 14. Secao propria porque §14.4 separa os dois
  // portoes: o A pergunta se o protocolo funciona, o B se existe candidata -
  // e o segundo so e calculado se o primeiro passar (R49).
  { assunto: "portao B e a auditoria de §14.4.1 (0B)", secao: "#portao-b" },
  // O produto da D38 / ADR 0034, e a razao de ela existir e de RELATO: uma
  // ausencia que ninguem declara vira silencio, e silencio e lido como
  // esquecimento. Quem abrir isto em 2027 tem de ver que nao houve candidata
  // DE PROPOSITO.
  { assunto: "quarentena: nenhuma candidata, e o motivo de cada exclusao (0C)", secao: "#quarentena" },
  // O produto do incremento 20 / ADR 0035. Secao propria pelo mesmo motivo da
  // quarentena, e por um a mais: o campo que ela publica sempre - "ausencia de
  // alarme nao comprova edge" - e o unico lugar da tela que impede a leitura
  // errada mais provavel de um forward sem alarme.
  { assunto: "monitoramento continuo: CUSUM, dois limiares e a ausencia de sujeito (0C)", secao: "#monitoramento" },
];

export const SECOES: { id: string; n: string; titulo: string; pergunta: string }[] = [
  { id: "experimento", n: "01", titulo: "Executar", pergunta: "o que da para fazer agora?" },
  { id: "resultado", n: "02", titulo: "Resultado", pergunta: "o agente ganhou do acaso?" },
  // A pergunta da 0B, e ela e diferente da 02. Ganhar do acaso num run e
  // resultado; o protocolo aceitar a hipotese e outra coisa - e §14.4 diz que
  // a fase e "primariamente um teste do validador".
  { id: "conhecimento", n: "03", titulo: "Conhecimento", pergunta: "o protocolo aceita essa hipotese?" },
  // A pergunta que a 0B existe para responder. Ela vem DEPOIS da 03 na tela e
  // ANTES dela na ordem logica - §14.4: "avaliado antes de qualquer resultado
  // do agente ser considerado". Fica aqui porque a tela e lida de cima para
  // baixo por quem acabou de rodar algo, e o aviso no topo da 02 ja diz
  // quando o resultado nao vale.
  { id: "portao-a", n: "04", titulo: "Portao A", pergunta: "o protocolo rejeita defeito?" },
  // So existe se o A passar - R49. A tela respeita a ordem: quem chega aqui
  // com o A reprovado ve a recusa, e nao um numero parcial.
  { id: "portao-b", n: "05", titulo: "Portao B", pergunta: "existe candidata digna de auditoria?" },
  // Vem DEPOIS do Portao B porque e a pergunta seguinte: o B decide se existe
  // candidata digna de auditoria, e esta diz o que de fato entrou no forward.
  // Na 0C a resposta e "nada", e ela e declarada e nao omitida.
  { id: "quarentena", n: "06", titulo: "Quarentena", pergunta: "o que entrou no forward, e por que nao entrou mais nada?" },
  // §8.8. Vem depois da quarentena porque e a pergunta seguinte: aquela diz o
  // que entrou, esta diz se o que esta em uso continua funcionando. Na 0C nao
  // ha conhecimento em uso, e a secao declara isso em vez de ficar vazia.
  { id: "monitoramento", n: "07", titulo: "Monitoramento", pergunta: "o conhecimento em uso continua funcionando?" },
  { id: "decisao", n: "08", titulo: "Decisao", pergunta: "como ele chegou nessa regra, e quanto custou?" },
  { id: "execucao", n: "09", titulo: "Execucao", pergunta: "o que foi feito no mercado?" },
  { id: "dinheiro", n: "10", titulo: "Dinheiro", pergunta: "as contas fecham?" },
  { id: "ajustes", n: "11", titulo: "Configuracao", pergunta: "sob que parametros isso rodou?" },
  { id: "fechamento", n: "12", titulo: "Fechamento", pergunta: "a 0A responde a propria pergunta?" },
  { id: "substrato", n: "13", titulo: "Substrato", pergunta: "o volume persiste mesmo?" },
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
