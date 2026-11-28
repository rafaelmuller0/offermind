import { getRequestHeader, setResponseHeaders } from "@tanstack/react-start/server";

export async function researcher() {
  setResponseHeaders(new Headers({ "Cache-Control": "private, no-store" }));
  const domain = process.env["CF_ACCESS_TEAM_DOMAIN"];
  const audience = process.env["CF_ACCESS_AUD"];
  const token = getRequestHeader("cf-access-jwt-assertion");
  if (!domain || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain) || !audience || !token)
    throw Error(
      "Entre pelo acesso privado do OfferMind. A autenticação deve estar configurada pelo administrador.",
    );
  const issuer = "https://" + domain;
  const [header, payload, signature, extra] = token.split(".");
  if (!header || !payload || !signature || extra) throw Error("Sessão inválida.");
  const decode = (s: string) =>
    Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const head = JSON.parse(new TextDecoder().decode(decode(header)));
  const claims = JSON.parse(new TextDecoder().decode(decode(payload)));
  const now = Date.now() / 1000;
  if (
    head.alg !== "RS256" ||
    claims.iss !== issuer ||
    !Array.isArray(claims.aud) ||
    !claims.aud.includes(audience) ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now ||
    claims.nbf > now ||
    typeof claims.sub !== "string" ||
    !claims.sub
  )
    throw Error("Sessão expirada ou inválida.");
  const response = await fetch(issuer + "/cdn-cgi/access/certs", {
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Error("Não foi possível validar a sessão.");
  const keys = (await response.json()) as { keys: (JsonWebKey & { kid: string })[] };
  const cert = keys.keys.find((k) => k.kid === head.kid);
  if (!cert) throw Error("Assinatura desconhecida.");
  const key = await crypto.subtle.importKey(
    "jwk",
    cert,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decode(signature),
      new TextEncoder().encode(header + "." + payload),
    ))
  )
    throw Error("Assinatura inválida.");
  return "offermind:" + encodeURIComponent(claims.sub);
}

export async function redis<T>(...command: (string | number)[]): Promise<T> {
  const url = process.env["UPSTASH_REDIS_REST_URL"];
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"];
  if (!url?.startsWith("https://") || !token) throw Error("Armazenamento privado indisponível.");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error("Falha no armazenamento privado.");
  const result = (await response.json()) as { result: T; error?: string };
  if (result.error) throw Error("Operação de armazenamento recusada.");
  return result.result;
}

export async function reserve(user: string, service: string, limit: number) {
  const count = await redis<number>(
    "EVAL",
    "local n=redis.call('incr',KEYS[1]); if n==1 then redis.call('expire',KEYS[1],86400) end; return n",
    1,
    user + ":" + service + ":" + new Date().toISOString().slice(0, 10),
  );
  if (count > limit) throw Error("Limite diário de consultas atingido.");
}
