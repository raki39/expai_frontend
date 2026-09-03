/* Curva de patrimonio — bloco 2 do painel (secao 6.2).
 *
 * SVG montado no servidor. Sem biblioteca de grafico e sem JavaScript no
 * cliente: sao ~400 pontos por serie, e uma dependencia de grafico aqui
 * traria um runtime inteiro para desenhar tres polilinhas.
 *
 * **Nao ha calculo de negocio aqui** (secao 10.2.1). Tudo o que este arquivo
 * faz e mapear numeros que a api ja produziu para coordenadas de tela: nenhum
 * patrimonio, custo ou excesso e calculado no painel.
 *
 * Escala LINEAR e compartilhada pelas tres series. Escala logaritmica
 * deixaria as curvas mais bonitas e as diferencas menores do que sao — e a
 * secao 6.2 pede o excesso sobre baseline explicito, nao suavizado.
 */

type Ponto = { t: number; patrimonio_cents: number; comprado: boolean };

export type DadosDaCurva = {
  existe: boolean;
  motivo?: string;
  curvas?: Record<string, Ponto[]>;
  finais_cents?: Record<string, number | null>;
  excesso_cents?: Record<string, number>;
  b1_faixa_final?: {
    p5: number;
    p50: number;
    p95: number;
    operacoes_alvo: number;
    repeticoes: number;
  } | null;
  sob_a_config_vigente?: boolean | null;
  aviso?: string;
};

const L = 56;
const R = 16;
const T = 12;
const B = 24;
const W = 720;
const H = 260;

/**
 * Cores por serie, VALIDADAS contra a superficie escura do painel - nao
 * escolhidas no olho.
 *
 * As anteriores reprovavam em quatro checagens, e uma delas importava de
 * verdade: o verde da faixa de B1 (#3fa66a) e o dourado do B3 (#b08a3c)
 * ficavam a ΔE 6,0 sob deuteranopia. Quem tem daltonismo vermelho-verde nao
 * distinguia o B3 da faixa do acaso - que e exatamente a comparacao que a
 * 0A existe para mostrar. B3 contra B2 dava ΔE 14 mesmo com visao normal,
 * abaixo do piso de 15.
 *
 * Estas tres passam em TODOS os pares, inclusive sob as tres formas de
 * daltonismo. Linhas se cruzam, entao qualquer duas podem ficar vizinhas -
 * conferir so os pares adjacentes seria conferir menos do que o desenho faz.
 */
const COR: Record<string, string> = {
  agente: "#3987e5",
  B2: "#d95926",
  B3: "#199e70",
};

/**
 * A faixa de B1 e CINZA, sem matiz.
 *
 * Ela nao e uma quarta serie: e o fundo contra o qual as tres sao lidas.
 * Dar-lhe um matiz proprio a punha para competir por identidade com as
 * linhas - e foi assim que ela e o B3 acabaram indistinguiveis.
 */
const COR_FAIXA = "#8e97a6";

const ROTULO: Record<string, string> = {
  agente: "agente",
  B2: "B2 buy and hold",
  B3: "B3 SMA congelado",
};

