"use client";

import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { workTheme } from "./work-theme";

type ThemeSelection = { workCode?: string; cardColor?: string };
const ThemeContext = createContext<(value: ThemeSelection) => void>(() => {});

export function WorkThemeProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<ThemeSelection>({});
  const select = useCallback((value: ThemeSelection) => setSelection(value), []);
  return <ThemeContext.Provider value={select}>
    <div className="work-theme-root" style={workTheme(selection.workCode, selection.cardColor) as CSSProperties}>
      {children}
    </div>
  </ThemeContext.Provider>;
}

/** The active route owns its theme and releases it when leaving the route. */
export function useWorkTheme(workCode?: string, cardColor?: string) {
  const select = useContext(ThemeContext);
  useEffect(() => {
    select({ workCode, cardColor });
    return () => select({});
  }, [select, workCode, cardColor]);
}
