import os
import sys

# Definicja warstw TeO Hub do sprawdzenia
LAYERS = ["Hardware", "Data", "Foundry", "Advanced", "Delivery"]
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))  # Wyjście do katalogu głównego Molty

def audit_layers():
    print(f"--- TeO Hub Audit Start: {BASE_DIR} ---")
    all_ok = True
    
    for layer in LAYERS:
        layer_path = os.path.join(BASE_DIR, layer)
        readme_path = os.path.join(layer_path, "README.md")
        
        if not os.path.isdir(layer_path):
             print(f"[ERROR] Warstwa {layer}: KATALOG_NIE_ISTNIEJE")
             all_ok = False
             continue

        if os.path.isfile(readme_path):
            print(f"[OK] Warstwa {layer}: ENERGIA_OK")
        else:
            print(f"[ALERT] Warstwa {layer}: BRAK_INFORMACJI (Brak README.md)")
            all_ok = False
            
    print("--- TeO Hub Audit End ---")
    
    if all_ok:
        print("\nSYSTEM STATUS: STABILNY (Wszystkie warstwy aktywne)")
    else:
        print("\nSYSTEM STATUS: WYMAGANA INTERWENCJA")

if __name__ == "__main__":
    audit_layers()
