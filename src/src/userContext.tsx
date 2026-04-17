import React, { createContext, useContext } from "react";

export type User = {
  username: string;
  name: string;
  role: "admin" | "worker";
  organisationId?: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
  organisationPlan?: "free" | "pro" | "premium";
} | null;

type UserContextValue = {
  user: User;
  setUser: (u: User) => void;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProvider: React.FC<{
  value: UserContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
};

