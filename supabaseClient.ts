
import { createClient } from '@supabase/supabase-js';

// Configuration du projet Supabase
// Projet ID: xwjbbawwxnmbsoucgplf
export const supabaseUrl = 'https://xwjbbawwxnmbsoucgplf.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3amJiYXd3eG5tYnNvdWNncGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMjA3MTUsImV4cCI6MjA3MzU5NjcxNX0.2j9IFLNLDe4aDPLo2Hb7Pc2WCDRTqE3h5zlODbEw544';

// Custom fetch with retry logic
const fetchWithRetry = async (url: RequestInfo | URL, options?: RequestInit) => {
  const MAX_RETRIES = 5; // Increased from 3
  const RETRY_DELAY = 2000; // Increased from 1000ms

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error: any) {
      // Only retry on network errors (Failed to fetch)
      const isNetworkError = error.message && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('Network request failed') ||
        error.message.includes('NetworkError') ||
        error.message.includes('Load failed')
      );
      
      if (isNetworkError) {
          if (i < MAX_RETRIES - 1) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
            continue;
          } else {
             throw new Error("Network Error: Connexion impossible. Vérifiez votre internet.");
          }
      }
      throw error;
    }
  }
  throw new Error('Network request failed after retries');
};

// Custom NoOpLock function to prevent lock timeouts
const NoOpLock = async <R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  return fn();
};

// Initialisation du client avec custom fetch
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: NoOpLock
  },
  global: {
    headers: { 'x-application-name': 'tradehub' },
    fetch: fetchWithRetry
  }
});
