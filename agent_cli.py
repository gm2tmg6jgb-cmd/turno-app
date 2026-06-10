#!/usr/bin/env python3

"""
TurnoApp Agent - Interactive CLI
Testa l'agente direttamente da terminale senza frontend
"""

import os
import sys
from turno_app_agent_local import run_scheduling_agent

def print_banner():
    print("""
╔════════════════════════════════════════════════════════════════════╗
║       🤖 TurnoApp Scheduling Agent - Interactive CLI               ║
║                      (Versione Locale)                             ║
╚════════════════════════════════════════════════════════════════════╝
    """)

def print_help():
    print("""
COMANDI DISPONIBILI:
  help           - Mostra questa guida
  exit/quit      - Esci dall'applicazione
  examples       - Mostra query di esempio
  clear          - Pulisci lo schermo
  verbose        - Attiva/disattiva output verbose

QUERY DI ESEMPIO:
  - "Quali conflitti ci sono oggi?"
  - "Disponibilità Team 11 domani?"
  - "Tempo di setup SG2 → SG3?"
  - "Suggerisci ottimizzazioni questa settimana"
  - "Efficienza della linea 8Fe?"

Digita una domanda o un comando:
    """)

def print_examples():
    examples = [
        ("Conflitti", "Quali conflitti di scheduling ci sono il 2025-06-05?"),
        ("Disponibilità", "Quanti operatori del Team 11 SOFT sono disponibili il 2025-06-06?"),
        ("Setup time", "Quanto tempo per cambio da SG2 a SG3 sulla linea SOFT?"),
        ("Produzione", "Qual è il piano di produzione dal 2025-06-05 al 2025-06-07?"),
        ("Ottimizzazione", "Suggerisci ottimizzazioni sulla riduzione dei changeover questa settimana"),
        ("Macchine", "Qual è l'efficienza della linea DCTeco?"),
    ]
    print("\n📚 QUERY DI ESEMPIO:\n")
    for title, query in examples:
        print(f"  [{title}]")
        print(f"  → {query}\n")

def main():
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ERRORE: ANTHROPIC_API_KEY non configurata")
        print("\nPer configurare:")
        print("  export ANTHROPIC_API_KEY='your-api-key'")
        sys.exit(1)
    
    print_banner()
    print("✅ API Key configurata")
    print("\nDigita 'help' per le istruzioni, 'examples' per query di esempio\n")
    
    verbose = False
    
    while True:
        try:
            user_input = input("🤔 Domanda: ").strip()
            
            if not user_input:
                continue
            
            if user_input.lower() == "exit" or user_input.lower() == "quit":
                print("\n👋 Arrivederci!")
                break
            
            elif user_input.lower() == "help":
                print_help()
            
            elif user_input.lower() == "examples":
                print_examples()
            
            elif user_input.lower() == "clear":
                os.system("clear" if os.name == "posix" else "cls")
                print_banner()
            
            elif user_input.lower() == "verbose":
                verbose = not verbose
                status = "🔊 ATTIVO" if verbose else "🔇 DISATTIVO"
                print(f"\n📊 Modalità verbose: {status}\n")
            
            else:
                print("\n⏳ Elaborando...\n")
                result = run_scheduling_agent(user_input, verbose=verbose)
                print("\n" + "="*70)
                print(result)
                print("="*70 + "\n")
        
        except KeyboardInterrupt:
            print("\n\n👋 Interruzione utente. Arrivederci!")
            break
        
        except Exception as e:
            print(f"\n❌ Errore: {str(e)}\n")

if __name__ == "__main__":
    main()
