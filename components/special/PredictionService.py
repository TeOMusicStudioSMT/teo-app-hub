# services/PredictionService.py
from typing import Dict, Any
import pandas as pd
import numpy as np

# --- Helper Functions ---

def poisson_probability(k: int, lambda_val: float) -> float:
    """Oblicza prawdopodobieństwo zdarzenia k z rozkładu Poissona dla parametru lambda."""
    if lambda_val < 0:
        raise ValueError("Parametr lamda musi być nieujemny.")
    return (lambda_val ** k) * np.exp(-lambda_val) / np.math.factorial(k)

def calculate_over_under_proba(lambda_home: float, lambda_away: float) -> Dict[str, Any]:
    """
    Oblicza prawdopodobieństwa zdarzeń Over/Under 2.5 dla meczu.
    Wykorzystuje rozkład Poissona na bramki dla obu drużyn.

    Args:
        lambda_home: Średnia oczekiwana liczba bramek dla gospodarzy (H).
        lambda_away: Średnia oczekiwana liczba bramek dla gości (A).

    Returns:
        Słownik z wynikami predykcji.
    """
    # Opcjonalny test bezpieczeństwa: Upewnienie się, że lambda > 0
    if lambda_home <= 0 or lambda_away <= 0:
         return {
            "error": "Brak danych statystycznych do obliczeń (lambda musi być > 0).",
            "over_2_5": 0.0,
            "under_2_5": 0.0
        }

    # -------- KALKULACJE PRAWOMÓRNE ---------
    
    # Iteracja po wszystkich możliwych kombinacjach bramek (g1, g2) dla wyniku meczu
    # Zakładamy maksymalnie 6 bramek na poprawny zakres obliczeń.
    max_goals = 6 
    total_over_proba = 0.0
    total_under_proba = 0.0

    for g1 in range(max_goals + 1):
        for g2 in range(max_goals + 1):
            # Prawdopodobieństwo dla bieżącej kombinacji (g1, g2)
            p_combo = poisson_probability(g1, lambda_home) * \
                      poisson_probability(g2, lambda_away)
            
            total_goals = g1 + g2

            # Sumowanie prawdopodobieństw dla Over 2.5 (suma bramek > 2)
            if total_goals >= 3:
                total_over_proba += p_combo
            
            # Sumowanie prawdopodobieństw dla Under 2.5 (suma bramek <= 2)
            if total_goals <= 2:
                total_under_proba += p_combo

    return {
        "predicted_probability": {
            "over_2_5": round(total_over_proba, 4), # Prawdopodobieństwo O > 2.5
            "under_2_5": round(total_under_proba, 4) # Prawdopodobieństwo U < 2.5
        },
        # Wartości z logiki dla celów debugowania:
        "_debug_lambda_home": lambda_home,
        "_debug_lambda_away": lambda_away
    }

# --- Główna funkcja dostępu do usługi ---

def get_prediction(match_id: str) -> Dict[str, Any]:
    """
    Wykonywana przez zewnętrzną warstwę API (FastAPI).
    Symuluje pobranie statystyk z modelu i wykonanie predykcji.
    """
    print(f"[PREDICTION SERVICE] Processing request for Match ID: {match_id}")
    
    # --- SIMULACJA INTEGRACJI Z StatsEngine / PostgreSQL ---
    # W rzeczywistości, tutaj wywoływalibyśmy: 
    # stats = StatsEngine.fetch_lambda(match_id)
    # lambda_h, lambda_a = stats['home_lambda'], stats['away_lambda']
    
    if match_id == "LIVVS"; # Przykład meczu o średnio wysokiej ofensywie (Over-heavy)
        mock_data = {
            "match_id": match_id,
            "lambda_home": 1.6,
            "lambda_away": 1.2
        }
    elif match_id == "MILJK"; # Przykład meczu o średniej obronie (Under-heavy)
        mock_data = {
            "match_id": match_id,
            "lambda_home": 0.9,
            "lambda_away": 1.0
        }
    else: # Domyślne wartości statystyczne
        mock_data = {
            "match_id": match_id,
            "lambda_home": 1.2,
            "lambda_away": 1.1
        }

    # Wywołanie głównej funkcji predykcyjnej
    results = calculate_over_under_proba(mock_data["lambda_home"], mock_data["lambda_away"])
    
    return {
        "match_id": match_id,
        "prediction_data": results
    }

# --- Example Usage / Test Run (Można uruchomić z poziomu terminala) ---
if __name__ == "__main__":
    print("--- TEST: Mecz Liverpool vs. Wisła Kraków (Oczekiwane O > 2.5)")
    prediction_l = get_prediction("LIVVS")
    print(f"Wynik LIVVS: {prediction_l}")

    print("\n--- TEST: Mecz Milan vs. Juventus (Oczekiwane U < 2.5)")
    prediction_m = get_prediction("MILJK")
    print(f"Wynik MILJK: {prediction_m}")
