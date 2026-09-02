import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Fase 0A — painel",
  description: "Painel minimo do experimento da Fase 0A",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <style>{`
          :root { color-scheme: light dark; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font: 14px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            background: #0f1115; color: #d7dbe0;
          }
          main { max-width: 900px; margin: 0 auto; padding: 32px 20px 96px; }
          h1 { font-size: 18px; margin: 0 0 4px; letter-spacing: .02em; }
          h2 { font-size: 13px; margin: 28px 0 10px; color: #8b93a1;
               text-transform: uppercase; letter-spacing: .08em; font-weight: 600; }
          .sub { color: #8b93a1; margin: 0 0 24px; }
          .card { background: #161a21; border: 1px solid #232833;
                  border-radius: 8px; padding: 14px 16px; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 5px 0; vertical-align: top; }
          td:first-child { color: #8b93a1; width: 42%; padding-right: 12px; }
          .ok { color: #4ade80; } .bad { color: #f87171; }
          input, button {
            font: inherit; padding: 7px 10px; border-radius: 6px;
            border: 1px solid #2c3340; background: #0f1115; color: #d7dbe0;
          }
          button { cursor: pointer; border-color: #3a4252; background: #1d2532; }
          button:hover { background: #253044; }
          footer {
            position: fixed; left: 0; right: 0; bottom: 0;
            background: #0b0d11; border-top: 1px solid #232833;
            color: #6f7888; font-size: 12px; padding: 9px 20px; text-align: center;
          }
          code { color: #a5b4fc; }
        `}</style>
        <main>{children}</main>
        {/* Rodape permanente exigido pela secao 14 (0A) e pela 14.4.1. */}
        <footer>
          Fase 0A · nenhuma conclusao estatistica · nenhum conhecimento
          promovido · fidelidade declarada 1 · perfil <code>neutro@1</code>
        </footer>
      </body>
    </html>
  );
}
