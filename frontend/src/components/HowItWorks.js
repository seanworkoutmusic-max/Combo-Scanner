import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

const Block = ({ title, children }) => (
  <div className="space-y-1.5">
    <div className="font-display font-semibold text-cyan-200 tracking-wide">{title}</div>
    <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
  </div>
);

const M = ({ children }) => <code className="font-mono text-xs bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-200">{children}</code>;

export const HowItWorks = ({ trigger }) => (
  <Dialog>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent data-testid="modal-how-it-works" className="max-w-2xl bg-[#0F131C] border-slate-800 max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">How the devig works</DialogTitle>
      </DialogHeader>
      <div className="space-y-5">
        <Block title="1. Leg devig (per book)">
          Each leg (10+ pts = Over 9.5, etc.) is devigged from that book's own Over/Under pair:
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li><b>Multiplicative</b>: <M>p_over / (p_over + p_under)</M></li>
            <li><b>Additive</b>: <M>p_over − (overround − 1) / 2</M></li>
            <li><b>Power</b>: solve <M>p_over^k + p_under^k = 1</M>, fair = <M>p_over^k</M></li>
            <li><b>Worst-case</b>: the least favourable of the three for the side you bet</li>
          </ul>
        </Block>
        <Block title="2. SGP correlation">
          The book's real SGP price keeps its correlation: <M>corr = SGP_implied / Π leg_implied</M>. Fair combo ={" "}
          <M>corr × Π fair_leg</M>. An optional "SGP extra hold %" divides this further if you think books add margin on top.
        </Block>
        <Block title="3. Double-double from pairs">
          Ignoring steals/blocks: <M>P(DD) = P(PR) + P(PA) + P(RA) − 2·P(PRA)</M>, each priced as a real SGP. Triple-double = <M>P(PRA)</M>.
        </Block>
        <Block title="4. Direct markets">
          If a book offers "To record a double/triple-double" Yes/No, it is devigged directly. Source toggle: SGP, Direct, or Blend (all
          estimates averaged).
        </Block>
        <Block title="5. Sportsbook average & EV">
          Fair = average of per-book fair probs. Kalshi taker fee ≈ <M>0.07 × P × (1 − P)</M> per contract.{" "}
          <M>EV% = fair / (ask + fee) − 1</M>, for both YES and NO.
        </Block>
      </div>
    </DialogContent>
  </Dialog>
);
