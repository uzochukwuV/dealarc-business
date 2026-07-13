export const WORKSPACE_STATUS = {
  NEGOTIATING: { label: "Negotiating", style: "border-foreground/20 bg-secondary text-muted-foreground" },
  AWAITING_FUNDING: { label: "Awaiting funding", style: "border-[hsl(43,74%,55%)]/40 bg-[hsl(43,74%,95%)] text-[hsl(35,80%,30%)]" },
  IN_PROGRESS: { label: "In progress", style: "border-[hsl(213,56%,30%)]/30 bg-[hsl(213,56%,95%)] text-[hsl(213,56%,25%)]" },
  DISPUTED: { label: "Disputed", style: "border-destructive/30 bg-destructive/5 text-destructive" },
  COMPLETED: { label: "Completed", style: "border-[hsl(170,60%,33%)]/30 bg-[hsl(170,100%,95%)] text-[hsl(190,88%,21%)]" },
  CANCELLED: { label: "Cancelled", style: "border-foreground/20 bg-secondary text-muted-foreground" },
};

export const NEXT_ACTION_PROMPTS = {
  NEGOTIATING: "Continue negotiation",
  AWAITING_FUNDING: "Fund escrow to proceed",
  IN_PROGRESS: "Track delivery",
  DISPUTED: "Dispute open — review evidence",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const CONTRACT_TEMPLATES = [
  { id: "simple_escrow", name: "Simple Escrow", recommended_for: ["PURCHASE_ORDER"] },
  { id: "milestone", name: "Milestone Agreement", recommended_for: ["MILESTONE_SERVICE", "PURCHASE_ORDER"] },
  { id: "purchase_order", name: "Purchase Order", recommended_for: ["PURCHASE_ORDER"] },
  { id: "subscription", name: "Subscription", recommended_for: ["MILESTONE_SERVICE"] },
  { id: "revenue_share", name: "Revenue Share", recommended_for: ["MILESTONE_SERVICE"] },
  { id: "sealed_bid", name: "Sealed-Bid Award", recommended_for: ["PURCHASE_ORDER"] },
];

export const CONTRACT_TEMPLATE_DETAILS = [
  { id: "simple_escrow", name: "Simple Escrow", for: "Straightforward purchases where a buyer wants payment protection before delivery.", fund_flow: "Buyer funds escrow → Seller ships → Buyer confirms delivery → Escrow releases to seller." },
  { id: "milestone", name: "Milestone Agreement", for: "Services or projects delivered in phases, with payment tied to each phase.", fund_flow: "Buyer funds escrow → Seller completes each milestone → Buyer approves → Payment released per milestone." },
  { id: "purchase_order", name: "Purchase Order", for: "Standard goods procurement with delivery, inspection, and net-term payment.", fund_flow: "Buyer issues PO → Seller delivers → Buyer inspects → Payment per net terms from acceptance." },
  { id: "subscription", name: "Subscription", for: "Ongoing service access with recurring payments and cancellation terms.", fund_flow: "Buyer subscribes → Periodic fee charged → Cancel with 30 days notice." },
  { id: "revenue_share", name: "Revenue Share", for: "Partnerships where generated revenue is split between parties.", fund_flow: "Revenue generated → Monthly reporting → Shared revenue settled within 15 days." },
  { id: "sealed_bid", name: "Sealed-Bid Award", for: "Competitive bidding where bids are private until award.", fund_flow: "Buyer posts sealed opportunity → Sellers submit private bids → Buyer awards → Escrow agreement activated." },
];

export function monogram(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}