/**
 * 🖼️ Obrazy ze schowka i z przeciągania — Suweren buduje zrzutami ekranu („tak buduję"), więc każdy czat,
 * który umie obraz przyjąć, bierze go z Ctrl+V i z upuszczenia (zrzut z Eksploratora, przeglądarki, narzędzia do zrzutów).
 */
export function obrazyZ(dt: DataTransfer | null | undefined): File[] {
    if (!dt) return [];
    const zItems = Array.from(dt.items ?? [])
        .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
    if (zItems.length) return zItems;
    return Array.from(dt.files ?? []).filter((f) => f.type.startsWith('image/'));
}

/** Zrzut ze schowka nie ma nazwy („image.png") — dajemy czytelną z godziną. */
export function nazwaZrzutu(f: File): string {
    return f.name && f.name !== 'image.png' ? f.name : `zrzut_${new Date().toTimeString().slice(0, 8).replace(/:/g, '-')}.png`;
}

/** Plik → dataURL (bez kompresji — dla mostu, który zapisuje oryginał). */
export function doDataUrl(f: File): Promise<string> {
    return new Promise((ok, zle) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result));
        r.onerror = () => zle(r.error ?? new Error('Nie odczytałem obrazu.'));
        r.readAsDataURL(f);
    });
}
