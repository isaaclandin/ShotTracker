import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import * as Location from "expo-location";

const BACKEND_URL = "http://127.0.0.1:8000";

type Rifle = {
  id: string;
  name: string;
  zero_yards: number;
  muzzle_velocity_fps: number;
};

type ShotResult = {
  distance_yards: number;
  wind_speed_mph: number;
  wind_angle_deg: number;
  drop_inches: number;
  drop_moa: number;
  drift_inches: number;
  drift_moa: number;
};

// Crosshair component to visualize aim adjustments
interface CrosshairProps {
  dropMoa: number;
  driftMoa: number;
  dropInches: number;
  driftInches: number;
  distanceYards: number;
}

const CROSSHAIR_SIZE = 300;
const MOA_SCALE = 20; // pixels per MOA for visualization
// 1 MIL = 3.437746770784928 MOA (exact conversion)
const MIL_TO_MOA = 3.437746770784928;
const MIL_SCALE = MOA_SCALE * MIL_TO_MOA; // pixels per MIL (~68.75 pixels per MIL)

// Helper function to convert inches to feet and inches format (rounded to nearest inch)
function formatFeetInches(inches: number): string {
  if (inches === undefined || inches === null || isNaN(inches)) {
    return "0\"";
  }
  // Round to nearest inch
  const roundedInches = Math.round(inches);
  const feet = Math.floor(Math.abs(roundedInches) / 12);
  const remainingInches = Math.abs(roundedInches) % 12;
  const sign = roundedInches < 0 ? "-" : "";
  
  if (feet === 0) {
    return `${sign}${remainingInches}"`;
  } else {
    return `${sign}${feet}' ${remainingInches}"`;
  }
}

