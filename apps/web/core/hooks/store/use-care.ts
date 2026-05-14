import { useContext } from "react";
import { StoreContext } from "@/lib/store-context";
import type { ICareStore } from "@/plane-web/store/care";

export const useCare = (): ICareStore => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useCare must be used within StoreProvider");
  return context.care;
};
