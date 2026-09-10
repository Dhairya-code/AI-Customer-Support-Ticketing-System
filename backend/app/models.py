from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from .database import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)

    customer_name = Column(String(100), nullable=False)
    customer_email = Column(String(150), nullable=False)

    subject = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)

    category = Column(String(50), default="Other")
    priority = Column(String(20), default="Medium")
    status = Column(String(30), default="Open")

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )