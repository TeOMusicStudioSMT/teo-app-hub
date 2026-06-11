import React, { useRef, useEffect, useState } from 'react';
import { useRoastRoastContext } from '../../context/roastingContext';

/**
 * MediaInput — Gated Component (Pralka / Roasting Station)
 * Dostęp do kamery (WebRTC) kontrolowany przez ProtocolPolicy z kontekstu.
 * Polityka poziomu decyduje, czy media mogą płynąć w strumień.
 */
const MediaInput: React.FC = () => {
    // Zamiast ręcznego dostępu do API, używamy kontekstowego gate'a (policy)
    const { policy, sendMessageWithMedia } = useRoastRoastContext();
    const videoRef  = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [cameraOn, setCameraOn] = useState(false);
    const [capturing, setCapturing] = useState(false);

    // ── Cykl życia kamery sterowany polityką ──────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
                setCameraOn(true);
            } catch {
                console.warn('[MEDIA INPUT] Kamera niedostępna lub brak zgody.');
                setCameraOn(false);
            }
        };

        const stopCamera = () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
            setCameraOn(false);
        };

        if (policy.canSendMedia) {
            startCamera();
        } else {
            stopCamera();
            console.warn(`[MEDIA INPUT] API WebRTC wyłączone przez politykę P=${policy.requiredCodec}.`);
        }

        return () => { cancelled = true; stopCamera(); };
    }, [policy.canSendMedia, policy.requiredCodec]);

    // ── Przechwycenie klatki i wysyłka przez warstwy walidacji ────────────────
    const handleCaptureAndSend = async () => {
        // 1. Weryfikacja zasobów (Gate check)
        if (!policy.canSendMedia) {
            console.warn(`Blokada: Protokół P=${policy.requiredCodec} nie zezwala na transmisję mediów.`);
            return;
        }
        if (!videoRef.current || !cameraOn) return;

        setCapturing(true);
        try {
            const video  = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width  = video.videoWidth  || 640;
            canvas.height = video.videoHeight || 480;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

            await sendMessageWithMedia('Gotowy do roastowania materiał!', 'IMAGE', dataUrl);
            console.log(`[MEDIA INPUT] Przesłano media zgodnie z Protokołem P=${policy.requiredCodec}.`);
        } finally {
            setCapturing(false);
        }
    };

    return (
        <div className="p-4 border-t border-indigo-800 bg-gray-900/50 rounded-lg">
            {/* Element wizualizujący strumień WebRTC */}
            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-32 object-cover bg-black rounded mb-4 transition-opacity"
                style={{ opacity: policy.canSendMedia && cameraOn ? 1 : 0.3 }}
            />

            <p className={`text-sm mb-3 ${policy.canSendMedia ? 'text-green-400' : 'text-red-400'}`}>
                STATUS: {policy.stateDescription} (Kod Protokołu: {policy.requiredCodec})
                {policy.canSendMedia && !cameraOn && <span className="text-yellow-400"> · kamera offline</span>}
            </p>

            {/* Button jest aktywowany tylko, gdy policy na to pozwala */}
            <button
                onClick={handleCaptureAndSend}
                disabled={!policy.canSendMedia || capturing || policy.stateDescription === 'AWARIA POŁĄCZENIA'}
                className={`w-full p-3 rounded transition duration-150 text-white text-sm font-bold ${
                    policy.canSendMedia && policy.stateDescription !== 'AWARIA POŁĄCZENIA'
                        ? 'bg-indigo-700 hover:bg-indigo-600'
                        : 'bg-gray-600 cursor-not-allowed'
                }`}
            >
                {capturing
                    ? '⟳ PRZECHWYTYWANIE...'
                    : policy.canSendMedia ? '📸 SEND ROAST (Multimedialny)' : '🔒 BLOKADA FUNKCJI MEDIA'}
            </button>
        </div>
    );
};

export default MediaInput;
