"use client";

import { useWallets } from "@privy-io/react-auth/solana";
import { useState } from "react";

/**
 * Pattern C logout: there is no Privy session to clear, so "logout"
 * means disconnecting every attached wallet-standard wallet. Once a
 * wallet disconnects it drops out of `useWallets()` and the dashboard
 * reverts to its "not connected" state automatically.
 *
 * No call to `usePrivy().logout()` — there's no session to kill.
 */
export function LogoutConfirmButton() {
  const { wallets } = useWallets();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-gray-400 hover:text-white cursor-pointer"
      >
        Disconnect
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-300">Disconnect all attached wallets?</span>
      <button
        type="button"
        disabled={working}
        onClick={async () => {
          setWorking(true);
          await Promise.all(
            wallets.map((w) =>
              w.disconnect().catch(() => {
                // Best effort — wallet may already be disconnected
              }),
            ),
          );
          setConfirming(false);
          setWorking(false);
        }}
        className="text-red-400 hover:text-red-300 font-medium cursor-pointer disabled:opacity-50"
      >
        Yes, disconnect
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-gray-400 hover:text-white cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
}
