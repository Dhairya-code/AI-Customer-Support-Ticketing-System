import os
from typing import Literal

from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel, Field

load_dotenv()


class TicketClassification(BaseModel):
    category: Literal[
        "Payment",
        "Order",
        "Delivery",
        "Account",
        "Technical",
        "Refund",
        "Other",
    ] = Field(description="The main category of the customer support issue.")

    priority: Literal[
        "Low",
        "Medium",
        "High",
        "Critical",
    ] = Field(description="The urgency of the customer support issue.")

    confidence: float = Field(
        description="Confidence score between 0 and 1.",
        ge=0,
        le=1,
    )


api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError("GEMINI_API_KEY is not configured.")

client = genai.Client(api_key=api_key)


def classify_ticket(message: str) -> TicketClassification:
    prompt = f"""
You are an AI customer support ticket classifier.

Analyze the customer's support request.

Choose exactly one category:
- Payment
- Order
- Delivery
- Account
- Technical
- Refund
- Other

Choose exactly one priority:
- Low
- Medium
- High
- Critical

Priority guidelines:

Low:
General questions or minor issues that do not require urgent attention.

Medium:
A normal customer issue that needs support but is not urgent.

High:
Important issues involving payment problems, failed transactions,
significant service problems, or issues that may seriously affect the customer.

Critical:
Severe incidents involving major financial/security concerns,
account compromise, or situations requiring immediate human attention.

Return a confidence score between 0 and 1.

Do not invent information.

Customer message:
{message}
"""

    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": TicketClassification,
        },
    )

    return TicketClassification.model_validate_json(response.text)