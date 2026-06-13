import { useEffect, useState } from "react";
import { applyPlatformAttribute, detectPlatform, type AppPlatform } from "@/lib/platform";

export function usePlatform(): AppPlatform {
  const [platform, setPlatform] = useState<AppPlatform>(() => detectPlatform());

  useEffect(() => {
    setPlatform(applyPlatformAttribute());
  }, []);

  return platform;
}
