"""
Retrain CrowdSense XGBoost Model
Generates realistic synthetic campus data with proper patterns, then trains
per-location XGBRegressor models.
"""

import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import random
import warnings
warnings.filterwarnings('ignore')

random.seed(42)
np.random.seed(42)

# ─────────────────────────────────────────────
# 1. Location Profiles
# ─────────────────────────────────────────────
LOCATIONS = {
    "Canteen": {
        "capacity": 200,
        # Hourly pattern: peaks at lunch (12-14), moderate morning/evening
        "hourly_base": {
            0: 5, 1: 3, 2: 2, 3: 2, 4: 3, 5: 5,
            6: 15, 7: 40, 8: 70, 9: 90, 10: 100,
            11: 130, 12: 185, 13: 190, 14: 160, 15: 110,
            16: 80, 17: 70, 18: 90, 19: 75, 20: 50,
            21: 30, 22: 15, 23: 8
        },
        "weekend_factor": 0.35,  # Much lower on weekends
    },
    "Library": {
        "capacity": 500,
        # Peaks in late morning and afternoon (study hours)
        "hourly_base": {
            0: 10, 1: 5, 2: 3, 3: 3, 4: 5, 5: 8,
            6: 20, 7: 50, 8: 120, 9: 200, 10: 280,
            11: 320, 12: 250, 13: 230, 14: 300, 15: 350,
            16: 380, 17: 340, 18: 280, 19: 220, 20: 150,
            21: 80, 22: 40, 23: 15
        },
        "weekend_factor": 0.50,  # Some students study on weekends
    },
    "PG Block": {
        "capacity": 150,
        # Residential: higher in morning and evening
        "hourly_base": {
            0: 100, 1: 110, 2: 115, 3: 120, 4: 115, 5: 105,
            6: 90, 7: 60, 8: 35, 9: 25, 10: 20,
            11: 20, 12: 30, 13: 30, 14: 25, 15: 25,
            16: 35, 17: 55, 18: 80, 19: 100, 20: 110,
            21: 120, 22: 125, 23: 115
        },
        "weekend_factor": 1.15,  # More people stay in on weekends
    },
    "New Block": {
        "capacity": 300,
        # Academic: class schedule pattern
        "hourly_base": {
            0: 5, 1: 3, 2: 2, 3: 2, 4: 3, 5: 5,
            6: 10, 7: 30, 8: 100, 9: 200, 10: 240,
            11: 220, 12: 120, 13: 100, 14: 180, 15: 230,
            16: 210, 17: 150, 18: 80, 19: 40, 20: 20,
            21: 10, 22: 5, 23: 3
        },
        "weekend_factor": 0.15,  # Very few people on weekends
    },
    "D Block": {
        "capacity": 400,
        # Academic + labs: morning-afternoon heavy
        "hourly_base": {
            0: 5, 1: 3, 2: 2, 3: 2, 4: 3, 5: 5,
            6: 15, 7: 50, 8: 140, 9: 250, 10: 300,
            11: 280, 12: 180, 13: 160, 14: 240, 15: 280,
            16: 260, 17: 200, 18: 120, 19: 60, 20: 30,
            21: 15, 22: 8, 23: 5
        },
        "weekend_factor": 0.20,  # Labs sometimes open on Saturday
    },
}


# ─────────────────────────────────────────────
# 2. Generate Realistic Data
# ─────────────────────────────────────────────
def generate_data(n_days=90):
    """Generate 90 days of 5-minute interval data for all locations."""
    records = []

    for day in range(n_days):
        weekday = day % 7  # 0=Mon, 6=Sun
        is_weekend = 1 if weekday >= 5 else 0

        for loc_name, profile in LOCATIONS.items():
            prev_density = None
            prev2_density = None
            densities_today = []

            for hour in range(24):
                for minute in [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]:
                    # Base density for this hour
                    base = profile["hourly_base"][hour]

                    # Weekend adjustment
                    if is_weekend:
                        base = base * profile["weekend_factor"]

                    # Add day-of-week variation (Mon different from Fri)
                    dow_factor = 1.0
                    if weekday == 0:  # Monday: slightly lower (people arriving late)
                        dow_factor = 0.90
                    elif weekday == 4:  # Friday: slightly lower (people leave early)
                        dow_factor = 0.92
                    elif weekday == 2:  # Wednesday: peak day
                        dow_factor = 1.08
                    base *= dow_factor

                    # Smooth transition between hours (interpolate)
                    next_hour = (hour + 1) % 24
                    next_base = profile["hourly_base"][next_hour]
                    if is_weekend:
                        next_base *= profile["weekend_factor"]
                    next_base *= dow_factor
                    frac = minute / 60.0
                    interpolated = base * (1 - frac) + next_base * frac

                    # Add realistic noise (±10-15%)
                    noise = np.random.normal(1.0, 0.10)
                    density = int(interpolated * noise)

                    # Special events (random spikes on ~5% of days)
                    if random.random() < 0.03 and 10 <= hour <= 16:
                        density = int(density * random.uniform(1.3, 1.6))

                    # Clamp
                    density = max(0, min(density, int(profile["capacity"] * 1.25)))

                    # RSSI correlated with density
                    density_ratio = density / max(profile["capacity"], 1)
                    rssi = int(-82 + density_ratio * 35 + np.random.normal(0, 4))
                    rssi = max(-95, min(-25, rssi))

                    # Build features
                    rolling_vals = densities_today[-6:] if len(densities_today) >= 6 else densities_today if densities_today else [density]
                    rolling_mean_6 = np.mean(rolling_vals)

                    # prev_day_density: use same hour from previous day (approximate)
                    # In real data this would be exact; here we use a reasonable proxy
                    prev_day_density = density * random.uniform(0.85, 1.15)

                    record = {
                        "location": loc_name,
                        "hour": hour,
                        "weekday": weekday,
                        "is_weekend": is_weekend,
                        "rssi": rssi,
                        "value": profile["capacity"],
                        "prev_density": prev_density if prev_density is not None else density,
                        "prev2_density": prev2_density if prev2_density is not None else density,
                        "rolling_mean_6": rolling_mean_6,
                        "prev_day_density": prev_day_density,
                        "density": density  # TARGET
                    }
                    records.append(record)

                    # Update history
                    prev2_density = prev_density
                    prev_density = density
                    densities_today.append(density)

    return pd.DataFrame(records)


