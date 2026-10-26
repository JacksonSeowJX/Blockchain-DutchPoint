import { act, renderHook, waitFor } from "@testing-library/react";
import { getAddress } from "ethers";
import { afterEach, describe, expect, it } from "vitest";

import { useWallet } from "./useWallet";

const ACCOUNT_A = "0x1111111111111111111111111111111111111111";
const ACCOUNT_B = "0x2222222222222222222222222222222222222222";

afterEach(() => {
  delete window.ethereum;
});

describe("useWallet", () => {
  // Codex audit finding A3: wallet responses can complete out of order; the newest must win.
  it("A3: an older eth_accounts response cannot overwrite a newer account", async () => {
    let resolveFirst: (accounts: string[]) => void = () => {};
    const firstAnswer = new Promise<string[]>((resolve) => {
      resolveFirst = resolve;
    });
    let accountsCalls = 0;
    let onAccountsChanged: () => void = () => {};

    window.ethereum = {
      async request({ method }) {
        if (method === "eth_accounts") {
          accountsCalls += 1;
          return accountsCalls === 1 ? firstAnswer : [ACCOUNT_B];
        }
        if (method === "eth_chainId") {
          return "0x7a69";
        }
        throw new Error(`unexpected ${method}`);
      },
      on(event, handler) {
        if (event === "accountsChanged") {
          onAccountsChanged = () => handler();
        }
      },
      removeListener() {}
    };

    const { result } = renderHook(() => useWallet());

    // While the initial read is still pending, the wallet reports a switch to account B.
    await act(async () => {
      onAccountsChanged();
    });
    await waitFor(() => expect(result.current.account).toBe(getAddress(ACCOUNT_B)));

    // The initial read for account A answers last.
    await act(async () => {
      resolveFirst([ACCOUNT_A]);
      await firstAnswer;
    });

    expect(result.current.account).toBe(getAddress(ACCOUNT_B));
  });
});
