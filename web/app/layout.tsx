import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fase 0A — painel",
  description: "Painel minimo do experimento da Fase 0A",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <main>{children}</main>
        {/* Rodape permanente exigido pela secao 14 (0A) e pela 14.4.1.
            Fica fixo de proposito: e a frase que impede alguem de olhar uma
            curva bonita e concluir alguma coisa dela. */}
        <footer>
          Fase 0A · nenhuma conclusao estatistica · nenhum conhecimento
          promovido · fidelidade declarada 1 · perfil <code>neutro@1</code>
        </footer>
      </body>
    </html>
  );
}
