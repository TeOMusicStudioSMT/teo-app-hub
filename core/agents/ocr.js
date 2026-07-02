import { exec } from 'child_process';
import { executeTacosGuard } from '../tacos-guard.js';

/**
 * Uruchamia OpenCodeReview review.
 * @param {{ from?: string, to?: string, commit?: string, repo?: string }} options 
 * @returns {Promise<{ success: boolean, review?: any, error?: string }>}
 */
export async function runCodeReview(options = {}) {
    // 1. Wymuszone oczyszczenie pamięci VRAM przed odprawieniem recenzji
    executeTacosGuard();

    return new Promise((resolve) => {
        let cmd = 'ocr review --format json';
        
        if (options.commit) {
            cmd += ` --commit ${options.commit}`;
        } else if (options.from && options.to) {
            cmd += ` --from ${options.from} --to ${options.to}`;
        }
        
        if (options.repo) {
            cmd += ` --repo "${options.repo}"`;
        }

        console.log(`[OCR AGENT] Uruchamianie komendy: ${cmd}`);

        // Uruchamiamy komendę z dużym buforem bo JSON z recenzji może być spory
        exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                console.error(`[OCR AGENT] Błąd komendy ocr:`, err.message);
                
                // Czasami ocr zwraca niezerowy kod gdy znajdzie defekty (standardowa konwencja lintera). 
                // Spróbujmy mimo to sparsować stdout.
                try {
                    const parsed = JSON.parse(stdout.trim());
                    return resolve({ success: true, review: parsed });
                } catch (_) {
                    return resolve({ success: false, error: err.message, details: stderr });
                }
            }

            try {
                const parsed = JSON.parse(stdout.trim());
                resolve({ success: true, review: parsed });
            } catch (parseErr) {
                console.error(`[OCR AGENT] Błąd parsowania wyjścia JSON:`, parseErr.message);
                resolve({ success: false, error: 'Błąd parsowania odpowiedzi OCR: ' + parseErr.message, raw: stdout });
            }
        });
    });
}
