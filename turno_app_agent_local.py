"""
TurnoApp Scheduling Agent - Versione LOCAL con dati mock
"""
import json
from datetime import datetime, timedelta
from anthropic import Anthropic
from typing import Optional

client = Anthropic()

MOCK_DATA = {
    "teams": {
        "team_11_soft": {
            "name": "Team 11 SOFT",
            "supervisor": "Cianci",
            "operatori": ["OP001", "OP002", "OP003", "OP004", "OP005", "OP006"],
            "machines": ["SOFT-001", "SOFT-002", "SOFT-003"]
        },
        "team_12_hard": {
            "name": "Team 12 HARD",
            "supervisor": "Cappelluti",
            "operatori": ["OP007", "OP008", "OP009", "OP010", "OP011", "OP012"],
            "machines": ["HARD-001", "HARD-002", "HARD-003"]
        },
        "team_13_rg": {
            "name": "Team 13 RG+DH",
            "supervisor": "Ferrandes",
            "operatori": ["OP013", "OP014", "OP015", "OP016", "OP017", "OP018"],
            "machines": ["RG-001", "RG-002", "DH-001"]
        }
    },
    "components": {
        "SG2": {"line": "DCTeco", "section": "SOFT", "material": "M0153389", "jph": 120},
        "SG3": {"line": "DCTeco", "section": "SOFT", "material": "M0153401", "jph": 115},
        "SG4": {"line": "DCT300", "section": "HARD", "material": "M0153450", "jph": 95},
        "SG5": {"line": "DCT300", "section": "HARD", "material": "M0153460", "jph": 98},
        "SGR": {"line": "8Fe", "section": "RG/DH", "material": "M0153500", "jph": 110},
        "RG": {"line": "8Fe", "section": "RG/DH", "material": "M0153510", "jph": 105}
    },
    "setup_times": {
        ("SG2", "SG3", "SOFT"): 15,
        ("SG3", "SG2", "SOFT"): 15,
        ("SG4", "SG5", "HARD"): 20,
        ("SG5", "SG4", "HARD"): 20,
        ("SGR", "RG", "RG/DH"): 10,
        ("RG", "SGR", "RG/DH"): 10,
    },
    "shifts": {
        "A": {"start": "06:00", "end": "12:00", "duration": 6},
        "B": {"start": "12:00", "end": "18:00", "duration": 6},
        "C": {"start": "18:00", "end": "00:00", "duration": 6},
        "D": {"start": "00:00", "end": "06:00", "duration": 6},
    }
}

MOCK_SCHEDULE = {
    "2025-06-05": [
        {"id": "P001", "team_id": "team_11_soft", "operatore": "OP001", "turno": "A", "componente": "SG2", "macchinario": "SOFT-001", "quantita": 500},
        {"id": "P002", "team_id": "team_11_soft", "operatore": "OP002", "turno": "A", "componente": "SG3", "macchinario": "SOFT-002", "quantita": 480},
        {"id": "P003", "team_id": "team_12_hard", "operatore": "OP007", "turno": "B", "componente": "SG4", "macchinario": "HARD-001", "quantita": 420},
        {"id": "P004", "team_id": "team_13_rg", "operatore": "OP013", "turno": "C", "componente": "SGR", "macchinario": "RG-001", "quantita": 440},
    ],
    "2025-06-06": [
        {"id": "P005", "team_id": "team_11_soft", "operatore": "OP003", "turno": "A", "componente": "SG2", "macchinario": "SOFT-001", "quantita": 510},
        {"id": "P006", "team_id": "team_11_soft", "operatore": "OP004", "turno": "B", "componente": "SG3", "macchinario": "SOFT-002", "quantita": 490},
        {"id": "P007", "team_id": "team_12_hard", "operatore": "OP008", "turno": "A", "componente": "SG5", "macchinario": "HARD-002", "quantita": 410},
        {"id": "P008", "team_id": "team_13_rg", "operatore": "OP014", "turno": "B", "componente": "RG", "macchinario": "RG-002", "quantita": 450},
    ],
    "2025-06-07": [
        {"id": "P009", "team_id": "team_11_soft", "operatore": "OP001", "turno": "A", "componente": "SG2", "macchinario": "SOFT-001", "quantita": 520},
        {"id": "P010", "team_id": "team_11_soft", "operatore": "OP005", "turno": "C", "componente": "SG3", "macchinario": "SOFT-002", "quantita": 485},
    ]
}

def get_scheduling_conflicts(date: str) -> dict:
    if date not in MOCK_SCHEDULE:
        return {"data": date, "total_shifts": 0, "conflicts": [], "status": "no_schedule"}
    shifts = MOCK_SCHEDULE[date]
    conflicts = []
    if date == "2025-06-05":
        conflicts.append({
            "type": "short_changeover",
            "from": "SG2",
            "to": "SG3",
            "machine": "SOFT-001",
            "available_time_minutes": 8,
            "required_time_minutes": 15,
            "severity": "high",
            "message": "Cambio SG2→SG3 troppo veloce (8 min vs 15 req)"
        })
    return {
        "data": date,
        "total_shifts": len(shifts),
        "conflicts": conflicts,
        "status": "clean" if not conflicts else "conflicts_detected",
        "summary": f"{len(shifts)} shift pianificati, {len(conflicts)} conflitti"
    }

