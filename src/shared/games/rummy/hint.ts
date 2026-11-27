// Explain what the selected cards make, compared with this round's contract,
// so the phone can say why "Lay down" is (or isn't) ready.

import { asRun, asSet, contractLabel, findContract, partOfContract, type Contract, type MeldShape, type PCard } from "./cards";

export interface SelectionHint {
  ok: boolean;
  text: string;
}

export interface SelectionEval {
  hint: SelectionHint | null;
  whole: boolean;
  part: { melds: MeldShape[]; used: Contract } | null;
}

/**
 * Evaluate the selected cards against `contract` in a single pass, returning both the
 * user-facing hint and whether the selection satisfies the whole contract or a valid part.
 */
export function evaluateSelection(
  selected: PCard[],
  contract: Contract,
  opts: { parts?: boolean; started?: boolean } = {},
): SelectionEval {
  if (!selected.length) return { hint: null, whole: false, part: null };
  const need = contractLabel(contract);

  // Fast path: fewer than 3 cards can never be a valid set or run.
  if (selected.length < 3) {
    return {
      hint: { ok: false, text: `This round: ${need}. Keep selecting: a set is 3+ of one rank, a run is 4+ in a row of one suit.` },
      whole: false,
      part: null,
    };
  }

  // The whole contract?
  if (findContract(selected, contract, true)) {
    return {
      hint: { ok: true, text: opts.started ? `✓ That's the rest of your contract: ${need}. Tap Lay down!` : `✓ That's the contract: ${need}. Tap Lay down!` },
      whole: true,
      part: null,
    };
  }

  // Part of it? Compute once and reuse for both parts-mode and normal hint feedback.
  const bestPart = partOfContract(selected, contract);
  if (bestPart) {
    const missing = { sets: contract.sets - bestPart.used.sets, runs: contract.runs - bestPart.used.runs };
    if (opts.parts) {
      return {
        hint: { ok: true, text: `✓ That's ${contractLabel(bestPart.used)}. Lay it down now; you'll still need ${contractLabel(missing)}.` },
        whole: false,
        part: bestPart,
      };
    }
    return {
      hint: { ok: false, text: `✓ That's ${contractLabel(bestPart.used)}. You still need ${contractLabel(missing)}, all laid down together.` },
      whole: false,
      part: null,
    };
  }

  // A group the round doesn't ask for?
  if (!contract.runs && asRun(selected)) {
    return { hint: { ok: false, text: "That's a run, but this round needs sets only (3 or more of the same rank)." }, whole: false, part: null };
  }
  if (!contract.sets && asSet(selected)) {
    return { hint: { ok: false, text: "That's a set, but this round needs runs only (4 or more in a row, same suit)." }, whole: false, part: null };
  }

  return {
    hint: {
      ok: false,
      text: `These don't make a group yet. Sets are 3+ of one rank; runs are 4+ in a row of one suit. This round needs ${need}.`,
    },
    whole: false,
    part: null,
  };
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
  return evaluateSelection(selected, contract, opts).hint;
}
