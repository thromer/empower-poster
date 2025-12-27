// https://claude.ai/chat/8f2e84fa-4254-4723-8ae9-e8bba724a486

// Our representation of holding data
export interface HoldingEntry {
  userAccountId: number;
  ticker: string;
  price: number;
  quantity: number;
  value: number;
}

// Our representation of per-asset classification by percentage
export type Classifications = Record<string, Classification[]>;

export interface Classification {
  classes: [string, string];
  pct: number;
}

// Holding data returned by Empower
interface HoldingEntryIn {
  userAccountId: number;
  description?: string;
  ticker?: string;
  price: number;
  quantity: number;
  value: number;
}

// Classification data returned by Empower. Exported for tests.
export interface ClassificationIn {
  classificationTypeName: string;
  assets?: Asset[];
  classifications?: ClassificationIn[];
}

interface Asset {
  ticker?: string;
  description?: string;
  value: number;
  userAccountId: number;
}

// Internal representation of one classification row by value
interface ClassificationValue {
  ticker: string;
  classes: [string, string];
  value: number;
}

export function getHoldings(holdingsIn: HoldingEntryIn[]): HoldingEntry[] {
  return holdingsIn.map((h) => ({
    userAccountId: h.userAccountId,
    price: h.price,
    quantity: h.quantity,
    value: h.value,
    ticker: h.ticker || h.description || "",
  }));
}

// Flatten Empower classification data
function processClassifications(
  input: ClassificationIn[],
): ClassificationValue[] {
  const valueMap: ClassificationValue[] = [];

  function processAssets(
    assets: Asset[],
    className: string,
    subClassName: string,
  ) {
    for (const asset of assets) {
      if (asset.value < 0) {
        const details = `${asset.ticker} ${className} ${asset.value}`;
        throw new Error(`Unexpected negative value ${details}`);
      }
      const ticker = asset.ticker || asset.description || "";
      valueMap.push({
        ticker,
        classes: [className, subClassName],
        value: asset.value,
      });
    }
  }

  for (const item of input) {
    const className = item.classificationTypeName || "";
    // Process top-level assets
    if (item.assets) {
      processAssets(item.assets, className, "");
    }
    // Process nested classifications
    if (item.classifications) {
      for (const subClassification of item.classifications) {
        const subClassName = subClassification.classificationTypeName || "";
        if (subClassification.assets) {
          processAssets(subClassification.assets, className, subClassName);
        }
      }
    }
  }
  return valueMap;
}

const PRECISION = 100000000000;

function groupByTickerWithFractions(
  entries: ClassificationValue[],
): Classifications {
  const tickerMap = new Map<string, ClassificationValue[]>();

  // Group by ticker
  for (const entry of entries) {
    const existing = tickerMap.get(entry.ticker);
    if (existing) {
      existing.push(entry);
    } else {
      tickerMap.set(entry.ticker, [entry]);
    }
  }
  // Calculate fractions and transform
  return Object.fromEntries(
    Array.from(tickerMap, ([ticker, classificationValues]) => {
      const total = classificationValues.reduce((sum, c) => sum + c.value, 0);
      return [
        ticker,
        classificationValues.map((c) => ({
          classes: c.classes,
          // Treat 0/0 as 1
          pct:
            c.value == total
              ? 1
              : Math.round((c.value / total) * PRECISION) / PRECISION,
        })),
      ];
    }),
  );
}

export function getClassifications(input: ClassificationIn[]): Classifications {
  return groupByTickerWithFractions(processClassifications(input));
}
