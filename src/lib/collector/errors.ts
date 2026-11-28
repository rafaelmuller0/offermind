export type ProviderErrorKind =
  "auth" | "rate_limit" | "server" | "network" | "timeout" | "request" | "parse";

/**
 * Erro normalizado de um provedor de anúncios. As mensagens nunca contêm
 * credenciais, URLs com chave ou corpo da resposta do fornecedor.
 */
export class ProviderError extends Error {
  kind: ProviderErrorKind;
  status: number | null;
  retryable: boolean;

  constructor(kind: ProviderErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
    this.status = status;
    this.retryable =
      kind === "rate_limit" || kind === "server" || kind === "network" || kind === "timeout";
  }
}
