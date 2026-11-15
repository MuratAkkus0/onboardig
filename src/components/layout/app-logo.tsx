import Image from "next/image";
import { APP_CONFIG } from "@/config/app";

/** The portal logo (decorative: the app name always sits next to it). Source: APP_CONFIG.logoPath. */
export function AppLogo({ className }: { className?: string }) {
  return (
    <Image
      src={APP_CONFIG.logoPath}
      alt=""
      width={24}
      height={24}
      unoptimized
      className={className}
    />
  );
}
