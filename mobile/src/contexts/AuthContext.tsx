import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiClient } from '../services/api';

interface AuthContextData {
    userToken: string | null;
    isLoading: boolean;
    signIn: (token: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [userToken, setUserToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadToken() {
            try {
                const token = await AsyncStorage.getItem('@DesperdicioZero:token');
                if (token) {
                    // Injeta o token interceptado na API
                    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    setUserToken(token);
                }
            } catch (error) {
                console.error('Falha ao carregar token do AsyncStorage:', error);
            } finally {
                setIsLoading(false);
            }
        }

        loadToken();
    }, []);

    const signIn = async (token: string) => {
        try {
            await AsyncStorage.setItem('@DesperdicioZero:token', token);
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            setUserToken(token);
        } catch (error) {
            console.error('Falha ao salvar token:', error);
        }
    };

    const signOut = async () => {
        try {
            await AsyncStorage.removeItem('@DesperdicioZero:token');
            delete apiClient.defaults.headers.common['Authorization'];
            setUserToken(null);
        } catch (error) {
            console.error('Falha ao remover token:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ userToken, isLoading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
}
