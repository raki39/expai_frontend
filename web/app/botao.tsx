"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Botao de envio que se desabilita e diz o que esta fazendo.
 *
 * Existe por causa da ingestao: ela leva ~35 segundos baixando 46 arquivos, e
 * um botao que nao responde ao clique durante meio minuto e indistinguivel de
 * um botao quebrado. Quem clica de novo dispara a operacao duas vezes.
 *
 * E o unico componente de cliente do painel. Todo o resto e servidor.
 */
export function Botao({
  children,
  pendente = "aguarde…",
}: {
  children: ReactNode;
  pendente?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? pendente : children}
    </button>
  );
}
