import math

G = 9.81  # m/s^2
YARDS_TO_METERS = 0.9144
FPS_TO_MPS = 0.3048
MPH_TO_MPS = 0.44704
INCHES_PER_METER = 39.3701

def compute_time_of_flight(distance_yards: float, muzzle_velocity_fps: float) -> float:
    """
    Very simple time-of-flight approximation ignoring drag.
    distance in yards, velocity in feet per second.
    Returns time in seconds.
    """
    distance_m = distance_yards * YARDS_TO_METERS
    velocity_mps = muzzle_velocity_fps * FPS_TO_MPS
    if velocity_mps <= 0:
        raise ValueError("Muzzle velocity must be > 0")
    return distance_m / velocity_mps


def compute_drop(distance_yards: float, muzzle_velocity_fps: float, zero_yards: float) -> dict:
    """
    Compute bullet drop (inches & MOA) at distance_yards relative to zero range.
    Very simplified: assumes zero = no drop at zero_yards.
    """
    # Time to zero and to target
    t_zero = compute_time_of_flight(zero_yards, muzzle_velocity_fps)
    t_target = compute_time_of_flight(distance_yards, muzzle_velocity_fps)

    # Drop from gravity: d = 0.5 * g * t^2
    drop_zero_m = 0.5 * G * t_zero**2
    drop_target_m = 0.5 * G * t_target**2

    # Relative drop (how much lower at target vs zero)
    relative_drop_m = drop_target_m - drop_zero_m
    drop_inches = relative_drop_m * INCHES_PER_METER

    # Convert inches to MOA at given distance
    # 1 MOA ≈ 1.047 inches at 100 yards
    moa_per_inch_at_100 = 1 / 1.047
    distance_factor = distance_yards / 100.0
    moa = drop_inches * moa_per_inch_at_100 / distance_factor

    return {
        "drop_inches": drop_inches,
        "drop_moa": moa
    }


def compute_wind_drift(
    distance_yards: float,
    muzzle_velocity_fps: float,
    wind_speed_mph: float,
    wind_angle_deg: float
) -> dict:
    """
    Very simple wind drift model:
    - Compute crosswind component based on wind_angle_deg (0 = head/tail, 90 = full crosswind).
    - Assume drift ≈ crosswind_speed * time_of_flight (ignores drag & bullet slowdown).
    Returns drift in inches & MOA, with sign convention: positive = right, negative = left.
    """
    t = compute_time_of_flight(distance_yards, muzzle_velocity_fps)

    # Wind components
    wind_speed_mps = wind_speed_mph * MPH_TO_MPS
    theta_rad = math.radians(wind_angle_deg)

    # Crosswind component (perpendicular to bullet path)
    crosswind_mps = wind_speed_mps * math.sin(theta_rad)

    # Drift ≈ crosswind_speed * time_of_flight
    drift_m = crosswind_mps * t
    drift_inches = drift_m * INCHES_PER_METER

    # Convert inches to MOA at distance
    moa_per_inch_at_100 = 1 / 1.047
    distance_factor = distance_yards / 100.0
    drift_moa = drift_inches * moa_per_inch_at_100 / distance_factor

    return {
        "drift_inches": drift_inches,
        "drift_moa": drift_moa
    }

