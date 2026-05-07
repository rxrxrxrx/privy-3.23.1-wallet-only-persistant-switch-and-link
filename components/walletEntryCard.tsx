"use client";

import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type WalletEntry = {
  address: string;
  displayName: string;
  isConnected: boolean;
  isLinked: boolean;
  walletIndex?: number | null;
  connectedWallet?: ConnectedStandardSolanaWallet;
};

type Props = {
  entry: WalletEntry;
  isActive: boolean;
  onSelect: () => void;
  onReconnect?: () => void;
};

function formatAddress(address: string) {
  if (!address || address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletEntryCard({
  entry,
  isActive,
  onSelect,
  onReconnect,
}: Props) {
  const dim = entry.isLinked && !entry.isConnected;

  return (
    <div
      className={`bg-gray-900 border rounded-lg p-6 transition-colors ${
        isActive
          ? "border-blue-500 ring-2 ring-blue-500/50"
          : "border-gray-700 hover:border-gray-500"
      } ${dim ? "opacity-70" : ""}`}
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={onSelect}
          className="w-full flex items-start justify-between gap-3 text-left cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-gray-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-white truncate">
                {entry.displayName}
              </h3>
              <p className="text-sm text-gray-400 truncate">
                {formatAddress(entry.address)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {isActive ? <Badge>Active</Badge> : null}
            {entry.isLinked ? (
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
                Linked
              </span>
            ) : null}
            {entry.isConnected ? (
              <span className="text-[10px] uppercase tracking-wider text-sky-400 bg-sky-500/10 border border-sky-500/30 rounded px-1.5 py-0.5">
                In extension
              </span>
            ) : null}
            {entry.isLinked && !entry.isConnected ? (
              <span className="text-[10px] uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                Offline
              </span>
            ) : null}
          </div>
        </button>

        {entry.isLinked && !entry.isConnected && onReconnect ? (
          <button
            type="button"
            onClick={onReconnect}
            className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
          >
            Reconnect to sign
          </button>
        ) : null}
      </div>
    </div>
  );
}
