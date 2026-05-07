"use client";

import { useLogin } from "@/hooks/usePrivyTracking";

type Props = {
  label?: string;
  className?: string;
};

export default function LoginButton({
  label = "Connect wallet",
  className,
}: Props) {
  const { login } = useLogin();
  return (
    <button
      onClick={() => login()}
      className={
        className ??
        "rounded-full border border-solid border-transparent transition-colors cursor-pointer flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
      }
      type="button"
    >
      {label}
    </button>
  );
}
