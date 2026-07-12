import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { signIn as amplifySignIn, signOut as amplifySignOut, fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import "./AmplifyConfig";

interface AuthState {
  loading: boolean;
  isAuthenticated: boolean;
  email: string | null;
  groups: string[];
  isAdmin: boolean;
  studentId: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const initialState: AuthState = {
  loading: true,
  isAuthenticated: false,
  email: null,
  groups: [],
  isAdmin: false,
  studentId: null,
};

async function loadAuthState(): Promise<AuthState> {
  try {
    await getCurrentUser();
    const session = await fetchAuthSession();
    const claims = session.tokens?.idToken?.payload ?? {};
    const rawGroups = claims["cognito:groups"];
    const groups = Array.isArray(rawGroups) ? (rawGroups as string[]) : [];
    return {
      loading: false,
      isAuthenticated: true,
      email: (claims.email as string) ?? null,
      groups,
      isAdmin: groups.includes("Admins"),
      studentId: (claims["custom:studentId"] as string) ?? null,
    };
  } catch {
    return { ...initialState, loading: false };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    loadAuthState().then(setState);
  }, []);

  const signIn = async (email: string, password: string) => {
    await amplifySignIn({ username: email, password });
    setState(await loadAuthState());
  };

  const signOut = async () => {
    await amplifySignOut();
    setState({ ...initialState, loading: false });
  };

  const getIdToken = async () => {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  };

  return <AuthContext.Provider value={{ ...state, signIn, signOut, getIdToken }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
