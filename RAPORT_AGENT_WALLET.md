# 🔐 Raport: MetaMask Agent Wallet a Katedra OtakOS

**Data:** 2026-08-13 · **Dla:** Suweren Arkadiusz · **Sporządził:** Klaudiusz
**Status:** rozpoznanie. Niczego nie zainstalowano, niczego nie podłączono.
**Źródło:** `docs.metamask.io/agent-wallet` — strony *overview*, *trading-modes*, *architecture*.

---

## 1. Wniosek na wstępie

Agent Wallet jest **dobrze zbudowany** i pod względem bezpieczeństwa bije wszystko, co
moglibyśmy sami napisać. Ale jego fundament stoi **dokładnie odwrotnie** do fundamentu Katedry.

> **Klucze prywatne NIE leżą na Twojej maszynie.**
> Cytat z dokumentacji architektury: klucze są *„zarządzane i zabezpieczone po stronie serwera
> w zaufanym środowisku wykonawczym (TEE), więc agenci nie mają dostępu do Twojego głównego
> portfela"*. Podpisywanie odbywa się **na serwerach MetaMaska**, nie u Ciebie.

CLI `mm` na Twoim komputerze **nie podpisuje niczego** — wysyła żądania podpisu do chmury
i dostaje `pollingId` do śledzenia.

To nie jest wada produktu. Dla większości ludzi TEE po stronie serwera jest **bezpieczniejsze**
niż klucz w zasięgu lokalnego agenta. To jest natomiast **sprzeczność z pierwszą zasadą 0.00G**:
„wszystko działa lokalnie, na sprzęcie Suwerena, zero chmury jako domyślne".

**Agent Wallet to usługa powiernicza w chmurze z bardzo dobrymi barierkami.**
Nie jest to suwerenny portfel lokalny i nie da się go w taki przerobić.

---

## 2. Co realnie potrafi

Przelewy, swapy, mosty, **handel perpetualami na Hyperliquid**, rynki predykcyjne Polymarket,
lending na Aave V3, depozyty do skarbców yield, płatności x402. Wszystko sterowane językiem
naturalnym, przez CLI `mm` i „skille" wpinane w agenta.

To nie jest lepszy podgląd salda. To **agent zawierający transakcje finansowe**.

---

## 3. Barierki — zmierzone, nie streszczone z ulotki

### Guard Mode (zalecany przez MetaMask)

Automatyczne, bez pytania:
- skan zagrożeń (Blockaid),
- **biała lista sieci**,
- **biała lista adresów odbiorców**,
- biała lista odbiorców tokenów,
- **kroczący limit wypływu z 24 godzin**.

Wymaga zatwierdzenia 2FA:
- transakcje złośliwe,
- ryzykowne kontrakty,
- **cokolwiek poza białymi listami**,
- **prośby o podniesienie limitu wypływu**.

### Beast Mode

Automatycznie: **sam skan zagrożeń**. Białe listy i limit wypływu — **zdjęte**.
2FA tylko przy złośliwych transakcjach i ryzykownych kontraktach.

> Beast Mode zdejmuje dokładnie te barierki, które chronią przed **własnym błędem agenta**,
> zostawiając tylko ochronę przed cudzym atakiem. Przy modelu, który potrafi spłaszczyć
> kontrakt JSON, to jest ta różnica, która kosztuje pieniądze.

### Przełączanie

```
mm init --mode guard
mm wallet trading-mode set guard
mm wallet trading-mode set beast
mm wallet trading-mode get
```

### Zatwierdzanie 2FA

Zadanie wchodzi w stan `AWAITING_MFA`, **CLI wstrzymuje pracę** do decyzji.
Powiadomienie: push w MetaMask Mobile albo odnośnik e-mailem.

### Ochrona transakcji

Do **10 000 $/miesiąc** dla transakcji zakwalifikowanych jako bezpieczne.
Warunki, wyłączenia i próg subskrypcji leżą w regulaminie *Transaction Shield* —
**nie sprawdzałem ich** i nie należy zakładać, że pokrywają błąd agenta.

---

## 4. Czego dokumentacja NIE mówi

Uczciwie o granicach tego rozpoznania — te rzeczy trzeba sprawdzić przed decyzją:

