// UserContext.js
import React, { createContext, useState } from 'react';

// Creamos el contexto con un valor inicial null
export const UserContext = createContext(null);

// Creamos el proveedor para envolver la aplicación
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState({
    id: 1,
    username: 'john_doe',
    email: 'john@example.com',
  });

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};
