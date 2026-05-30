import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setupAuthInterceptor } from '../api/client.js';

/**
 * Registers the Clerk getToken function with the axios client
 * so every API request automatically carries an Authorization header.
 * Must be rendered inside <ClerkProvider> and <SignedIn>.
 */
export default function AuthProvider({ children }) {
  const { getToken } = useAuth();

  useEffect(() => {
    setupAuthInterceptor(getToken);
  }, [getToken]);

  return children;
}
