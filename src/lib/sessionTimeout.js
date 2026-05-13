import { useEffect, useRef } from 'react';

/**
 * Hook per auto-logout dopo N minuti di inattività
 * @param {number} minutesBeforeTimeout - minuti di inattività prima di logout (default 15)
 * @param {function} onTimeout - callback da eseguire al timeout (es. logout)
 */
export function useSessionTimeout(minutesBeforeTimeout = 15, onTimeout) {
    const timeoutRef = useRef(null);
    const warningTimeoutRef = useRef(null);

    const resetTimer = () => {
        // Cancella timer precedenti
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

        // Timer per il timeout effettivo
        timeoutRef.current = setTimeout(() => {
            if (onTimeout) onTimeout();
        }, minutesBeforeTimeout * 60 * 1000);
    };

    useEffect(() => {
        // Definisci gli eventi che resettano il timer
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

        // Aggiungi listener per ogni evento
        events.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        // Avvia il timer inizialmente
        resetTimer();

        // Cleanup
        return () => {
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        };
    }, [onTimeout, minutesBeforeTimeout]);
}
