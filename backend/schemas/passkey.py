from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class PasskeyOut(BaseModel):
    id: int
    nome: str
    created_at: datetime
    last_used_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PasskeyOptionsOut(BaseModel):
    """Le opzioni da passare a `navigator.credentials.create/get` (formato JSON
    di WebAuthn, quello che `@simplewebauthn/browser` si aspetta)."""

    options: dict[str, Any]


class PasskeyRegisterVerify(BaseModel):
    # La risposta del browser così com'è (RegistrationResponseJSON).
    credential: dict[str, Any]
    nome: Optional[str] = Field(None, max_length=60)


class PasskeyLoginVerify(BaseModel):
    # AuthenticationResponseJSON.
    credential: dict[str, Any]
