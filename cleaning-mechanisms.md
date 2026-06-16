# Plan Implementacji Mechanizmów Czyszczących

Wdrożenie systemowych narzędzi do czyszczenia danych w 3 strategicznych punktach Katedry TeO Genesis, zgodnie z Dekretami Suwerena.

## Cel
Zapewnienie higieny danych, synchronizacji między kartami oraz ujednolicenie estetyki akcji destrukcyjnych.

## Zadania

- [ ] **KROK 1: Oczyszczanie W.I.D.O.K-u (WidokCore.tsx)**
    - [ ] Dodać funkcję `deleteReport(id, e)` do usuwania pojedynczych raportów z `localStorage` i stanu.
    - [ ] Zaimplementować `useEffect` z nasłuchiwaniem zdarzenia `storage`, aby synchronizować usunięcia między kartami.
    - [ ] Zaktualizować UI Archiwum: Dodać przycisk usuwania z animacją `opacity` (pojawianie się na hover) i ustandaryzowaną stylistyką "Destructive Action".
    - **Weryfikacja:** Usuń raport w jednej karcie, sprawdź czy zniknął w drugiej.

- [ ] **KROK 2: Czyszczenie Intencji na Stole Narad (KwantowyStolNarad.tsx)**
    - [ ] Dodać funkcję `clearTopic()` resetującą temat i usuwającą go z `localStorage`.
    - [ ] Zaktualizować UI "Cel Narady": Dodać przycisk "X" wewnątrz pola tekstowego (widoczny tylko gdy `topic` nie jest pusty).
    - **Weryfikacja:** Wpisz temat, kliknij "X", sprawdź czy pole zostało wyczyszczone.

- [ ] **KROK 3: Masowe oraz punktowe czyszczenie Terminala (TerminalZero.tsx)**
    - [ ] Dodać funkcję `dismissCouncilTask(index)` do usuwania pojedynczego zadania.
    - [ ] Dodać funkcję `clearAllTasks()` do natychmiastowego czyszczenia całej listy dekretów.
    - [ ] Zaktualizować UI "Zadania Oczekujące":
        - Dodać przycisk "WYCZYŚĆ WSZYSTKO" na początku paska.
        - Przebudować kafelki zadań, aby zawierały przycisk "WYKONAJ" oraz oddzielny przycisk "X" do usuwania.
    - **Weryfikacja:** Dodaj kilka zadań, usuń jedno, a następnie wyczyść wszystkie.

## Standard "Destructive Action" (CSS)
Wszystkie przyciski usuwania muszą posiadać klasy:
`bg-red-900/40 hover:bg-red-800/80 text-red-300 border border-red-500/50 rounded-lg transition-all`

## Gotowe Gdy
- [ ] WidokCore synchronizuje usunięcia raportów między kartami.
- [ ] Stół Narad pozwala na szybkie czyszczenie tematu.
- [ ] Terminal umożliwia masowe usuwanie dekretów bez zbędnych modali.
- [ ] Wszystkie akcje destrukcyjne są wizualnie spójne.
