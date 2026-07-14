import { createContext, useContext, useState, type ReactNode } from "react";

interface DriverFilterContextValue {
  selectedDriverIds: Set<number>;
  toggleDriver: (id: number) => void;
  clearDrivers: () => void;
  isFiltered: boolean;
}

const DriverFilterContext = createContext<DriverFilterContextValue>({
  selectedDriverIds: new Set(),
  toggleDriver: () => {},
  clearDrivers: () => {},
  isFiltered: false,
});

export function DriverFilterProvider({ children }: { children: ReactNode }) {
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<number>>(new Set());

  const toggleDriver = (id: number) => {
    setSelectedDriverIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearDrivers = () => setSelectedDriverIds(new Set());

  return (
    <DriverFilterContext.Provider
      value={{
        selectedDriverIds,
        toggleDriver,
        clearDrivers,
        isFiltered: selectedDriverIds.size > 0,
      }}
    >
      {children}
    </DriverFilterContext.Provider>
  );
}

export function useDriverFilter() {
  return useContext(DriverFilterContext);
}
