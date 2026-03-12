/**
 * useLocalStorage — Kwantowy Implant Pamięci
 *
 * Drop-in replacement dla useState z automatycznym zapisem do localStorage.
 * Bezpieczny: gracefully fallback do defaultValue w trybie SSR lub przy błędzie.
 */

import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
    const [stored, setStored] = useState<T>(() => {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item) as T;
        } catch {
            return defaultValue;
        }
    });

    // Sync to localStorage on every change
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(stored));
        } catch {
            // Quota exceeded or private mode — degrade gracefully
        }
    }, [key, stored]);

    const setValue = useCallback((value: T | ((prev: T) => T)) => {
        setStored(prev => (typeof value === 'function' ? (value as (prev: T) => T)(prev) : value));
    }, []);

    return [stored, setValue];
}
