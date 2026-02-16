import { db } from "../lib/firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';

/**
 * UZ$ Data Structure
 * Defines what we can smuggle across the border.
 */
export interface TeleportContext {
    action?: 'create_story' | 'create_music' | 'open_project';
    prompt?: string; // Np. "Mroczny Cyber-Mnich"
    projectId?: string;
    theme?: string;
    [key: string]: any; // Elastyczność dla przyszłych pomysłów
}

/**
 * Generates a "Teleport Ticket" (UZ$ Packet) for seamless SSO.
 * Transports Identity + Energy (API Key) + Context (The Mission) to satellite apps.
 * * @param targetUrl The destination URL (e.g., "https://teostory.studio")
 * @param user The current Firebase user object
 * @param context (Optional) The mission data/project specs
 * @returns The full redirect URL with the ticket parameter
 */
export const initiateTeleport = async (
    targetUrl: string,
    user: any,
    context?: TeleportContext
): Promise<string> => {
    try {
        if (!user || !user.uid) {
            throw new Error("User not authenticated");
        }

        const ticketId = uuidv4();
        const ticketRef = doc(db, "teleport_tickets", ticketId);

        // GORGOO: Extract Energy (API Key) from the Robust Storage
        // We check both the new 'v2' key and the old one as fallback
        let apiKey = localStorage.getItem('teo_neural_link_v2');

        if (!apiKey) {
            apiKey = localStorage.getItem('teo_gemini_api_key');
        }

        // Clean the key if it was stored as JSON string (remove quotes)
        if (apiKey && apiKey.startsWith('"') && apiKey.endsWith('"')) {
            try {
                apiKey = JSON.parse(apiKey);
            } catch (e) {
                // Keep as is if parse fails
            }
        }

        // Create UZ$ Packet in Firestore
        // This is the "Zip" file containing everything needed on the other side
        await setDoc(ticketRef, {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'TeOnaut',
            photoURL: user.photoURL || '',
            createdAt: serverTimestamp(),
            expiresAt: Date.now() + 60000, // 1 minute validity
            consumed: false,
            targetUrl: targetUrl,
            // ⚡ THE PAYLOAD: Transmitting the AI Key across domains
            apiKey: apiKey || null,
            // 📂 THE CONTEXT: Project data / Instructions
            context: context || null
        });

        // Construct the redirect URL
        const url = new URL(targetUrl);
        url.searchParams.append("ticket", ticketId);

        return url.toString();

    } catch (error) {
        console.error("Teleport failed (Permissions or Network):", error);
        console.warn("Bypassing ticket creation and redirecting directly to:", targetUrl);
        // Fallback: Return the original URL without a ticket
        return targetUrl;
    }
};