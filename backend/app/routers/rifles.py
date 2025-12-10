from fastapi import APIRouter, HTTPException
from typing import List
from uuid import uuid4

from ..schemas import Rifle, RifleCreate

router = APIRouter(prefix="/rifles", tags=["rifles"])

# In-memory "database"
RIFLES_DB: dict[str, Rifle] = {}


@router.get("/", response_model=List[Rifle])
def list_rifles():
    """Return all rifles in the in-memory store."""
    return list(RIFLES_DB.values())


@router.post("/", response_model=Rifle, status_code=201)
def create_rifle(rifle_in: RifleCreate):
    """Create a new rifle profile."""
    rifle_id = str(uuid4())
    rifle = Rifle(id=rifle_id, **rifle_in.dict())
    RIFLES_DB[rifle_id] = rifle
    return rifle


@router.get("/{rifle_id}", response_model=Rifle)
def get_rifle(rifle_id: str):
    """Get a single rifle by ID."""
    rifle = RIFLES_DB.get(rifle_id)
    if not rifle:
        raise HTTPException(status_code=404, detail="Rifle not found")
    return rifle

