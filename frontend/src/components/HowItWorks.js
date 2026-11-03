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
    <DialogContent data-testid="modal-how-it-works" className="max-w-2xl bg-[#141414] border-slate-800 max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">How it works</DialogTitle>
      </DialogHeader>
      <div className="space-y-5">
        <Block title="1. Kalshi prices">
          Every price is Kalshi's live price to buy YES, shown in American odds with Kalshi's taker fee included (<M>0.07 × P × (1 − P)</M> per contract).
        </Block>
        <Block title="2. Live combo quotes">
          For a parlay or a triple-double, the app asks Kalshi's market makers for a live quote on that exact combo (a request for quote),
          takes the best price, then cancels the request. It never places a bet.
        </Block>
        <Block title="3. Triple-double combos">
          Triple-double = <M>N+ points & 10+ rebounds & 10+ assists</M>, priced as one Kalshi combo. Pick 10+, 15+ or 20+ points in the scanner.
        </Block>
        <Block title="4. Removing the book's margin">
          Book odds you type are turned into a fair chance. With Over and Under:
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li><b>Multiplicative</b>: <M>p_over / (p_over + p_under)</M></li>
            <li><b>Additive</b>: <M>p_over − (overround − 1) / 2</M></li>
            <li><b>Power</b>: solve <M>p_over^k + p_under^k = 1</M>, fair = <M>p_over^k</M></li>
            <li><b>Worst-case</b>: the least favourable of the three</li>
          </ul>
          One-sided odds (parlays, triple-doubles) have an assumed hold % removed instead.
        </Block>
        <Block title="5. EV">
          Fair = the average across the books you entered. <M>EV% = fair / (Kalshi price + fee) − 1</M>.
        </Block>
      </div>
    </DialogContent>
  </Dialog>
);
