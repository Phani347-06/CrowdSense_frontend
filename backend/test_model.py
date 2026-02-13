import joblib
import pandas as pd
import numpy as np
import os

MODEL_PATH = "smart_crowd_per_location_model.pkl"
try:
    model_bundle = joblib.load(MODEL_PATH)
    models = model_bundle["models"]
    label_encoder = model_bundle["label_encoder"]
    print("Model loaded")
    
    # Test one prediction
    loc_encoded = label_encoder.transform(["Canteen"])[0]
    model = models.get(loc_encoded)
    features = pd.DataFrame([{
        "hour": 12,
        "weekday": 0,
        "rssi": -60,
        "value": 200,
        "prev_density": 50,
        "prev2_density": 45,
        "rolling_mean_6": 48.0,
        "prev_day_density": 40,
        "is_weekend": 0
    }])
    pred = model.predict(features)[0]
    print(f"Prediction: {pred}")
except Exception as e:
    print(f"Error: {e}")
