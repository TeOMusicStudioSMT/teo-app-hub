# Field Control - Struktura

Panel operacyjny do zarządzania zasobami w terenie (Field Ops) oraz monitorowania statusu węzłów (Nodes).

## Struktura Katalogów

- **`/dashboard`** - Główny interfejs operatora.
- **`/drones`** - Zarządzanie flotą (drony, kamery, sensory).
- **`/intel`** - Agregacja danych zwiadowczych (Recon).
- **`/comms`** - Szyfrowana komunikacja (Matrix/Signal bridge).
- **`/supply`** - Logistyka i zasoby (Inventory).

## Technologie
- React 19 (Frontend)
- Leaflet/Mapbox (Mapy taktyczne)
- WebRTC (Streaming wideo z dronów)