# ─────────────────────────────────────────────
# 3. Train Per-Location Models
# ─────────────────────────────────────────────
print("Generating training data (90 days x 5 locations x 288 intervals/day)...")
df = generate_data(n_days=90)
print(f"Total records: {len(df):,}")
print(f"Locations: {df['location'].unique().tolist()}")
print()

# Encode locations
le = LabelEncoder()
df['location_encoded'] = le.fit_transform(df['location'])
print(f"Label Encoder classes: {list(le.classes_)}")

FEATURE_COLS = ['hour', 'weekday', 'rssi', 'value', 'prev_density',
                'prev2_density', 'rolling_mean_6', 'prev_day_density', 'is_weekend']

models = {}
print()
print("=" * 60)
print("Training per-location XGBRegressor models...")
print("=" * 60)

for loc_name in le.classes_:
    loc_id = le.transform([loc_name])[0]
    loc_data = df[df['location'] == loc_name]

    X = loc_data[FEATURE_COLS]
    y = loc_data['density']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = XGBRegressor(
        n_estimators=300,         # Reduced from 1200 to prevent overfitting
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        verbosity=0
    )

    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    # Feature importances
    imp = model.feature_importances_
    top3 = sorted(zip(FEATURE_COLS, imp), key=lambda x: -x[1])[:3]
    top3_str = ", ".join([f"{f}={v:.3f}" for f, v in top3])

    print(f"  {loc_name:12s} | MAE={mae:6.1f} | R2={r2:.4f} | Top: {top3_str}")

    models[loc_id] = model

# ─────────────────────────────────────────────
# 4. Save Model
# ─────────────────────────────────────────────
bundle = {
    "models": models,
    "label_encoder": le
}

# Backup old model
import shutil, os
old_path = "smart_crowd_per_location_model.pkl"
backup_path = "smart_crowd_per_location_model_OLD.pkl"
if os.path.exists(old_path):
    shutil.copy2(old_path, backup_path)
    print(f"\nOld model backed up to: {backup_path}")

joblib.dump(bundle, old_path)
print(f"New model saved to: {old_path}")

# ─────────────────────────────────────────────
# 5. Validate New Model
# ─────────────────────────────────────────────
print()
print("=" * 60)
print("VALIDATION: Testing new model patterns")
print("=" * 60)

def test_predict(location, hour, weekday=2, rssi=-60, value=200, prev=100,
                 prev2=100, rolling=100, prev_day=100, is_weekend=0):
    loc_id = le.transform([location])[0]
    m = models[loc_id]
    feat = pd.DataFrame([{'hour':hour,'weekday':weekday,'rssi':rssi,'value':value,
        'prev_density':prev,'prev2_density':prev2,
        'rolling_mean_6':rolling,'prev_day_density':prev_day,'is_weekend':is_weekend}])
    return int(m.predict(feat)[0])

# Test hourly pattern for Canteen
print("\nCanteen hourly pattern:")
for h in [7, 9, 11, 12, 13, 15, 17, 20]:
    base_prev = LOCATIONS["Canteen"]["hourly_base"].get(h-1, 50)
    p = test_predict("Canteen", hour=h, prev=base_prev, prev2=base_prev, rolling=base_prev, rssi=-65)
    print(f"  {h:02d}:00 -> {p:4d}")

# Weekend vs Weekday
print("\nWeekend vs Weekday (Library 12PM):")
wd = test_predict("Library", hour=12, weekday=2, is_weekend=0, prev=250, prev2=250, rolling=250, rssi=-55, value=500)
we = test_predict("Library", hour=12, weekday=5, is_weekend=1, prev=125, prev2=125, rolling=125, rssi=-70, value=500)
print(f"  Weekday={wd}, Weekend={we}, Diff={wd-we}")

# prev_density effect
print("\nprev_density effect (Canteen 12PM):")
for prev in [30, 80, 130, 180]:
    p = test_predict("Canteen", hour=12, prev=prev, prev2=prev, rolling=prev, rssi=-60)
    print(f"  prev={prev:4d} -> predicted={p:4d}")

print("\nDone!")
