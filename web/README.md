# Fase 0A — serviço `web`

Painel do experimento. Hospedado na **Vercel** (ADR 0010).

Estado: **incremento 0 — substrato**. A tela mostra o estado do backend e a
sentinela de persistência. Os oito blocos do painel completo chegam no
incremento 6.

## O padrão: proxy no servidor

O navegador **nunca** fala com a `api`.

```
navegador ──https──► Vercel (rotas de servidor) ──https──► api.up.railway.app
                     token de serviço fica aqui            domínio público
```

Consequências:

- **não existe CORS** — do ponto de vista do navegador tudo é mesma origem;
- o `API_SERVICE_TOKEN` nunca chega ao navegador.

**A `api` tem domínio público** porque a Vercel não alcança a rede privada da
Railway. Isso torna o `API_SERVICE_TOKEN` **a única tranca** entre a internet
e os endpoints que gastam token de LLM — não é mais defesa em profundidade.
Ver `.docs/adr/0010-frontend-na-vercel.md`.

## Autenticação — duas camadas

| Camada | Protege | Onde vive |
|---|---|---|
| `PANEL_TOKEN` | acesso do humano a este serviço | env; vira cookie `httpOnly` após login |
| `API_SERVICE_TOKEN` | acesso deste serviço à `api` | env; nunca sai do servidor |

**Nenhuma variável usa `NEXT_PUBLIC_`**, e isso é proposital: com esse prefixo
o valor entraria no bundle e chegaria ao navegador, anulando o desenho.

## Rodar local

Suba a `api` primeiro (porta 8000), depois:

```bash
npm install
cp .env.example .env.local     # preencha API_SERVICE_TOKEN e PANEL_TOKEN
npm run dev                    # http://localhost:3000
```

A única diferença para produção é o valor de `API_BASE_URL`. Mesmo caminho de
código — se local e produção divergirem, um dos dois deixa de ser testado.

```bash
npm run build && npm run start   # como roda em produção
npm run typecheck
```

## Regra que não pode ser afrouxada

**O frontend não contém lógica de negócio: nenhuma.** Não fala com o SQLite,
não calcula métrica, não decide nada. As rotas de servidor são proxy puro:
acrescentam o token e encaminham.

Seção 10.2.1 do documento: *"o Painel não tem porta dos fundos"* e *"não
contém lógica de negócio: nenhuma"*.

## Estrutura

```
app/
├── layout.tsx                  casca + rodapé permanente da 0A
├── page.tsx                    painel (exige sessão)
├── login/page.tsx              formulário do PANEL_TOKEN
└── api/
    ├── login/route.ts          troca token por cookie httpOnly
    └── proxy/[...path]/route.ts  proxy puro para a api
lib/
├── auth.ts                     sessão, comparação em tempo constante
└── api.ts                      cliente da api (só servidor)
```

## Deploy — Vercel

| Ajuste | Valor |
|---|---|
| Repositório | `frontend` |
| Root directory | `web` |
| Framework | Next.js (detectado automaticamente) |
| Variáveis | `API_BASE_URL`, `API_SERVICE_TOKEN`, `PANEL_TOKEN` |

A Vercel usa o próprio runtime: `next build` e as rotas viram funções. O
script `start` do `package.json` serve só para rodar local igual a produção.

Ver `.docs/adr/0010-frontend-na-vercel.md`.
