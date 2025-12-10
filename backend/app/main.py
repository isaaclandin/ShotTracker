from fastapi import FastAPI
from .schemas import ShotCalculationRequest, ShotCalculationResponse
from app.routers import rifles
from .ballistics import compute_drop, compute_wind_drift

app = FastAPI(title="ShotTracker Ballistics API - Phase 1")

app.include_router(rifles.router)

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/calculate", response_model=ShotCalculationResponse)
def calculate_shot(data: ShotCalculationRequest):
    drop = compute_drop(
        distance_yards=data.distance_yards,
        muzzle_velocity_fps=data.rifle.muzzle_velocity_fps,
        zero_yards=data.rifle.zero_yards,
    )

    drift = compute_wind_drift(
        distance_yards=data.distance_yards,
        muzzle_velocity_fps=data.rifle.muzzle_velocity_fps,
        wind_speed_mph=data.wind_speed_mph,
        wind_angle_deg=data.wind_angle_deg,
    )

    return ShotCalculationResponse(
        distance_yards=data.distance_yards,
        wind_speed_mph=data.wind_speed_mph,
        wind_angle_deg=data.wind_angle_deg,
        drop_inches=drop["drop_inches"],
        drop_moa=drop["drop_moa"],
        drift_inches=drift["drift_inches"],
        drift_moa=drift["drift_moa"],
    )