function CrosshairDisplay({
  dropMoa,
  driftMoa,
  dropInches,
  driftInches,
  distanceYards,
}: CrosshairProps) {
  // Convert MOA to pixels (1 MOA = ~1 inch at 100 yards, scaled for visualization)
  // dropMoa positive = bullet drops MORE (hits lower), so we need to aim HIGHER to compensate
  // driftMoa positive = bullet drifts RIGHT, so we need to aim LEFT to compensate
  // For drop: put mark BELOW center, so when you put mark on target, center is above (aiming high)
  // For drift: put mark LEFT of center, so when you put mark on target, center is right (aiming left)
  const dropPixels = dropMoa * MOA_SCALE; // Positive = below center (compensates for drop)
  const driftPixels = -driftMoa * MOA_SCALE; // Negative = left of center (compensates for right drift)
  
  // Clamp values to keep within reasonable bounds
  const maxOffset = CROSSHAIR_SIZE * 0.35;
  const clampedDropPixels = Math.max(-maxOffset, Math.min(maxOffset, dropPixels));
  const clampedDriftPixels = Math.max(-maxOffset, Math.min(maxOffset, driftPixels));

  return (
    <View style={crosshairStyles.container}>
      <Text style={crosshairStyles.title}>Aiming Reticle</Text>
      <View style={crosshairStyles.crosshairWrapper}>
        {/* Container that allows aim point to extend beyond circle */}
        <View style={crosshairStyles.crosshairContainer}>
          {/* Crosshair background circle */}
          <View style={crosshairStyles.circle}>
            {/* Main horizontal line (thick) */}
            <View style={[crosshairStyles.mainLine, crosshairStyles.horizontalLine]} />
            {/* Main vertical line (thick) */}
            <View style={[crosshairStyles.mainLine, crosshairStyles.verticalLine]} />
            
            {/* MIL hash marks on horizontal line (extend vertically from horizontal line) */}
            {[1, 2, 3].map((mil) => {
              const hashHeight = mil === 1 ? 8 : mil === 2 ? 10 : 12;
              return (
                <React.Fragment key={`h-${mil}`}>
                  {/* Right side hash marks */}
                  <View
                    style={[
                      crosshairStyles.milHash,
                      crosshairStyles.horizontalMilHash,
                      {
                        left: CROSSHAIR_SIZE / 2 + mil * MIL_SCALE - 0.5,
                        top: CROSSHAIR_SIZE / 2 - hashHeight / 2,
                        height: hashHeight,
                        width: 1,
                      },
                    ]}
                  />
                  {/* Left side hash marks */}
                  <View
                    style={[
                      crosshairStyles.milHash,
                      crosshairStyles.horizontalMilHash,
                      {
                        left: CROSSHAIR_SIZE / 2 - mil * MIL_SCALE - 0.5,
                        top: CROSSHAIR_SIZE / 2 - hashHeight / 2,
                        height: hashHeight,
                        width: 1,
                      },
                    ]}
                  />
                </React.Fragment>
              );
            })}
            
            {/* MIL hash marks on vertical line (extend horizontally from vertical line, primarily below for drop) */}
            {[1, 2, 3, 4, 5].map((mil) => {
              const hashWidth = mil === 1 ? 8 : mil <= 2 ? 10 : 12;
              return (
                <React.Fragment key={`v-${mil}`}>
                  {/* Below center (drop direction) */}
                  <View
                    style={[
                      crosshairStyles.milHash,
                      crosshairStyles.verticalMilHash,
                      {
                        top: CROSSHAIR_SIZE / 2 + mil * MIL_SCALE - 0.5,
                        left: CROSSHAIR_SIZE / 2 - hashWidth / 2,
                        width: hashWidth,
                        height: 1,
                      },
                    ]}
                  />
                  {/* Above center (shorter marks) */}
                  {mil <= 3 && (
                    <View
                      style={[
                        crosshairStyles.milHash,
                        crosshairStyles.verticalMilHash,
                        {
                          top: CROSSHAIR_SIZE / 2 - mil * MIL_SCALE - 0.5,
                          left: CROSSHAIR_SIZE / 2 - 4,
                          width: 8,
                          height: 1,
                        },
                      ]}
                    />
                  )}
                </React.Fragment>
              );
            })}
            
            {/* Center dot (zero point) */}
            <View style={crosshairStyles.centerDot} />
            
            {/* Drop indicator line (vertical) - from center to aim point */}
            {Math.abs(clampedDropPixels) > 2 && (
              <View
                style={[
                  crosshairStyles.indicatorLine,
                  {
                    top: clampedDropPixels > 0 
                      ? CROSSHAIR_SIZE / 2 
                      : CROSSHAIR_SIZE / 2 + clampedDropPixels,
                    left: CROSSHAIR_SIZE / 2 - 1,
                    height: Math.abs(clampedDropPixels),
                    backgroundColor: dropMoa > 0 ? "#EF4444" : "#10B981",
                  },
                ]}
              />
            )}
            
            {/* Drift indicator line (horizontal) - from center to aim point */}
            {Math.abs(clampedDriftPixels) > 2 && (
              <View
                style={[
                  crosshairStyles.indicatorLine,
                  {
                    top: CROSSHAIR_SIZE / 2 - 1,
                    left: clampedDriftPixels > 0 
                      ? CROSSHAIR_SIZE / 2 
                      : CROSSHAIR_SIZE / 2 + clampedDriftPixels,
                    width: Math.abs(clampedDriftPixels),
                    backgroundColor: driftMoa > 0 ? "#3B82F6" : "#F59E0B",
                  },
                ]}
              />
            )}
          </View>
          
          {/* Aim adjustment point (outside circle to allow it to extend) */}
          <View
            style={[
              crosshairStyles.aimPoint,
              {
                top: CROSSHAIR_SIZE / 2 + clampedDropPixels,
                left: CROSSHAIR_SIZE / 2 + clampedDriftPixels,
              },
            ]}
          />
        </View>
        
        {/* Labels */}
        <View style={crosshairStyles.labelsContainer}>
          <View style={crosshairStyles.labelRow}>
            <Text style={[crosshairStyles.label, { color: "#EF4444" }]}>
              {dropMoa > 0 ? "↑ Aim High" : dropMoa < 0 ? "↓ Aim Low" : "No adjustment"}: {formatFeetInches(dropInches)} ({Math.abs(dropMoa).toFixed(2)} MOA)
            </Text>
          </View>
          {Math.abs(driftMoa) > 0.01 && (
            <View style={crosshairStyles.labelRow}>
              <Text style={[crosshairStyles.label, { color: driftMoa > 0 ? "#3B82F6" : "#F59E0B" }]}>
                {driftMoa > 0 ? "← Aim Left" : "→ Aim Right"}: {formatFeetInches(driftInches)} ({Math.abs(driftMoa).toFixed(2)} MOA)
              </Text>
            </View>
          )}
          <View style={crosshairStyles.labelRow}>
            <Text style={crosshairStyles.instruction}>
              Aim at the green dot • Center is zero point • MIL hash marks for ranging
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const crosshairStyles = StyleSheet.create({
  container: {
    backgroundColor: "#1F2937",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#E5E7EB",
    marginBottom: 16,
  },
  crosshairWrapper: {
    alignItems: "center",
    width: "100%",
  },
  crosshairContainer: {
    width: CROSSHAIR_SIZE,
    height: CROSSHAIR_SIZE,
    position: "relative",
    marginVertical: 20, // Add margin to allow aim point to extend beyond
  },
  circle: {
    width: CROSSHAIR_SIZE,
    height: CROSSHAIR_SIZE,
    borderRadius: CROSSHAIR_SIZE / 2,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    backgroundColor: "#F3F4F6", // Light gray background for better contrast
    position: "relative",
  },
  line: {
    position: "absolute",
    backgroundColor: "#6B7280",
  },
  mainLine: {
    position: "absolute",
    backgroundColor: "#000000", // Black for main crosshairs
  },
  horizontalLine: {
    width: CROSSHAIR_SIZE,
    height: 2, // Thicker main line
    top: CROSSHAIR_SIZE / 2 - 1,
    left: 0,
  },
  verticalLine: {
    width: 2, // Thicker main line
    height: CROSSHAIR_SIZE,
    top: 0,
    left: CROSSHAIR_SIZE / 2 - 1,
  },
  milHash: {
    position: "absolute",
    backgroundColor: "#000000", // Black hash marks
  },
  horizontalMilHash: {
    // Width and height set dynamically
  },
  verticalMilHash: {
    // Width and height set dynamically
  },
  centerDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#9CA3AF",
    top: CROSSHAIR_SIZE / 2 - 2,
    left: CROSSHAIR_SIZE / 2 - 2,
  },
  aimPoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E", // Green to match scope reticle
    borderWidth: 1,
    borderColor: "#000000",
    transform: [{ translateX: -4 }, { translateY: -4 }],
    zIndex: 10,
  },
  indicatorLine: {
    position: "absolute",
  },
  labelsContainer: {
    marginTop: 16,
    width: "100%",
    alignItems: "center",
  },
  labelRow: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  instruction: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    fontStyle: "italic",
  },
});

