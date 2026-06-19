import { createContext, useContext, useState, useCallback } from 'react';

const StockDialogContext = createContext({ openStockDialog: () => {} });

export function useStockDialog() {
  return useContext(StockDialogContext);
}

export function StockDialogProvider({ children }) {
  const [stock, setStock] = useState(null); // { isin, stock_name, market_cap_cat, industry }

  const openStockDialog = useCallback((s) => setStock(s), []);
  const closeStockDialog = useCallback(() => setStock(null), []);

  return (
    <StockDialogContext.Provider value={{ openStockDialog, closeStockDialog, stock }}>
      {children}
    </StockDialogContext.Provider>
  );
}