def get_team_availability(team_id: str, date: str) -> dict:
    team_info = MOCK_DATA["teams"].get(team_id, {})
    if date not in MOCK_SCHEDULE:
        return {
            "team_id": team_id,
            "team_name": team_info.get("name", "Unknown"),
            "data": date,
            "turni_assegnati": 0,
            "operatori_totali": len(team_info.get("operatori", [])),
            "operatori_disponibili": len(team_info.get("operatori", [])),
            "dettagli": []
        }
    shifts_for_team = [s for s in MOCK_SCHEDULE[date] if s["team_id"] == team_id]
    operatori_assegnati = set([s["operatore"] for s in shifts_for_team])
    return {
        "team_id": team_id,
        "team_name": team_info.get("name", "Unknown"),
        "supervisor": team_info.get("supervisor", "N/A"),
        "data": date,
        "turni_assegnati": len(shifts_for_team),
        "operatori_totali": len(team_info.get("operatori", [])),
        "operatori_disponibili": len(team_info.get("operatori", [])) - len(operatori_assegnati),
        "operatori_assegnati": list(operatori_assegnati),
        "turni_dettagli": shifts_for_team
    }

def get_component_setup_time(from_component: str, to_component: str, machine_type: str) -> dict:
    key = (from_component, to_component, machine_type)
    time_minutes = MOCK_DATA["setup_times"].get(key, 25)
    from_info = MOCK_DATA["components"].get(from_component, {})
    to_info = MOCK_DATA["components"].get(to_component, {})
    return {
        "from_component": from_component,
        "from_jph": from_info.get("jph", 0),
        "to_component": to_component,
        "to_jph": to_info.get("jph", 0),
        "machine_type": machine_type,
        "setup_time_minutes": time_minutes,
        "estimated_loss_pieces": round((time_minutes / 60) * from_info.get("jph", 100)),
        "efficiency_impact": f"-{round((time_minutes / 360) * 100, 1)}% per turno"
    }

def get_production_plan(start_date: str, end_date: str, component: Optional[str] = None) -> dict:
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    plan = []
    current = start
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        if date_str in MOCK_SCHEDULE:
            shifts = MOCK_SCHEDULE[date_str]
            if component:
                shifts = [s for s in shifts if s["componente"] == component]
            plan.extend(shifts)
        current += timedelta(days=1)
    by_component = {}
    for shift in plan:
        comp = shift["componente"]
        if comp not in by_component:
            by_component[comp] = {"count": 0, "total_qty": 0}
        by_component[comp]["count"] += 1
        by_component[comp]["total_qty"] += shift["quantita"]
    return {
        "start_date": start_date,
        "end_date": end_date,
        "component_filter": component,
        "giorni_pianificati": (end - start).days + 1,
        "total_shifts": len(plan),
        "by_component": by_component,
        "shifts_sample": plan[:5]
    }

def suggest_scheduling_optimization(focus_area: str, date_range: str) -> dict:
    suggestions = {
        "team_balance": ["Team 11 ha 1 operatore in meno", "Suggerisci overtime per Team 11", "Aumenta SOFT-003"],
        "changeover_reduction": ["Raggruppa SG2/SG3 consecutivi", "Perdi ~45 min/giorno", "Risparmio: 2-3 ore/week"],
        "deadline_risk": ["Nessun rischio deadline", "Team 13 ha 15% buffer"],
        "all": ["Bilancia carichi", "Riduci changeover", "Monitora deadline", "Aumenta utilizzo", "Ottimizza rotazione"]
    }
    selected = suggestions.get(focus_area, suggestions["all"])
    return {
        "focus_area": focus_area,
        "date_range": date_range,
        "recommendations": selected,
        "estimated_improvement": "10-15% efficienza"
    }

def get_machine_utilization(line: str, start_date: str, end_date: str) -> dict:
    utilizations = {
        "8Fe": {"machines": ["RG-001", "RG-002", "DH-001"], "average_efficiency": 0.78, "total_jph": 215, "changeover_losses": "3.2 hours/day"},
        "DCT300": {"machines": ["HARD-001", "HARD-002", "HARD-003"], "average_efficiency": 0.81, "total_jph": 285, "changeover_losses": "2.1 hours/day"},
        "DCTeco": {"machines": ["SOFT-001", "SOFT-002", "SOFT-003"], "average_efficiency": 0.76, "total_jph": 235, "changeover_losses": "2.8 hours/day"}
    }
    util = utilizations.get(line, utilizations["DCTeco"])
    return {
        "line": line,
        "period": f"{start_date} to {end_date}",
        "machines": util["machines"],
        "average_efficiency": util["average_efficiency"],
        "total_jph": util["total_jph"],
        "changeover_losses": util["changeover_losses"],
        "insights": f"Potenziale +{round((1 - util['average_efficiency']) * 100)}% efficiency",
        "recommendation": "Raggruppare componenti simili"
    }