function dinheiro(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function Curva({
  dados,
  semente_cents,
}: {
  dados: DadosDaCurva;
  semente_cents?: number;
}) {
  if (!dados.existe || !dados.curvas) {
    return (
      <p className="sub" style={{ marginTop: 0 }}>
        {dados.motivo ?? "Nada para desenhar ainda."}
      </p>
    );
  }

  const series = Object.entries(dados.curvas).filter(([, p]) => p.length > 1);
  if (!series.length) {
    return (
      <p className="sub" style={{ marginTop: 0 }}>
        Nenhuma serie com pontos suficientes.
      </p>
    );
  }

  const todos = series.flatMap(([, p]) => p);
  const t0 = Math.min(...todos.map((p) => p.t));
  const t1 = Math.max(...todos.map((p) => p.t));

  // A faixa do B1 entra no dominio vertical: se ela ficasse fora da escala,
  // o grafico mostraria o agente acima de uma faixa que nao cabe na tela.
  const faixa = dados.b1_faixa_final;
  const candidatos = [
    ...todos.map((p) => p.patrimonio_cents),
    ...(faixa ? [faixa.p5, faixa.p95] : []),
    ...(semente_cents ? [semente_cents] : []),
  ];
  const min = Math.min(...candidatos);
  const max = Math.max(...candidatos);
  const margem = Math.max(1, Math.round((max - min) * 0.08));
  const y0 = min - margem;
  const y1 = max + margem;

  const px = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const py = (v: number) =>
    T + (1 - (v - y0) / Math.max(1, y1 - y0)) * (H - T - B);

  const linha = (p: Ponto[]) =>
    p.map((q) => `${px(q.t).toFixed(1)},${py(q.patrimonio_cents).toFixed(1)}`).join(" ");

  // Rotulos nos extremos do DADO, e nao do dominio. O dominio tem margem
  // para a linha nao encostar na borda, e rotular a margem punha na tela um
  // "US$ 9" que nao corresponde a valor nenhum da serie - um eixo que
  // descreve o desenho em vez de descrever o dado.
  const marcas = [min, Math.round((min + max) / 2), max];

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", minWidth: 520, height: "auto", display: "block" }}
        role="img"
        aria-label="Curva de patrimonio do agente contra os baselines"
      >
        {/* eixo vertical em dinheiro */}
        {marcas.map((v) => (
          <g key={v}>
            <line
              x1={L}
              x2={W - R}
              y1={py(v)}
              y2={py(v)}
              stroke="currentColor"
              strokeOpacity={0.12}
            />
            <text
              x={L - 6}
              y={py(v) + 3}
              textAnchor="end"
              fontSize="9"
              fill="currentColor"
              fillOpacity={0.55}
            >
              {dinheiro(v)}
            </text>
          </g>
        ))}

        {/* capital semente: a linha do "nao fez nada" */}
        {semente_cents ? (
          <g>
            <line
              x1={L}
              x2={W - R}
              y1={py(semente_cents)}
              y2={py(semente_cents)}
              stroke="currentColor"
              strokeOpacity={0.45}
              strokeDasharray="3 3"
            />
            <text
              x={W - R}
              y={py(semente_cents) - 4}
              textAnchor="end"
              fontSize="9"
              fill="currentColor"
              fillOpacity={0.55}
            >
              capital semente
            </text>
          </g>
        ) : null}

        {/* B1: faixa do RESULTADO FINAL, ancorada na borda direita.
            Nao atravessa o tempo de proposito - mil caminhos nunca foram
            acompanhados, so mil resultados finais. */}
        {faixa ? (
          <g>
            <rect
              x={W - R - 46}
              y={py(faixa.p95)}
              width={46}
              height={Math.max(1, py(faixa.p5) - py(faixa.p95))}
              fill={COR_FAIXA}
              fillOpacity={0.14}
            />
            <line
              x1={W - R - 46}
              x2={W - R}
              y1={py(faixa.p50)}
              y2={py(faixa.p50)}
              stroke={COR_FAIXA}
              strokeWidth={1.5}
            />
            <text
              x={W - R - 50}
              y={py(faixa.p50) + 3}
              textAnchor="end"
              fontSize="9"
              fill={COR_FAIXA}
            >
              B1 p5–p95
            </text>
          </g>
        ) : null}

        {series.map(([nome, pontos]) => (
          <polyline
            key={nome}
            points={linha(pontos)}
            fill="none"
            stroke={COR[nome] ?? "currentColor"}
            strokeWidth={nome === "agente" ? 2 : 1.2}
            strokeOpacity={nome === "agente" ? 1 : 0.75}
          />
        ))}
      </svg>

      <div className="linha" style={{ gap: 16, flexWrap: "wrap", marginTop: 8 }}>
        {series.map(([nome]) => (
          <span key={nome} className="sub" style={{ fontSize: 12 }}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 3,
                background: COR[nome] ?? "currentColor",
                verticalAlign: "middle",
                marginRight: 6,
              }}
            />
            {ROTULO[nome] ?? nome} · {dinheiro(dados.finais_cents?.[nome])}
          </span>
        ))}
        {/* A faixa entra na legenda como as linhas. Ela e uma marca com
            significado no desenho, e uma legenda que descreve so parte do
            que esta na tela obriga a adivinhar o resto. */}
        {faixa ? (
          <span className="sub" style={{ fontSize: 12 }}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 9,
                background: COR_FAIXA,
                opacity: 0.5,
                verticalAlign: "middle",
                marginRight: 6,
              }}
            />
            B1 p5–p95 · mediana {dinheiro(faixa.p50)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
