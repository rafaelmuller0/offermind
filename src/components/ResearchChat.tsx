import type { Ad, Offer } from "../lib/offermind";
import { useEffect, useState } from "react";
import { loadResearch, research } from "../lib/research.functions";
import { initial, stages, type Session } from "../lib/research";
import { destinationLabel } from "../lib/offer-links";

export default function ResearchChat({
  onDiscover,
}: {
  onDiscover: (entries: { offer: Offer; ads: Ad[] }[]) => void;
}) {
  const [state, setState] = useState<Session>(initial);
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  const [selection, setSelection] = useState("");
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setState(await loadResearch());
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Histórico indisponível.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function submit(action: "approve" | "batch" | "restart" | "revise", value = selection) {
    setBusy(true);
    setError("");
    try {
      const next = await research({ data: { version: state.version, action, selection: value } });
      setState(next);
      setSelection("");
      const last = next.turns.at(-1);
      if (last?.cards.length)
        onDiscover(
          last.cards.map((c) => {
            const id = "discovery:" + next.country + ":" + c.key;
            const offer: Offer = {
              id,
              name: c.name,
              advertiser: c.advertiser,
              niche: last.instruction,
              country: next.country,
              promise: "",
              url: c.destination,
              pageTotal: null,
              favorite: false,
              monitored: false,
              notes: "Candidata observada pelo OfferMind Chat.",
              stage: "Investigação",
            };
            const ads: Ad[] = c.evidence.map((a) => ({
              id: a.id,
              offerId: id,
              country: next.country,
              status: "active",
              start: a.start,
              observed: c.observed,
              source: "https://www.facebook.com/ads/library/?id=" + a.id,
              headline: a.title,
              concept: "",
              reviewed: false,
              format: a.format,
            }));
            return { offer, ads };
          }),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Consulta indisponível.");
    } finally {
      setBusy(false);
    }
  }
  const button = "rounded-lg border border-violet-400/60 px-4 py-2 text-sm disabled:opacity-40";
  const cards = state.turns.flatMap((t) => t.cards);
  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">OfferMind Chat</h1>
        <p>
          Etapa {state.stage} de 15 · {stages[state.stage - 1]}{" "}
          {state.country && " · " + state.country}
        </p>
      </header>
      {state.turns.map((turn, i) => (
        <article key={i} className="space-y-3 rounded-xl border border-slate-700 p-5">
          <h2 className="font-semibold">{stages[turn.stage - 1]}</h2>
          <p className="text-sm text-violet-300">{turn.instruction}</p>
          <p className="whitespace-pre-wrap">{turn.answer}</p>
          {turn.stage === 5 && (
            <div>
              <p>
                Página de vendas ·{" "}
                {turn.salesPage ? (
                  <a className="underline" href={turn.salesPage} target="_blank" rel="noreferrer">
                    {turn.salesPage}
                  </a>
                ) : (
                  "Indisponível"
                )}
              </p>
              <p>
                Checkout ·{" "}
                {turn.checkout ? (
                  <a className="underline" href={turn.checkout} target="_blank" rel="noreferrer">
                    {turn.checkout}
                  </a>
                ) : (
                  "Indisponível"
                )}
              </p>
            </div>
          )}
          {turn.sources.map((s, i) => (
            <a
              className="block break-all text-cyan-300 underline"
              key={s}
              target="_blank"
              rel="noreferrer"
              href={s}
            >
              Fonte {i + 1} · {s}
            </a>
          ))}
          {turn.cards.map((c) => (
            <div className="rounded-lg bg-slate-900 p-4" key={c.key}>
              {c.image && (
                <img
                  src={c.image}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  alt="Criativo observado"
                  className="max-h-44"
                />
              )}
              <h3>{c.name}</h3>
              <p>
                {c.advertiser} · {c.observed} · {c.count} anúncios ativos observados · {c.window} na
                janela de idade
              </p>
              <a
                className="text-cyan-300 underline"
                href={c.destination}
                rel="noreferrer"
                target="_blank"
              >
                {destinationLabel(c.destination)}
              </a>
              <div className="flex flex-wrap gap-3">
                {c.sources.map((s, i) => (
                  <a key={s} className="underline" href={s} rel="noreferrer" target="_blank">
                    Anúncio {i + 1}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </article>
      ))}
      {error && (
        <p role="alert" className="text-amber-300">
          {error}
        </p>
      )}
      {busy && <p role="status">Consultando…</p>}
      <fieldset disabled={busy || !ready} className="flex flex-wrap gap-3">
        {state.stage === 1 ? (
          <>
            <legend>Qual mercado deseja pesquisar?</legend>
            {(["BR", "US"] as const).map((c) => (
              <button className={button} key={c} onClick={() => submit("approve", c)}>
                {c === "BR" ? "Brasil" : "Estados Unidos"}
              </button>
            ))}
          </>
        ) : state.stage < 15 ? (
          <>
            <legend className="mb-2">Aprovar e avançar para {stages[state.stage]}</legend>
            {state.stage === 4 ? (
              <>
                <select
                  aria-label="Oferta escolhida"
                  className="bg-slate-900 p-2"
                  value={selection}
                  onChange={(e) => setSelection(e.target.value)}
                >
                  <option value="">Selecione a oferta</option>
                  {cards.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name} · {c.advertiser}
                    </option>
                  ))}
                </select>
                <button className={button} onClick={() => submit("batch")}>
                  Buscar próximo lote
                </button>
              </>
            ) : (
              <input
                className="grow rounded bg-slate-900 p-2"
                aria-label="Escolha ou orientação"
                maxLength={state.stage === 3 ? 150 : 600}
                placeholder={
                  state.stage <= 3
                    ? "Digite o nicho ou micronicho escolhido"
                    : "Orientação opcional"
                }
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
              />
            )}
            <button
              className={button}
              disabled={state.stage <= 4 && !selection.trim()}
              onClick={() => submit("approve")}
            >
              Aprovar etapa
            </button>
          </>
        ) : (
          <p>Operação concluída.</p>
        )}
      </fieldset>
      {ready && state.stage > 1 && state.stage !== 4 && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const el = e.currentTarget.elements.namedItem("question") as HTMLInputElement;
            if (el.value.trim()) void submit("revise", el.value.trim());
          }}
        >
          <input
            className="grow rounded bg-slate-900 p-2"
            name="question"
            aria-label="Mensagem sobre esta etapa"
            placeholder="Pergunte ou peça um ajuste nesta etapa…"
            required
            maxLength={600}
          />
          <button className={button} disabled={busy}>
            Enviar
          </button>
        </form>
      )}
      <div className="flex gap-3">
        <button className={button} disabled={busy} onClick={refresh}>
          Atualizar histórico
        </button>
        {ready && state.turns.length > 0 && (
          <button className={button} disabled={busy} onClick={() => submit("restart")}>
            Arquivar e reiniciar
          </button>
        )}
      </div>
    </section>
  );
}
