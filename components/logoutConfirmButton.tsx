"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";

export function LogoutConfirmButton() {
  const { logout } = usePrivy();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-gray-400 hover:text-white cursor-pointer"
      >
        Logout
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-300">
        Logout uses 1 wallet auth on next login. Sure?
      </span>
      <button
        type="button"
        onClick={async () => {
          await logout();
          setConfirming(false);
        }}
        className="text-red-400 hover:text-red-300 font-medium cursor-pointer"
      >
        Yes, logout
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
