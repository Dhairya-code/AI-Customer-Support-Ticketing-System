from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

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
    allow_origins=["http://localhost:3000"],
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