1. **Cofanie uprawnień.** Nie znalazłem opisu procedury odbierania agentowi dostępu.
2. **Scenariusz przejęcia maszyny albo konta.** Nie opisany.
3. **Konkretne wartości limitu wypływu** — ustala je użytkownik przy pierwszej transakcji,
   ale widełek nie podano.
4. **Klucze sesji / delegowane** — wzmiankowane pośrednio, bez szczegółów.

---

## 5. Argument, którego nie wolno pominąć

Nie jest teoretyczny. **Zmierzony w tej Katedrze 2026-08-05**, przy budowie Reżysera:

Lokalny rdzeń `gemma4:e2b` dostał jednoznaczną instrukcję zwrócić
`{"mowa":…,"akcja":{"typ":…}}`. Zwrócił `{"akcja":"dodaj_kadr","tytul":…}` — typ jako
zwykły tekst, pola akcji jako rodzeństwo, pole „mowa" pominięte.
Musiałem **rozszerzyć parser**, żeby przyjmował zniekształcone kształty — inaczej Reżyser
w ogóle nie miałby rąk.

Przy kartach na tablicy produkcyjnej wyrozumiały parser jest rozsądnym kompromisem.
**Przy portfelu wyrozumiały parser znaczy „zgadłem, co miałeś na myśli" — z prawdziwymi
pieniędzmi.**

To nie jest zarzut wobec MetaMaska. Ich barierki są mocne. To jest zarzut wobec **naszego
rdzenia**: model, który nie utrzymuje kontraktu, nie powinien dostać klucza do środków.

---

## 6. Rekomendacja

**Nie wdrażać teraz.** Nie dlatego, że produkt jest zły — jest dobry — tylko dlatego,
że trzy warunki nie są spełnione:

| Warunek | Stan |
|---|---|
| Rdzeń trzyma kontrakt formatu | ❌ zmierzone, że nie trzyma |
| Wiemy, jak cofnąć uprawnienia | ❌ nie opisane w dokumentacji |
| Zgoda na chmurę powierniczą | ❓ decyzja Suwerena, sprzeczna z zasadą 0.00G |

### Gdyby jednak wdrażać — warunki brzegowe

1. **Wyłącznie Guard Mode.** Beast Mode nigdy, w żadnym trybie pracy.
2. **Osobny portfel operacyjny** z kwotą, której utrata nie boli. Nie ten z ~130 $.
   Portfel główny nie dotyka agenta w ogóle.
3. **Limit wypływu ustawiony najniżej, jak się da.** Podnoszenie tylko ręcznie, świadomie.
4. **Biała lista adresów** — wyłącznie własne portfele Suwerena.
5. **Dziennik Decyzji obowiązkowy.** Każde zlecenie dla agenta zapisane ZANIM znany jest
   wynik — mamy do tego gotowy moduł, ta sama zasada co przy własnych decyzjach.
6. **Rdzeń chmurowy, nie `gemma4:e2b`**, dopóki lokalny nie przejdzie testu kontraktu
   sto razy z rzędu bez wyrozumiałego parsera.

### Co Klaudiusz zrobi, a czego nie

**Zrobię:** instalację, barierki, białe listy, dziennik, panel stanu, alarmy.
**Czego nie zrobię:** nie wykonam transakcji, nie przesunę środków, nie doradzę, co kupić.
Buduję hamulec i kierownicę — pedału nie naciskam. To się nie zmieni.

---

## 7. Co proponuję zamiast

Zanim damy agentowi ręce, warto dokończyć to, co i tak jest potrzebne i **nic nie ryzykuje**:

- ✅ **Portfel mówi prawdę** — zrobione (`b715b09`). Tokeny ERC-20 były niewidzialne,
  suma zaniżona; na adresie testowym stary widok pokazywał ~30% stanu.
- ⏭️ **Historia wartości portfela** — dziś widzimy migawkę, nie zmianę w czasie.
- ⏭️ **Alarm progowy** — powiadomienie, gdy wartość przekroczy próg. Read-only, zero ryzyka.
- ⏭️ **Dziennik Decyzji spięty z portfelem** — automatyczne dociąganie ceny w chwili wpisu.

Każdy z tych kroków zwiększa to, co realnie wiesz o swoich pieniądzach.
Żaden nie oddaje nikomu klucza.
