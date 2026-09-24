import sqlite3
from pydantic import BaseModel
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi import FastAPI, HTTPException

from .database import Base, engine, get_db
from .models import Ticket
from .schemas import TicketCreate, TicketResponse


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Customer Support API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "AI Customer Support API is running"
    }


@app.post("/tickets", response_model=TicketResponse)
def create_ticket(
    ticket: TicketCreate,
    db: Session = Depends(get_db),
):
    new_ticket = Ticket(
        customer_name=ticket.customer_name,
        customer_email=ticket.customer_email,
        subject=ticket.subject,
        message=ticket.message,
    )

    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    return new_ticket


@app.get("/tickets", response_model=list[TicketResponse])
def get_tickets(
    db: Session = Depends(get_db),
):
    return (
        db.query(Ticket)
        .order_by(Ticket.id.desc())
        .all()
    )

@app.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: int):
    conn = sqlite3.connect("support.db")
    conn.row_factory = sqlite3.Row

    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM tickets WHERE id = ?",
        (ticket_id,)
    )

    ticket = cursor.fetchone()
    conn.close()

    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found"
        )

    return dict(ticket)
class TicketUpdate(BaseModel):
    status: str


@app.patch("/tickets/{ticket_id}")
def update_ticket(ticket_id: int, ticket: TicketUpdate):
    allowed_statuses = ["Open", "In Progress", "Resolved"]

    if ticket.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Use Open, In Progress, or Resolved."
        )

    conn = sqlite3.connect("support.db")
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE tickets SET status = ? WHERE id = ?",
        (ticket.status, ticket_id)
    )

    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Ticket not found")

    conn.commit()
    conn.close()

    return {
        "message": "Ticket status updated successfully",
        "ticket_id": ticket_id,
        "status": ticket.status
    }
class TicketEscalation(BaseModel):
    reason: str


@app.post("/tickets/{ticket_id}/escalate")
def escalate_ticket(ticket_id: int, escalation: TicketEscalation):
    conn = sqlite3.connect("support.db")
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE tickets
        SET escalated = 1,
            escalation_reason = ?
        WHERE id = ?
        """,
        (escalation.reason, ticket_id)
    )

    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Ticket not found")

    conn.commit()
    conn.close()

    return {
        "message": "Ticket escalated to human successfully",
        "ticket_id": ticket_id,
        "escalated": True,
        "reason": escalation.reason
    }