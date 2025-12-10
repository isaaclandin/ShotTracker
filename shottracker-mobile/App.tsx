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
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";

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

export default function App() {
  const [rifles, setRifles] = useState<Rifle[]>([]);
  const [selectedRifleId, setSelectedRifleId] = useState<string | null>(null);

  const [distanceYards, setDistanceYards] = useState<string>("300");
  const [windSpeedMph, setWindSpeedMph] = useState<string>("10");
  const [windAngleDeg, setWindAngleDeg] = useState<string>("90");

  const [loadingRifles, setLoadingRifles] = useState<boolean>(false);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [result, setResult] = useState<ShotResult | null>(null);

  // state for dropdown
  const [rifleDropdownOpen, setRifleDropdownOpen] = useState(false);

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
            <Text style={styles.label}>Wind Speed (mph)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={windSpeedMph}
              onChangeText={setWindSpeedMph}
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.label}>Wind Angle (deg)</Text>
            <Text style={styles.subLabel}>90 = full crosswind</Text>
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Result</Text>

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
                {result.drop_inches.toFixed(2)}" ({result.drop_moa.toFixed(2)}{" "}
                MOA)
              </Text>
            </View>

            <View style={styles.resultBlock}>
              <Text style={styles.resultHeader}>Drift</Text>
              <Text style={styles.resultText}>
                {result.drift_inches.toFixed(2)}" ({result.drift_moa.toFixed(2)}{" "}
                MOA)
              </Text>
            </View>
          </View>
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
    zIndex: 10, // helps dropdown render above other content
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
  label: {
    color: "#D1D5DB",
    fontSize: 14,
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
