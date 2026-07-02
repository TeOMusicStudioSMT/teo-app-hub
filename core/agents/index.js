import fs from 'fs/promises';
import path from 'path';

const PROFILES_DIR = path.join(process.cwd(), 'core', 'agents', 'profiles');

/**
 * Parsuje plik markdown z frontmatter
 * @param {string} content 
 * @returns {{ metadata: Record<string, string>, body: string }}
 */
export function parseMarkdown(content) {
    const metadata = {};
    let body = content;

    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (match) {
        const yamlBlock = match[1];
        body = content.slice(match[0].length).trim();

        const lines = yamlBlock.split('\n');
        for (const line of lines) {
            const separatorIndex = line.indexOf(':');
            if (separatorIndex !== -1) {
                const key = line.slice(0, separatorIndex).trim();
                let value = line.slice(separatorIndex + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                metadata[key] = value;
            }
        }
    }

    return { metadata, body };
}

/**
 * Zwraca listę wszystkich dostępnych agentów z ich metadanymi.
 */
export async function getAgentsList() {
    try {
        await fs.mkdir(PROFILES_DIR, { recursive: true });
        const files = await fs.readdir(PROFILES_DIR);
        const agents = [];

        for (const file of files) {
            if (file.endsWith('.md')) {
                const filePath = path.join(PROFILES_DIR, file);
                const content = await fs.readFile(filePath, 'utf8');
                const { metadata } = parseMarkdown(content);
                
                const id = path.basename(file, '.md');
                agents.push({
                    id,
                    name: metadata.name || id,
                    description: metadata.description || '',
                    color: metadata.color || 'slate',
                    emoji: metadata.emoji || '🤖',
                    vibe: metadata.vibe || ''
                });
            }
        }
        return agents;
    } catch (e) {
        console.error('[Agents Registry] Błąd wczytywania listy agentów:', e);
        return [];
    }
}

/**
 * Zwraca system prompt danego agenta.
 */
export async function getAgentPrompt(id) {
    try {
        const filePath = path.join(PROFILES_DIR, `${id}.md`);
        const content = await fs.readFile(filePath, 'utf8');
        const { body } = parseMarkdown(content);
        return body;
    } catch (e) {
        console.warn(`[Agents Registry] Nie znaleziono profilu agenta o id: ${id}`);
        return null;
    }
}

// Helper to load config value asynchronously
async function getEnvValue(key, defaultValue) {
    if (process.env[key]) {
        return process.env[key];
    }
    try {
        const envPath = path.join(process.cwd(), '.env');
        const content = await fs.readFile(envPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
            const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
            if (match && match[1] === key) {
                let val = match[2].trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                return val;
            }
        }
    } catch (e) {
        // ignore
    }
    return defaultValue;
}

/**
 * Zwraca system prompt z dołączonym nadrzędnym filtrem (Master Agent), jeśli jest ustawiony.
 */
export async function getMergedSystemPrompt(id, baseSystem = '') {
    let merged = baseSystem || '';
    
    // 1. Jeśli przekazano ID konkretnego agenta, pobieramy jego prompt
    if (id) {
        const agentPrompt = await getAgentPrompt(id);
        if (agentPrompt) {
            merged = agentPrompt + (merged ? '\n\n' + merged : '');
        }
    }
    
    // 2. Jeśli jest skonfigurowany globalny nadrzędny agent Multica, również go dołączamy
    const masterAgent = await getEnvValue('MULTICA_MASTER_AGENT', '');
    if (masterAgent && masterAgent !== id) {
        const masterPrompt = await getAgentPrompt(masterAgent);
        if (masterPrompt) {
            merged = masterPrompt + (merged ? '\n\n' + masterPrompt : '');
        }
    }
    
    return merged;
}
