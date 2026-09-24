/**
 * ⏸️ PAUZA ANIMACJI — pętle rAF mają stać, gdy nikt nie patrzy.
 *
 * Suweren 2026-09-24: karta HuBa brała 1,8 GB, a po ścięciu buforów kanwy proces GPU nadal
 * siedział na 757 MB i 107 % CPU. Powód: dziewięć niezależnych pętli requestAnimationFrame
 * (tła, orbita, matrix, portal…) kręci się bez przerwy — także wtedy, gdy karta jest w tle
 * albo animacja wyjechała za ekran. Przeglądarka sama dławi rAF w ukrytej karcie, ale nie
 * zwalnia przez to pracy kompozytora ani nie przestaje trzymać tekstur.
 *
 * `obserwujWidocznosc` daje jedną odpowiedź na pytanie „czy warto rysować": karta widoczna
 * ORAZ element w kadrze. Wywołanie zwrotne dostaje true/false, a sprzątanie robi zwrócona funkcja.
 */

export function obserwujWidocznosc(el: Element | null, naZmiane: (widoczny: boolean) => void): () => void {
    let wKadrze = true;
    const przelicz = () => naZmiane(wKadrze && !document.hidden);

    const naKarte = () => przelicz();
    document.addEventListener('visibilitychange', naKarte);

    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== 'undefined') {
        io = new IntersectionObserver((wpisy) => {
            for (const w of wpisy) wKadrze = w.isIntersecting;
            przelicz();
        }, { threshold: 0.01 });
        io.observe(el);
    }

    przelicz();
    return () => {
        document.removeEventListener('visibilitychange', naKarte);
        io?.disconnect();
    };
}

/**
 * Pętla rysująca, która zatrzymuje się, gdy nie ma na co patrzeć, i wznawia sama.
 * Zwraca funkcję sprzątającą (do zwrócenia z useEffect).
 */
export function petlaGdyWidoczna(el: Element | null, klatka: (czas: number) => void): () => void {
    let id = 0;
    let gra = false;

    const krok = (t: number) => {
        if (!gra) return;
        klatka(t);
        id = requestAnimationFrame(krok);
    };

    const stopObserwacji = obserwujWidocznosc(el, (widoczny) => {
        if (widoczny && !gra) { gra = true; id = requestAnimationFrame(krok); }
        else if (!widoczny && gra) { gra = false; cancelAnimationFrame(id); }
    });

    return () => { gra = false; cancelAnimationFrame(id); stopObserwacji(); };
}
