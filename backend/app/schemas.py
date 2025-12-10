from pydantic import BaseModel, Field
from typing import Optional


class RifleBase(BaseModel):
    name: str = Field(..., example="6.5 CM - 143gr ELD-X")
    zero_yards: float = Field(..., example=200)
    muzzle_velocity_fps: float = Field(..., example=2700)


class RifleCreate(RifleBase):
    """Payload for creating a rifle."""
    pass


class Rifle(RifleBase):
    """Rifle as returned from the API, with an ID."""
    id: str = Field(..., example="rifle_1")


class ShotCalculationRequest(BaseModel):
    distance_yards: float = Field(..., example=300)
    wind_speed_mph: float = Field(..., example=12)
    wind_angle_deg: float = Field(
        ...,
        example=90,
        description="Angle between shot direction and wind (90 = full crosswind)"
    )
    rifle: RifleBase  # notice: we don't need the rifle ID here, just its ballistics


class ShotCalculationResponse(BaseModel):
    distance_yards: float
    wind_speed_mph: float
    wind_angle_deg: float

    drop_inches: float
    drop_moa: float
    drift_inches: float
    drift_moa: float

