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
 * `classe` existe para um caso so: a acao que gasta dinheiro de verdade nao
 * pode parecer com as outras. Um botao que custa R$0,00 e um que custa R$0,34
 * com a mesma aparencia sao um convite a clicar sem ler.
 *
 * E o unico componente de cliente do painel. Todo o resto e servidor.
 */
export function Botao({
  children,
  pendente = "aguarde...",
  classe = "",
}: {
  children: ReactNode;
  pendente?: string;
  classe?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={classe} disabled={pending}>
      {pending ? pendente : children}
    </button>
  );
}
