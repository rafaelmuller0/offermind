import { safeUrl } from "./offermind";
export function isCheckout(value: string) {
  const valid = safeUrl(value);
  if (!valid) return false;
  const u = new URL(valid);
  return (
    /^(pay|checkout|buy|payment)\./i.test(u.hostname) ||
    /(^|\/)(checkout|payment|pagamento|cart)(\/|$)/i.test(u.pathname)
  );
}
export function destinationLabel(value: string) {
  return isCheckout(value)
    ? "Checkout identificado"
    : "Destino do anúncio · página de vendas a verificar";
}
