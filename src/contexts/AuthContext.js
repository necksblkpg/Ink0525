import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebase';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  function signInWithGoogle() {
    console.log("Försöker logga in med Google");
    return signInWithPopup(auth, googleProvider)
      .then((result) => {
        console.log("Inloggningsresultat:", result);
        // Kontrollera om e-postadressen matchar den tillåtna
        if (result.user.email !== 'neckwearsweden@gmail.com') {
          // Logga ut användaren om e-postadressen inte matchar
          firebaseSignOut(auth);
          setAuthError('Endast neckwearsweden@gmail.com kan logga in i detta system.');
          return false;
        }
        
        setAuthError(null);
        return true;
      })
      .catch((error) => {
        console.error("Detaljerat inloggningsfel:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        setAuthError(`Inloggningsfel: ${error.message}`);
        return false;
      });
  }

  function signOut() {
    return firebaseSignOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Om användaren är inloggad med fel e-post, logga ut dem
      if (user && user.email !== 'neckwearsweden@gmail.com') {
        firebaseSignOut(auth);
        setCurrentUser(null);
        setAuthError('Endast neckwearsweden@gmail.com kan logga in i detta system.');
      } else {
        setCurrentUser(user);
        setAuthError(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    signInWithGoogle,
    signOut,
    authError
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 