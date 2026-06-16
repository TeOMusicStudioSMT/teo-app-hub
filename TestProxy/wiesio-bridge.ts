// W pliku TestProxy/wiesio-bridge.ts

/**
 * Interfejs dla obiektu, który jest źródłem błędu ReferenceError.
 * Należy go wydzielić do własnego pliku typu/interfejs.
 */
export interface KeyObjectDefinition {
    // Dodaj tu wszystkie właściwości wymuszone przez kontekst "Chaos Injection"
    key: string; 
    config: any;
}

export class WiesioBridge {
    private readonly keyObject: KeyObjectDefinition; // Zmieniona zmienna prywatna

    /**
     * Konstruktor musi przyjować wszystkie kluczowe zależności.
     * To zapobiega użyciu obiektu przed pełną inicjalizacją.
     */
    constructor(keyObject: KeyObjectDefinition) {
        if (!keyObject) {
            throw new Error("WiesioBridge wymaga zdefiniowanego klucza (KeyObjectDefinition).");
        }
        this.keyObject = keyObject; 
        // Tutaj wykonuje się wszelkie początkowe hooki, które wcześniej mogły zawieść
    }

    // ... reszta metody
}