export default function App() {
  const [rifles, setRifles] = useState<Rifle[]>([]);
  const [selectedRifleId, setSelectedRifleId] = useState<string | null>(null);

  const [distanceYards, setDistanceYards] = useState<string>("300");
  const [windSpeedMph, setWindSpeedMph] = useState<string>("10");
  const [windAngleDeg, setWindAngleDeg] = useState<string>("90");

  const [loadingRifles, setLoadingRifles] = useState<boolean>(false);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [result, setResult] = useState<ShotResult | null>(null);
  const [loadingWeather, setLoadingWeather] = useState<boolean>(false);
  const [shootingDirection, setShootingDirection] = useState<number | null>(null);
  const [windDirection, setWindDirection] = useState<number | null>(null);

  // state for dropdown
  const [rifleDropdownOpen, setRifleDropdownOpen] = useState(false);

  // Fetch weather data based on location
  const fetchWeatherData = async () => {
    try {
      setLoadingWeather(true);
      
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to fetch local wind conditions."
        );
        setLoadingWeather(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Fetch weather data from Open-Meteo (free, no API key required)
      // Open-Meteo returns wind speed in m/s by default (wind_speed_10m is in m/s)
      // We need to convert m/s to mph: 1 m/s = 2.237 mph
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=wind_speed_10m,wind_direction_10m`;
      
      const response = await fetch(weatherUrl);
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      const windSpeedMs = data.current?.wind_speed_10m; // Wind speed in m/s
      const apiWindDirection = data.current?.wind_direction_10m; // Wind direction in degrees (0-360, where 0° = North)

      if (windSpeedMs !== undefined) {
        // Convert m/s to mph: 1 m/s = 2.23694 mph
        const windSpeedMph = windSpeedMs * 2.23694;
        const roundedSpeed = Math.round(windSpeedMph * 10) / 10; // Round to 1 decimal
        setWindSpeedMph(roundedSpeed.toString());
        
        // Store wind direction for angle calculation
        if (apiWindDirection !== undefined && apiWindDirection !== null) {
          setWindDirection(apiWindDirection);
          
          // If we already have a shooting direction, calculate the angle automatically
          if (shootingDirection !== null) {
            const relativeAngle = calculateWindAngle(shootingDirection, apiWindDirection);
            setWindAngleDeg(relativeAngle.toString());
          }
        }
        
        const directionText = apiWindDirection ? `${Math.round(apiWindDirection)}°` : 'N/A';
        Alert.alert(
          "Weather Data Loaded",
          `Wind Speed: ${roundedSpeed} mph\nWind Direction: ${directionText}\n\n${shootingDirection !== null ? 'Wind angle calculated automatically!' : 'Point your phone at the target to calculate wind angle.'}`
        );
      } else {
        throw new Error("Wind speed data not available");
      }
    } catch (err: any) {
      console.error("Weather fetch error:", err);
      Alert.alert(
        "Weather Fetch Failed",
        err.message ?? "Unable to fetch weather data. Please enter wind speed manually."
      );
    } finally {
      setLoadingWeather(false);
    }
  };

  // Calculate wind angle relative to shooting direction
  // shootingDir and windDir are in degrees (0-360, where 0° = North)
  // Returns angle in degrees where 90° = full crosswind
  const calculateWindAngle = (shootingDir: number, windDir: number): number => {
    // Calculate the difference between wind direction and shooting direction
    // This gives us the angle between them
    let angle = Math.abs(windDir - shootingDir);
    
    // Handle wrap-around (e.g., 350° and 10° should be 20°, not 340°)
    if (angle > 180) {
      angle = 360 - angle;
    }
    
    // The angle is already what we want: 0° = head/tail wind, 90° = full crosswind
    return Math.round(angle);
  };

  // Get shooting direction using phone compass
  const setShootingDirectionFromCompass = async () => {
    try {
      // Request location permissions (required for compass/heading)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to use the compass for shooting direction."
        );
        return;
      }

      // Get heading using Location API
      // Note: This requires the device to support compass/heading
      const heading = await Location.getHeadingAsync();
      
      if (heading.magHeading !== null && heading.magHeading !== undefined) {
        // magHeading is in degrees (0-360, where 0° = North)
        setShootingDirection(heading.magHeading);
        
        // If we have wind direction, calculate the angle automatically
        if (windDirection !== null) {
          const relativeAngle = calculateWindAngle(heading.magHeading, windDirection);
          setWindAngleDeg(relativeAngle.toString());
          
          Alert.alert(
            "Shooting Direction Set",
            `Direction: ${Math.round(heading.magHeading)}°\nWind Angle: ${relativeAngle}°\n\n${relativeAngle >= 70 && relativeAngle <= 110 ? 'Full crosswind!' : relativeAngle < 45 || relativeAngle > 135 ? 'Head/tail wind' : 'Partial crosswind'}`
          );
        } else {
          Alert.alert(
            "Shooting Direction Set",
            `Direction: ${Math.round(heading.magHeading)}°\n\nFetch weather data to calculate wind angle automatically.`
          );
        }
      } else {
        throw new Error("Compass heading not available");
      }
    } catch (err: any) {
      console.error("Compass error:", err);
      Alert.alert(
        "Compass Error",
        err.message ?? "Unable to get compass heading. Make sure your device has a compass."
      );
    }
  };

  // Load rifles on mount
  useEffect(() => {
    const fetchRifles = async () => {
      try {
        setLoadingRifles(true);
        const res = await fetch(`${BACKEND_URL}/rifles/`);
        if (!res.ok) {
          throw new Error(`Failed to load rifles: ${res.status}`);
        }
        const data: Rifle[] = await res.json();
        setRifles(data);
        if (data.length > 0) {
          setSelectedRifleId(data[0].id);
        }
      } catch (err: any) {
        console.error(err);
        Alert.alert("Error", err.message ?? "Failed to load rifles.");
      } finally {
        setLoadingRifles(false);
      }
    };

    fetchRifles();
  }, []);

  const handleCalculate = async () => {
    if (!selectedRifleId) {
      Alert.alert("Select a rifle", "Please select a rifle first.");
      return;
    }

    const rifle = rifles.find((r) => r.id === selectedRifleId);
    if (!rifle) {
      Alert.alert("Error", "Selected rifle not found.");
      return;
    }

    const distance = parseFloat(distanceYards);
    const windSpeed = parseFloat(windSpeedMph);
    const windAngle = parseFloat(windAngleDeg);

    if (isNaN(distance) || isNaN(windSpeed) || isNaN(windAngle)) {
      Alert.alert("Invalid input", "Please enter valid numeric values.");
      return;
    }

    try {
      setCalculating(true);
      setResult(null);

      const body = {
        distance_yards: distance,
        wind_speed_mph: windSpeed,
        wind_angle_deg: windAngle,
        rifle: {
          name: rifle.name,
          zero_yards: rifle.zero_yards,
          muzzle_velocity_fps: rifle.muzzle_velocity_fps,
        },
      };

      const res = await fetch(`${BACKEND_URL}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error (${res.status}): ${text}`);
      }

      const data: ShotResult = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message ?? "Failed to calculate shot.");
    } finally {
      setCalculating(false);
    }
  };

  const selectedRifle = rifles.find((r) => r.id === selectedRifleId) || null;

  // map rifles to dropdown items
  const rifleItems = rifles.map((r) => ({
    label: r.name,
    value: r.id,
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>ShotTracker - Phase 1</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rifle</Text>
          {loadingRifles ? (
            <ActivityIndicator />
          ) : rifles.length === 0 ? (
            <Text style={styles.infoText}>
              No rifles found. Use the backend `/rifles` POST to create some.
            </Text>
          ) : (
            <>
              <View style={styles.dropdownWrapper}>
                <DropDownPicker
                  open={rifleDropdownOpen}
                  value={selectedRifleId}
                  items={rifleItems}
                  setOpen={setRifleDropdownOpen}
                  setValue={(callback) => {
                    const value = callback(selectedRifleId) as string | null;
                    setSelectedRifleId(value);
                  }}
                  placeholder="Select a rifle"
                  style={styles.dropdown}
                  dropDownContainerStyle={styles.dropdownContainer}
                  listMode="SCROLLVIEW"
                  textStyle={styles.dropdownText}
                  placeholderStyle={styles.dropdownPlaceholder}
                />
              </View>
              {selectedRifle && (
                <Text style={styles.rifleDetails}>
                  {selectedRifle.name}
                  {"\n"}
                  Zero: {selectedRifle.zero_yards} yd • MV:{" "}
                  {selectedRifle.muzzle_velocity_fps} fps
                </Text>
              )}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shot Inputs</Text>

          <View style={styles.inputRow}>
            <Text style={styles.label}>Distance (yd)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={distanceYards}
              onChangeText={setDistanceYards}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={styles.windSpeedRow}>
              <Text style={styles.label}>Wind Speed (mph)</Text>
              <TouchableOpacity
                style={styles.weatherButton}
                onPress={fetchWeatherData}
                disabled={loadingWeather}
              >
                {loadingWeather ? (
                  <ActivityIndicator size="small" color="#F9FAFB" />
                ) : (
                  <Text style={styles.weatherButtonText}>Get from Location</Text>
                )}
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={windSpeedMph}
              onChangeText={setWindSpeedMph}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={styles.windSpeedRow}>
              <Text style={styles.label}>Wind Angle (deg)</Text>
              <TouchableOpacity
                style={styles.weatherButton}
                onPress={setShootingDirectionFromCompass}
              >
                <Text style={styles.weatherButtonText}>Set Shooting Direction</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.subLabel}>90 = full crosswind • Point phone at target, then tap above</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={windAngleDeg}
              onChangeText={setWindAngleDeg}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Button
            title={calculating ? "Calculating..." : "Calculate Shot"}
            onPress={handleCalculate}
            disabled={calculating || !selectedRifleId}
          />
        </View>

        {result && (
          <>
            <CrosshairDisplay
              dropMoa={result.drop_moa}
              driftMoa={result.drift_moa}
              dropInches={result.drop_inches}
              driftInches={result.drift_inches}
              distanceYards={result.distance_yards}
            />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detailed Results</Text>

              <Text style={styles.resultText}>
                Distance: {result.distance_yards.toFixed(0)} yd
              </Text>
              <Text style={styles.resultText}>
                Wind: {result.wind_speed_mph.toFixed(1)} mph @{" "}
                {result.wind_angle_deg.toFixed(0)}°
              </Text>

              <View style={styles.resultBlock}>
                <Text style={styles.resultHeader}>Drop</Text>
                <Text style={styles.resultText}>
                  {formatFeetInches(result.drop_inches)} ({result.drop_moa.toFixed(2)}{" "}
                  MOA)
                </Text>
              </View>

              <View style={styles.resultBlock}>
                <Text style={styles.resultHeader}>Drift</Text>
                <Text style={styles.resultText}>
                  {formatFeetInches(result.drift_inches)} ({result.drift_moa.toFixed(2)}{" "}
                  MOA)
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#111827", // dark navy
  },
  container: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 16,
    textAlign: "center",
  },
  section: {
    backgroundColor: "#1F2937",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#E5E7EB",
    marginBottom: 8,
  },
  infoText: {
    color: "#D1D5DB",
    fontSize: 14,
  },
  dropdownWrapper: {
    zIndex: 10,
  },
  dropdown: {
    backgroundColor: "#111827",
    borderColor: "#4B5563",
  },
  dropdownContainer: {
    backgroundColor: "#1F2937",
    borderColor: "#4B5563",
  },
  dropdownText: {
    color: "#F9FAFB",
    fontSize: 16,
  },
  dropdownPlaceholder: {
    color: "#9CA3AF",
  },
  dropdownArrow: {
    tintColor: "#F9FAFB",
  },
  rifleDetails: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 8,
  },
  inputRow: {
    marginBottom: 12,
  },
  windSpeedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  label: {
    color: "#D1D5DB",
    fontSize: 14,
  },
  weatherButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  weatherButtonText: {
    color: "#F9FAFB",
    fontSize: 12,
    fontWeight: "600",
  },
  subLabel: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  input: {
    backgroundColor: "#111827",
    color: "#F9FAFB",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 4,
  },
  resultText: {
    color: "#E5E7EB",
    fontSize: 16,
    marginBottom: 4,
  },
  resultHeader: {
    color: "#FBBF24",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  resultBlock: {
    marginTop: 8,
  },
});
