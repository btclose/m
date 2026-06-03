import React, { createContext, useContext, useState, useCallback } from "react";

interface AppContextValue {
  refreshKey: number;
  triggerRefresh: () => void;
  selectedPositionId: string | null;
  setSelectedPositionId: (id: string | null) => void;
}

const AppContext = createContext<AppContextValue>({
  refreshKey: 0,
  triggerRefresh: () => {},
  selectedPositionId: null,
  setSelectedPositionId: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <AppContext.Provider value={{ refreshKey, triggerRefresh, selectedPositionId, setSelectedPositionId }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
