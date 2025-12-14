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
    Improved wind drift model using velocity-dependent formula.
    - Compute crosswind component based on wind_angle_deg (0 = head/tail, 90 = full crosswind).
    - Uses simplified formula: drift ≈ (wind_speed × distance² × wind_value) / velocity_factor
    - Velocity factor accounts for faster bullets being less affected by wind.
    Returns drift in inches & MOA, with sign convention: positive = right, negative = left.
    """
    theta_rad = math.radians(wind_angle_deg)
    
    # Crosswind component (wind value: 0 = no effect, 1.0 = full crosswind)
    wind_value = abs(math.sin(theta_rad))
    
    # Wind direction sign: positive = wind from left (pushes bullet right), negative = wind from right
    wind_direction = 1.0 if math.sin(theta_rad) >= 0 else -1.0
    
    # Improved wind drift formula using velocity-scaled approximation
    # Formula calibrated to match typical rifle ballistics
    # For reference: .308 @ 2700 fps, 10 mph crosswind @ 300yd ≈ 15-16 inches drift
    
    # Distance in hundreds of yards (for distance squared relationship)
    distance_hundreds = distance_yards / 100.0
    
    # Velocity scaling factor: faster bullets drift less
    # Using inverse relationship: drift ∝ 1/velocity^0.8 (approximate)
    velocity_normalized = muzzle_velocity_fps / 2700.0  # Normalize to typical 2700 fps
    velocity_factor = velocity_normalized ** 0.8
    
    # Base wind drift formula: wind_speed × distance² × wind_value × base_constant / velocity_factor
    # Base constant calibrated to give ~15 inches at 10 mph crosswind, 300yd, 2700 fps
    # 15 = (10 × 3² × 1.0 × base_constant) / 1.0 → base_constant = 15/90 = 0.167
    base_constant = 0.167
    
    # Wind drift increases with square of distance and wind speed
    drift_inches = (wind_speed_mph * (distance_hundreds ** 2) * wind_value * base_constant) / velocity_factor
    
    # Apply wind direction
    drift_inches = drift_inches * wind_direction

    # Convert inches to MOA at given distance
    moa_per_inch_at_100 = 1 / 1.047
    distance_factor = distance_yards / 100.0
    drift_moa = drift_inches * moa_per_inch_at_100 / distance_factor

    return {
        "drift_inches": drift_inches,
        "drift_moa": drift_moa
    }

