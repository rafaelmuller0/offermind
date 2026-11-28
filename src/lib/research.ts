export const stages = [
  "País",
  "Ranking de nichos",
  "Micronichos",
  "Mineração",
  "Análise da oferta",
  "Modelagem",
  "Plano estratégico e financeiro",
  "Direção de arte",
  "Produto principal",
  "Order bumps",
  "Página de vendas",
  "Criativos",
  "Checkout",
  "Auditoria",
  "Tráfego",
];
export type CandidateCard = {
  key: string;
  name: string;
  destination: string;
  advertiser: string;
  observed: string;
  count: number;
  window: number;
  sources: string[];
  evidence: { id: string; start: string; format: string; title: string }[];
  image: string;
};
export type Turn = {
  stage: number;
  instruction: string;
  answer: string;
  sources: string[];
  cards: CandidateCard[];
  salesPage?: string;
  checkout?: string;
};
export type Session = { version: number; country: "BR" | "US" | ""; stage: number; turns: Turn[] };
export const initial: Session = { version: 0, country: "", stage: 1, turns: [] };
export function nextStage(state: Session, action: "approve" | "batch") {
  if (action === "batch" && state.stage !== 4)
    throw Error("O próximo lote exige a etapa de mineração.");
  const stage = action === "batch" ? 4 : state.stage + 1;
  if (stage > stages.length) throw Error("Operação concluída.");
  return stage;
}
