from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TicketCreate(BaseModel):
    customer_name: str
    customer_email: str
    subject: str
    message: str


class TicketResponse(BaseModel):
    id: int
    customer_name: str
    customer_email: str
    subject: str
    message: str
    category: str
    priority: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)