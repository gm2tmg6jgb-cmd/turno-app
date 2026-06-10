"""
FastAPI endpoint per TurnoApp Scheduling Agent
Versione LOCAL - nessuna dipendenza esterna
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from turno_app_agent_local import run_scheduling_agent
import logging

app = FastAPI(title="TurnoApp Scheduling Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger(__name__)

class SchedulingQuery(BaseModel):
    query: str
    context: dict = {}

class SchedulingResponse(BaseModel):
    response: str
    status: str = "success"

@app.post("/api/agent/ask")
async def ask_scheduling_agent(request: SchedulingQuery) -> SchedulingResponse:
    try:
        if not request.query or len(request.query.strip()) < 5:
            raise HTTPException(status_code=400, detail="Query troppo corta o vuota")
        response = run_scheduling_agent(request.query, verbose=False)
        return SchedulingResponse(response=response, status="success")
    except Exception as e:
        logger.error(f"Agent error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Errore agente: {str(e)}")

@app.get("/api/agent/health")
async def health_check():
    return {"status": "healthy", "agent": "turnoapp-scheduling", "version": "1.0.0"}

@app.get("/api/agent/capabilities")
async def list_capabilities():
    return {
        "capabilities": [
            "Analizzare conflitti di scheduling",
            "Controllare disponibilità operatori",
            "Calcolare tempi di changeover",
            "Suggerire ottimizzazioni di produzione",
            "Analizzare utilizzo macchine",
            "Fornire insights su efficienza linee"
        ],
        "supported_queries": [
            "Conflitti per una data specifica",
            "Disponibilità team",
            "Tempi di setup tra componenti",
            "Piano di produzione",
            "Suggerimenti di ottimizzazione",
            "Utilizza macchine"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
