# TurnoApp - Gestione Personale e Turni

## Descrizione
TurnoApp è un'applicazione web sviluppata per gestire i turni del personale in uno stabilimento produttivo. Permette di visualizzare le presenze, gestire le rotazioni dei turni, assegnare il personale alle macchine e monitorare le competenze.

## Funzionalità Principali
- **Dashboard Turni**: Visualizzazione dinamica dei turni (A, B, C, D) con rotazione automatica.
- **Gestione Personale**: Anagrafica dipendenti con dettagli su reparto e skills.
- **Pianificazione**: Calendario mensile per la gestione delle presenze e assenze.
- **Assegnazione Macchine**: Associazione rapida tra operatori e macchinari.
- **Reportistica**: Esportazione dati e statistiche di presenza.

## Stack Tecnologico
- **Frontend**: React + Vite
- **Styling**: CSS Modules / Vanilla CSS (Design Responsivo)
- **Backend/Database**: integrazione con Supabase
- **Language**: JavaScript (ES6+)

## Installazione
1. Clona il repository:
   ```bash
   git clone https://github.com/TuoNomeUtente/turno-app.git
   ```
2. Installa le dipendenze:
   ```bash
   npm install
   ```
3. Configura le variabili d'ambiente in `.env`:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_key
   ```
4. Avvia il server di sviluppo:
   ```bash
   npm run dev
   ```

## Struttura del Progetto
- `/src/components`: Componenti UI riutilizzabili.
- `/src/lib`: Logica di business (es. rotazione turni, Supabase client).
- `/src/views`: Pagine principali dell'applicazione.
- `/src/data`: Costanti e dati statici di configurazione.

## Contribuire
Le Pull Request sono benvenute. Per modifiche importanti, apri prima una issue per discutere cosa vorresti cambiare.

## Licenza
[MIT](https://choosealicense.com/licenses/mit/)