TOOLS = [
    {"name": "get_scheduling_conflicts", "description": "Recupera conflitti scheduling", "input_schema": {"type": "object", "properties": {"date": {"type": "string", "description": "Data YYYY-MM-DD"}}, "required": ["date"]}},
    {"name": "get_team_availability", "description": "Disponibilità team", "input_schema": {"type": "object", "properties": {"team_id": {"type": "string"}, "date": {"type": "string"}}, "required": ["team_id", "date"]}},
    {"name": "get_component_setup_time", "description": "Setup time", "input_schema": {"type": "object", "properties": {"from_component": {"type": "string"}, "to_component": {"type": "string"}, "machine_type": {"type": "string"}}, "required": ["from_component", "to_component", "machine_type"]}},
    {"name": "get_production_plan", "description": "Piano produzione", "input_schema": {"type": "object", "properties": {"start_date": {"type": "string"}, "end_date": {"type": "string"}, "component": {"type": "string"}}, "required": ["start_date", "end_date"]}},
    {"name": "suggest_scheduling_optimization", "description": "Ottimizzazioni", "input_schema": {"type": "object", "properties": {"focus_area": {"type": "string"}, "date_range": {"type": "string"}}, "required": ["focus_area", "date_range"]}},
    {"name": "get_machine_utilization", "description": "Utilizzo macchine", "input_schema": {"type": "object", "properties": {"line": {"type": "string"}, "start_date": {"type": "string"}, "end_date": {"type": "string"}}, "required": ["line", "start_date", "end_date"]}}
]

def process_tool_call(tool_name: str, tool_input: dict) -> str:
    if tool_name == "get_scheduling_conflicts":
        result = get_scheduling_conflicts(tool_input["date"])
    elif tool_name == "get_team_availability":
        result = get_team_availability(tool_input["team_id"], tool_input["date"])
    elif tool_name == "get_component_setup_time":
        result = get_component_setup_time(tool_input["from_component"], tool_input["to_component"], tool_input["machine_type"])
    elif tool_name == "get_production_plan":
        result = get_production_plan(tool_input["start_date"], tool_input["end_date"], tool_input.get("component"))
    elif tool_name == "suggest_scheduling_optimization":
        result = suggest_scheduling_optimization(tool_input["focus_area"], tool_input["date_range"])
    elif tool_name == "get_machine_utilization":
        result = get_machine_utilization(tool_input["line"], tool_input["start_date"], tool_input["end_date"])
    else:
        result = {"error": f"Tool {tool_name} not found"}
    return json.dumps(result)

def run_scheduling_agent(user_query: str, verbose: bool = False) -> str:
    if verbose:
        print(f"\n{'='*70}\nQUERY: {user_query}\n{'='*70}")
    messages = [{"role": "user", "content": user_query}]
    system_prompt = """Tu sei un esperto di scheduling per BAP Magna PT.
Conosci: 3 linee (8Fe, DCT300, DCTeco), 3 team (Team 11 SOFT, Team 12 HARD, Team 13 RG+DH), 36 operatori, componenti SG2-5/SGR/RG.
Usa i tool per analizzare dati. Rispondi in ITALIANO con dati concreti."""
    
    iteration = 0
    max_iterations = 10
    
    while iteration < max_iterations:
        iteration += 1
        if verbose:
            print(f"\n[ITERATION {iteration}]")
        response = client.messages.create(
            model="claude-opus-4-8",
             max_tokens=2000,
            system=system_prompt,
            tools=TOOLS,
            messages=messages
        )
        messages.append({"role": "assistant", "content": response.content})
        if verbose:
            print(f"Stop reason: {response.stop_reason}")
        if response.stop_reason == "end_turn":
            final_text = ""
            for block in response.content:
                if hasattr(block, "text"):
                    final_text += block.text
            if verbose:
                print(f"\n{'='*70}\nRISPOSTA FINALE:\n{'='*70}")
            return final_text
        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    tool_name = block.name
                    tool_input = block.input
                    if verbose:
                        print(f"\n  Tool: {tool_name}\n  Input: {json.dumps(tool_input, indent=2)}")
                    result = process_tool_call(tool_name, tool_input)
                    if verbose:
                        result_dict = json.loads(result)
                        print(f"  Result: {json.dumps(result_dict, indent=2)[:200]}...")
                    tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": result})
            messages.append({"role": "user", "content": tool_results})
        else:
            if verbose:
                print(f"Unknown stop reason: {response.stop_reason}")
            break
    
    return "Agente completato senza risultati finali"

if __name__ == "__main__":
    import sys
    test_queries = [
        "Quali conflitti di scheduling ci sono oggi (2025-06-05)?",
        "Quanti operatori del Team 11 SOFT sono disponibili domani?",
        "Quanto tempo ci vuole per cambiare da SG2 a SG3 sulla linea SOFT?",
        "Suggerisci ottimizzazioni per questa settimana",
        "Qual è l'efficienza della linea DCTeco?"
    ]
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
    else:
        query = test_queries[0]
    print(f"\n🤖 TurnoApp Scheduling Agent - Local Version\nQuery: {query}\n")
    result = run_scheduling_agent(query, verbose=True)
    print(f"\n{result}")
