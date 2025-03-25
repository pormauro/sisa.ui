// AppContext.js
import React, { createContext } from 'react';
import { BASE_URL } from '../config/index';

export const AppContext = createContext({
  baseUrl: BASE_URL,
});

export const AppProvider = ({ children }) => {
  const contextValue = { baseUrl: BASE_URL };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};
