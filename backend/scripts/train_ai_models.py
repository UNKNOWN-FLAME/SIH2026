"""Model Training Pipeline for Himantar Predictive AI Suite.

Trains production-grade machine learning models:
1. Microgrid Electrical Load Forecaster (RandomForestRegressor)
2. Station Fuel Burn Rate Predictor (GradientBoostingRegressor)
3. Multi-Channel Equipment Anomaly Detector (IsolationForest Pipeline)
"""
import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, r2_score, f1_score, precision_score, recall_score

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "backend", "data")
MODELS_DIR = os.path.join(PROJECT_ROOT, "backend", "cloud", "ai_engine", "models")
os.makedirs(MODELS_DIR, exist_ok=True)


def train_microgrid_load_model():
    print("[TRAIN] Training Microgrid Electrical Load Forecaster...")
    csv_path = os.path.join(DATA_DIR, "microgrid_energy_train.csv")
    df = pd.read_csv(csv_path)

    feature_cols = ["month", "hour", "ambient_temp_c", "wind_speed_kmh", "solar_radiation_wm2", "crew_count"]
    target_col = "total_load_kw"

    X = df[feature_cols]
    y = df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)

    print(f"       Load Model Performance: R2 = {r2:.4f}, MAE = {mae:.2f} kW")

    model_path = os.path.join(MODELS_DIR, "microgrid_load_model.joblib")
    joblib.dump({
        "model": model,
        "feature_cols": feature_cols,
        "metrics": {"r2": round(r2, 4), "mae": round(mae, 2)},
    }, model_path)
    print(f"       Saved model -> {model_path}")
    return model_path


def train_fuel_burn_model():
    print("[TRAIN] Training Fuel Burn Rate Predictor...")
    csv_path = os.path.join(DATA_DIR, "microgrid_energy_train.csv")
    df = pd.read_csv(csv_path)

    feature_cols = ["generator_load_kw", "ambient_temp_c", "crew_count"]
    target_col = "fuel_flow_L_hr"

    X = df[feature_cols]
    y = df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = GradientBoostingRegressor(n_estimators=100, max_depth=5, learning_rate=0.08, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)

    print(f"       Fuel Model Performance: R2 = {r2:.4f}, MAE = {mae:.2f} L/hr")

    model_path = os.path.join(MODELS_DIR, "fuel_burn_model.joblib")
    joblib.dump({
        "model": model,
        "feature_cols": feature_cols,
        "metrics": {"r2": round(r2, 4), "mae": round(mae, 2)},
    }, model_path)
    print(f"       Saved model -> {model_path}")
    return model_path


def train_equipment_anomaly_detector():
    print("[TRAIN] Training Equipment Anomaly Detector (Isolation Forest)...")
    csv_path = os.path.join(DATA_DIR, "equipment_anomaly_train.csv")
    df = pd.read_csv(csv_path)

    feature_cols = [
        "vibration_rms_z",
        "coolant_temp_c",
        "oil_pressure_bar",
        "oil_viscosity_pct",
        "fuel_rail_pressure_bar",
        "exhaust_gas_temp_c",
        "battery_temp_c",
    ]

    # Baseline nominal data for fitting
    X = df[feature_cols]
    y_true = df["is_anomaly"]  # 1 = anomaly, 0 = nominal

    # Pipeline with StandardScaler + IsolationForest
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("detector", IsolationForest(n_estimators=150, contamination=0.05, random_state=42, n_jobs=-1)),
    ])
    pipeline.fit(X)

    # Scikit-learn IsolationForest returns -1 for anomaly, 1 for normal
    raw_preds = pipeline.predict(X)
    y_pred = (raw_preds == -1).astype(int)

    precision = precision_score(y_true, y_pred)
    recall = recall_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred)

    print(f"       Anomaly Model Performance: F1 = {f1:.4f}, Precision = {precision:.4f}, Recall = {recall:.4f}")

    # Calculate baseline normal statistics (mean & std) for each channel to enable deviation % computation
    nominal_df = df[df["is_anomaly"] == 0]
    channel_baselines = {}
    for col in feature_cols:
        channel_baselines[col] = {
            "mean": round(float(nominal_df[col].mean()), 4),
            "std": round(float(nominal_df[col].std()), 4),
            "min": round(float(nominal_df[col].min()), 4),
            "max": round(float(nominal_df[col].max()), 4),
        }

    model_path = os.path.join(MODELS_DIR, "equipment_anomaly_model.joblib")
    joblib.dump({
        "pipeline": pipeline,
        "feature_cols": feature_cols,
        "channel_baselines": channel_baselines,
        "metrics": {
            "f1": round(f1, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
        },
    }, model_path)
    print(f"       Saved model -> {model_path}")
    return model_path


if __name__ == "__main__":
    print("[INFO] Starting ML Model Training Pipeline...")
    train_microgrid_load_model()
    train_fuel_burn_model()
    train_equipment_anomaly_detector()
    print("[SUCCESS] All 3 Machine Learning models successfully trained and serialized!")
