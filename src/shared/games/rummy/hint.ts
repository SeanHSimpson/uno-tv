// Explain what the selected cards make, compared with this round's contract,
// so the phone can say why "Lay down" is (or isn't) ready.

import { asRun, asSet, contractLabel, findContract, partOfContract, type Contract, type PCard } from "./cards";

export interface SelectionHint {
  ok: boolean;
  text: string;
}

/**
 * `contract` is what's still left to lay down (the whole contract unless they've laid part of it).
 * `parts`: the "lay down in parts" house rule is on, so a piece of the contract is enough.
 */
export function selectionHint(
  selected: PCard[],
  contract: Contract,
  opts: { parts?: boolean; started?: boolean } = {},
): SelectionHint | null {
  if (!selected.length) return null;
  const need = contractLabel(contract);

  // The whole contract?
  if (findContract(selected, contract, true)) {
    return { ok: true, text: opts.started ? `✓ That's the rest of your contract: ${need}. Tap Lay down!` : `✓ That's the contract: ${need}. Tap Lay down!` };
  }
  if (opts.parts) {
    const part = partOfContract(selected, contract);
    if (part) {
      const missing = { sets: contract.sets - part.used.sets, runs: contract.runs - part.used.runs };
      return { ok: true, text: `✓ That's ${contractLabel(part.used)}. Lay it down now; you'll still need ${contractLabel(missing)}.` };
    }
  }

  // Part of it? Find the biggest piece of the contract these cards make (using every card).
  let best: Contract | null = null;
  for (let s = contract.sets; s >= 0; s--) {
    for (let r = contract.runs; r >= 0; r--) {
      if (s + r === 0) continue;
      if (best && s + r <= best.sets + best.runs) continue;
      if (findContract(selected, { sets: s, runs: r }, true)) best = { sets: s, runs: r };
    }
  }
  if (best) {
    const missing = { sets: contract.sets - best.sets, runs: contract.runs - best.runs };
    return { ok: false, text: `✓ That's ${contractLabel(best)}. You still need ${contractLabel(missing)}, all laid down together.` };
  }

  // A group the round doesn't ask for?
  if (!contract.runs && asRun(selected)) return { ok: false, text: "That's a run, but this round needs sets only (3 or more of the same rank)." };
  if (!contract.sets && asSet(selected)) return { ok: false, text: "That's a set, but this round needs runs only (4 or more in a row, same suit)." };

  // Something that's on its way.
  if (selected.length < 3) return { ok: false, text: `This round: ${need}. Keep selecting: a set is 3+ of one rank, a run is 4+ in a row of one suit.` };
  return {
    ok: false,
    text: `These don't make a group yet. Sets are 3+ of one rank; runs are 4+ in a row of one suit. This round needs ${need}.`,
  };
}
