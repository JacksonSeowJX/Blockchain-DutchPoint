import { parseEther } from "ethers";
import { describe, expect, it } from "vitest";

import { priceFigure } from "../ui/shared";
import { formatPrice } from "./format";

// Finding D3: Sepolia prices have more decimals than local ones. The 6 Nov sale cleared at 0.0000576 ETH per
// GVRA, and six decimals showed it as 0.000057, a price nobody paid.
describe("formatPrice", () => {
  it("D3: shows the 6 Nov Sepolia prices in full", () => {
    expect(formatPrice(parseEther("0.0000576"))).toBe("0.0000576 ETH");
    expect(formatPrice(parseEther("0.0000792"))).toBe("0.0000792 ETH");
    expect(formatPrice(parseEther("0.000092"))).toBe("0.000092 ETH");
  });

  it("D3: keeps local prices at six decimals", () => {
    expect(formatPrice(parseEther("0.0145505"))).toBe("0.01455 ETH");
    expect(formatPrice(parseEther("0.005"))).toBe("0.005 ETH");
  });
});

describe("priceFigure", () => {
  it("D3: shows the Sepolia clearing price in full", () => {
    expect(priceFigure(parseEther("0.0000576"))).toBe("0.0000576");
  });

  it("D3: holds the width steady while the price falls, at the decimals the price needs", () => {
    expect(priceFigure(parseEther("0.0000843"), true)).toBe("0.00008430");
    expect(priceFigure(parseEther("0.01455"), true)).toBe("0.014550");
  });
});
