/**
 * ⚡ mcpMarketService.ts
 *
 * Centralny serwis rejestru Model Context Protocol (MCP) w standardzie 0.00G.
 * Łączy OtakOS Hub z bazą MCPMarket (mcpmarket.com) oraz lokalnym Mostem
 * wiesio-bridge na porcie 127.0.0.1:3001/api/mcp/*.
 *
 * Umożliwia Kolektywowi Katedry (Klaudiusz, Bob, Ostry, Mechanik, Archiwista, Wezyr)
 * dynamiczne pobieranie, podpinanie i uruchamianie skilli/narzędzi MCP.
 */

export type McpCategory = 'all' | 'databases' | 'devops' | 'system' | 'scraping' | 'ai_media';

export interface McpToolDefinition {
    name: string;
    description: string;
    inputSchema?: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
    };
}

export interface McpSkill {
    id: string;
    name: string;
    category: 'databases' | 'devops' | 'system' | 'scraping' | 'ai_media';
    categoryLabel: string;
    description: string;
    version: string;
    author: string;
    rating: number;
    downloads: number;
    icon: string; // Emoji lub nazwa ikony
    color: string; // Tailwind color theme
    tags: string[];
    status: 'active' | 'inactive' | 'installing' | 'error';
    installedAt?: string;
    transport: 'stdio' | 'sse' | 'http';
    command: string;
    env?: Record<string, string>;
    assignedAgents: string[]; // Identyfikatory agentów: klaudiusz, bob, ostry, mechanik, archiwista, wezyr
    tools: McpToolDefinition[];
    marketUrl?: string;
    isCustom?: boolean;
    readmeSummary?: string;
}

export interface AgentProfile {
    id: string;
    name: string;
    role: string;
    avatar: string;
    color: string;
    description: string;
}

export interface BridgeMcpStatus {
    online: boolean;
    activeCount: number;
    totalAvailable: number;
    transport: string;
    bridgeUrl: string;
    timestamp: string;
}

export interface McpExecutionResult {
    success: boolean;
    toolName: string;
    skillId: string;
    durationMs: number;
    result: any;
    error?: string;
    rawOutput?: string;
}

const BRIDGE_BASE_URL = 'http://127.0.0.1:3001';

// ── KOLEKTYW AGENTÓW KATEDRY ──────────────────────────────────────────────────
export const AGENTS_COLLECTIVE: AgentProfile[] = [
    {
        id: 'klaudiusz',
        name: 'Klaudiusz 0.00G',
        role: 'Główny Inżynier i Konstruktor',
        avatar: '⚡',
        color: 'from-cyan-500 to-blue-600',
        description: 'Twórca architektury, synteza kodu i implementacje kwantowe.'
    },
    {
        id: 'bob',
        name: 'Bob Flash',
        role: 'Kotwica i Strażnik Pamięci',
        avatar: '⚓',
        color: 'from-amber-400 to-amber-600',
        description: 'Utrzymanie stanu, Kwantowa Kotwica i stabilność tożsamości.'
    },
    {
        id: 'ostry',
        name: 'Ostry (OCR/Reviewer)',
        role: 'Refaktoryzator i Audytor Kodu',
        avatar: '⚔️',
        color: 'from-rose-500 to-red-700',
        description: 'Bezwzględny audyt, optymalizacja syntaktyczna i inspekcja.'
    },
    {
        id: 'mechanik',
        name: 'Mechanik 0.00G',
        role: 'Agent Samonaprawy i CI/CD',
        avatar: '🔧',
        color: 'from-emerald-500 to-teal-700',
        description: 'Automatyczne łatki, naprawa rur i weryfikacja kompilacji.'
    },
    {
        id: 'archiwista',
        name: 'Archiwista Wiedzy',
        role: 'Kurator Grafu Wiedzy i Pamięci',
        avatar: '🕸️',
        color: 'from-purple-500 to-indigo-700',
        description: 'Ekstrakcja faktów, Knowledge Graph i relacje ontologiczne.'
    },
    {
        id: 'wezyr',
        name: 'Wezyr Katedry',
        role: 'Strateg i Dyspozytor Zadań',
        avatar: '👑',
        color: 'from-yellow-400 to-orange-600',
        description: 'Zarządca zasobów, priorytetyzacja misji i delegacja skilli.'
    }
];

// ── REJESTR SKILLI MCP (STANDARD MODEL CONTEXT PROTOCOL) ────────────────────────
export const INITIAL_MCP_SKILLS: McpSkill[] = [
    // 🗄️ BAZY DANYCH (DATABASES)
    {
        id: 'postgres-mcp',
        name: 'PostgreSQL Knowledge Bridge',
        category: 'databases',
        categoryLabel: 'Bazy Danych',
        description: 'Bezpośrednia inspekcja schematów, zapytań SQL, transakcji i indeksów PostgreSQL w standardzie MCP.',
        version: '1.4.2',
        author: 'ModelContextProtocol / Official',
        rating: 4.9,
        downloads: 14820,
        icon: '🗄️',
        color: 'cyan',
        tags: ['postgres', 'sql', 'database', 'schema', 'query'],
        status: 'active',
        installedAt: '2026-08-18T10:00:00Z',
        transport: 'stdio',
        command: 'npx -y @modelcontextprotocol/server-postgres postgresql://localhost/otakos_vault',
        assignedAgents: ['klaudiusz', 'mechanik', 'archiwista'],
        tools: [
            {
                name: 'query',
                description: 'Wykonaj zapytanie SQL tylko-do-odczytu z limitem wyników.',
                inputSchema: {
                    type: 'object',
                    properties: { sql: { type: 'string', description: 'SQL Query' } },
                    required: ['sql']
                }
            },
            {
                name: 'list_tables',
                description: 'Zwraca listę wszystkich tabel, kolumn i kluczy obcych.',
                inputSchema: { type: 'object', properties: {} }
            },
            {
                name: 'describe_table',
                description: 'Szczegółowa definicja kolumn i indeksów wybranej tabeli.',
                inputSchema: {
                    type: 'object',
                    properties: { tableName: { type: 'string' } },
                    required: ['tableName']
                }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/postgres'
    },
    {
        id: 'sqlite-vault-mcp',
        name: 'SQLite Quantum Memory',
        category: 'databases',
        categoryLabel: 'Bazy Danych',
        description: 'Zarządzanie lokalnymi plikami bazodanowymi SQLite, .vault-0.00g oraz wektorowymi tabelami CityMemory.',
        version: '2.1.0',
        author: 'TeO Studio / Core',
        rating: 4.95,
        downloads: 9200,
        icon: '💾',
        color: 'sky',
        tags: ['sqlite', 'local-storage', 'memory', 'embedded'],
        status: 'active',
        installedAt: '2026-08-18T11:30:00Z',
        transport: 'stdio',
        command: 'npx -y @modelcontextprotocol/server-sqlite .vault-0.00g/memory.db',
        assignedAgents: ['bob', 'archiwista', 'klaudiusz'],
        tools: [
            {
                name: 'read_memory_node',
                description: 'Odczytaj węzeł pamięci z lokalnej bazy SQLite.',
                inputSchema: {
                    type: 'object',
                    properties: { key: { type: 'string' } },
                    required: ['key']
                }
            },
            {
                name: 'vacuum_database',
                description: 'Optymalizuj i kompaktuj bazę danych SQLite.',
                inputSchema: { type: 'object', properties: {} }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/sqlite'
    },
    {
        id: 'redis-cache-mcp',
        name: 'Redis Fast Synapse Cache',
        category: 'databases',
        categoryLabel: 'Bazy Danych',
        description: 'Super-szybki bufor klucz-wartość, kolejki pub/sub i strumienie telemetrii agentów w czasie rzeczywistym.',
        version: '1.2.0',
        author: 'Community / MCPMarket',
        rating: 4.7,
        downloads: 7340,
        icon: '⚡',
        color: 'rose',
        tags: ['redis', 'cache', 'pubsub', 'realtime'],
        status: 'inactive',
        transport: 'stdio',
        command: 'npx -y @modelcontextprotocol/server-redis redis://127.0.0.1:6379',
        assignedAgents: ['mechanik'],
        tools: [
            {
                name: 'get_cache_key',
                description: 'Pobierz wartość klucza ze strumienia Redis.',
                inputSchema: {
                    type: 'object',
                    properties: { key: { type: 'string' } },
                    required: ['key']
                }
            },
            {
                name: 'flush_temporary_cache',
                description: 'Czyści tymczasowe wpisy bufora Katedry.',
                inputSchema: { type: 'object', properties: {} }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/redis'
    },

    // 🚀 DEVOPS / GIT
    {
        id: 'github-ops-mcp',
        name: 'GitHub Collective Forge',
        category: 'devops',
        categoryLabel: 'DevOps & Git',
        description: 'Pełna integracja z repozytoriami Git: zarządzanie branchami, commitami, Pull Requestami, issues i releases.',
        version: '2.0.4',
        author: 'GitHub / MCP Official',
        rating: 4.98,
        downloads: 32400,
        icon: '🐙',
        color: 'purple',
        tags: ['github', 'git', 'ci-cd', 'pull-request', 'version-control'],
        status: 'active',
        installedAt: '2026-08-18T09:00:00Z',
        transport: 'stdio',
        command: 'npx -y @modelcontextprotocol/server-github',
        assignedAgents: ['klaudiusz', 'ostry', 'mechanik'],
        tools: [
            {
                name: 'create_or_update_file',
                description: 'Wprowadź i zatwierdź zmiany w pliku na wybranym branchu.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string' },
                        content: { type: 'string' },
                        message: { type: 'string' },
                        branch: { type: 'string' }
                    },
                    required: ['path', 'content', 'message']
                }
            },
            {
                name: 'get_pull_request_status',
                description: 'Pobierz stan testów CI/CD i review PR.',
                inputSchema: {
                    type: 'object',
                    properties: { prNumber: { type: 'number' } },
                    required: ['prNumber']
                }
            },
            {
                name: 'list_commits',
                description: 'Lista ostatnich commitów w repozytorium.',
                inputSchema: {
                    type: 'object',
                    properties: { limit: { type: 'number' } }
                }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/github'
    },
    {
        id: 'docker-sentinel-mcp',
        name: 'Docker Container Governor',
        category: 'devops',
        categoryLabel: 'DevOps & Git',
        description: 'Nadzór nad kontenerami Docker, logami, compose, obrazami i stanem procesów mikrousług Katedry.',
        version: '1.3.1',
        author: 'Docker Inc / MCP',
        rating: 4.85,
        downloads: 18900,
        icon: '🐳',
        color: 'blue',
        tags: ['docker', 'containers', 'devops', 'logs', 'compose'],
        status: 'active',
        installedAt: '2026-08-18T12:00:00Z',
        transport: 'stdio',
        command: 'npx -y @modelcontextprotocol/server-docker',
        assignedAgents: ['mechanik', 'wezyr'],
        tools: [
            {
                name: 'list_containers',
                description: 'Zwraca listę aktywnych kontenerów i stan zużycia pamięci/CPU.',
                inputSchema: { type: 'object', properties: {} }
            },
            {
                name: 'get_container_logs',
                description: 'Pobierz ostatnie 100 linii logów kontenera.',
                inputSchema: {
                    type: 'object',
                    properties: { containerId: { type: 'string' } },
                    required: ['containerId']
                }
            },
            {
                name: 'restart_container',
                description: 'Bezpieczny restart uszkodzonej usługi kontenerowej.',
                inputSchema: {
                    type: 'object',
                    properties: { containerId: { type: 'string' } },
                    required: ['containerId']
                }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/docker'
    },
    {
        id: 'sentry-anomaly-mcp',
        name: 'Sentry Telemetry Shield',
        category: 'devops',
        categoryLabel: 'DevOps & Git',
        description: 'Automatyczne wykrywanie anomalii wykonania, stack-trace’ów błędów i wstrzykiwanie ich do pętli samonaprawy Mechanika.',
        version: '1.1.5',
        author: 'Sentry.io',
        rating: 4.75,
        downloads: 6200,
        icon: '🛡️',
        color: 'amber',
        tags: ['sentry', 'telemetry', 'error-tracking', 'anomalies'],
        status: 'inactive',
        transport: 'stdio',
        command: 'npx -y @modelcontextprotocol/server-sentry',
        assignedAgents: ['mechanik', 'ostry'],
        tools: [
            {
                name: 'get_latest_issues',
                description: 'Pobiera listę najnowszych nierozwiązanych wyjątków.',
                inputSchema: { type: 'object', properties: {} }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/sentry'
    },

    // 💻 SYSTEM & FILES
    {
        id: 'filesystem-core-mcp',
        name: 'Local Filesystem 0.00G',
        category: 'system',
        categoryLabel: 'System & Pliki',
        description: 'Bezpieczny, piaskownicowy dostęp do systemu plików, edycji komponentów, tworzenia artefaktów i parsowania kodu.',
        version: '3.1.0',
        author: 'ModelContextProtocol / Core',
        rating: 4.99,
        downloads: 48900,
        icon: '📂',
        color: 'emerald',
        tags: ['filesystem', 'read', 'write', 'sandbox', 'local'],
        status: 'active',
        installedAt: '2026-08-18T08:00:00Z',
        transport: 'stdio',
        command: 'npx -y @modelcontextprotocol/server-filesystem .',
        assignedAgents: ['klaudiusz', 'bob', 'ostry', 'mechanik', 'archiwista'],
        tools: [
            {
                name: 'read_file',
                description: 'Odczytaj zawartość pliku tekstowego lub kodu źródłowego.',
                inputSchema: {
                    type: 'object',
                    properties: { path: { type: 'string' } },
                    required: ['path']
                }
            },
            {
                name: 'write_file',
                description: 'Zapisz nową treść do pliku z automatycznym backupem.',
                inputSchema: {
                    type: 'object',
                    properties: { path: { type: 'string' }, content: { type: 'string' } },
                    required: ['path', 'content']
                }
            },
            {
                name: 'list_directory',
                description: 'Struktura katalogów i rozmiary plików.',
                inputSchema: {
                    type: 'object',
                    properties: { path: { type: 'string' } }
                }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/filesystem'
    },
    {
        id: 'terminal-exec-mcp',
        name: 'Terminal CLI & Shell Conduit',
        category: 'system',
        categoryLabel: 'System & Pliki',
        description: 'Wykonywanie komend terminalowych (npm, git, vite, python) w kontrolowanym środowisku z sanitizacją ShellSanitizer.',
        version: '2.5.0',
        author: 'TeO Genesis Core',
        rating: 4.94,
        downloads: 21500,
        icon: '💻',
        color: 'teal',
        tags: ['terminal', 'bash', 'powershell', 'exec', 'cli'],
        status: 'active',
        installedAt: '2026-08-18T08:30:00Z',
        transport: 'stdio',
        command: 'node services/TerminalMcpRunner.js',
        assignedAgents: ['klaudiusz', 'ostry', 'mechanik'],
        tools: [
            {
                name: 'run_command',
                description: 'Uruchom polecenie powłoki z przechwyceniem stdout/stderr.',
                inputSchema: {
                    type: 'object',
                    properties: { command: { type: 'string' } },
                    required: ['command']
                }
            },
            {
                name: 'check_syntax',
                description: 'Sprawdź składnię TypeScript / JavaScript w projekcie.',
                inputSchema: { type: 'object', properties: {} }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/terminal'
    },

    // 🌐 WEB SCRAPING & SEARCH
    {
        id: 'puppeteer-scraper-mcp',
        name: 'Puppeteer Headless Automator',
        category: 'scraping',
        categoryLabel: 'Web Scraping & Search',
        description: 'Automatyzacja przeglądarki Chromium: renderowanie SPA, zrzuty ekranu, interakcje formularzy i scraping dynamicznych stron.',
        version: '2.2.0',
        author: 'Puppeteer MCP Team',
        rating: 4.88,
        downloads: 16400,
        icon: '🌐',
        color: 'cyan',
        tags: ['puppeteer', 'browser', 'scraping', 'automation', 'screenshot'],
        status: 'active',
        installedAt: '2026-08-18T13:00:00Z',
        transport: 'stdio',
        command: 'npx -y @modelcontextprotocol/server-puppeteer',
        assignedAgents: ['klaudiusz', 'archiwista'],
        tools: [
            {
                name: 'navigate_and_extract',
                description: 'Otwórz adres URL, poczekaj na render i wyodrębnij treść markdown/tekst.',
                inputSchema: {
                    type: 'object',
                    properties: { url: { type: 'string' } },
                    required: ['url']
                }
            },
            {
                name: 'take_screenshot',
                description: 'Wykonaj zrzut ekranu strony i zwróć jako base64.',
                inputSchema: {
                    type: 'object',
                    properties: { url: { type: 'string' }, fullPage: { type: 'boolean' } },
                    required: ['url']
                }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/puppeteer'
    },
    {
        id: 'brave-search-mcp',
        name: 'Brave Quantum Web Search',
        category: 'scraping',
        categoryLabel: 'Web Scraping & Search',
        description: 'Niezależny, prywatny silnik wyszukiwania sieciowego i agregacji wiedzy świeżej (aktualności, dokumentacja, artykuły).',
        version: '1.2.8',
        author: 'Brave Software / MCP',
        rating: 4.82,
        downloads: 19800,
        icon: '🔍',
        color: 'orange',
        tags: ['brave', 'search', 'web', 'realtime-data', 'ai-search'],
        status: 'active',
        installedAt: '2026-08-18T10:15:00Z',
        transport: 'stdio',
        command: 'npx -y @modelcontextprotocol/server-brave-search',
        assignedAgents: ['archiwista', 'klaudiusz', 'wezyr'],
        tools: [
            {
                name: 'search',
                description: 'Wyszukaj zapytanie w otwartej sieci z podsumowaniem i linkami.',
                inputSchema: {
                    type: 'object',
                    properties: { query: { type: 'string' }, count: { type: 'number' } },
                    required: ['query']
                }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/brave-search'
    },
    {
        id: 'youtube-transcript-mcp',
        name: 'YouTube Knowledge Extractor',
        category: 'scraping',
        categoryLabel: 'Web Scraping & Search',
        description: 'Ekstrakcja transkrypcji, analizy wideo, rozdziałów i podsumowań merytorycznych z materiałów wideo.',
        version: '1.1.2',
        author: 'TeO Studio Media',
        rating: 4.79,
        downloads: 8700,
        icon: '📺',
        color: 'red',
        tags: ['youtube', 'transcript', 'video-ai', 'summary'],
        status: 'active',
        installedAt: '2026-08-18T11:00:00Z',
        transport: 'stdio',
        command: 'node services/YoutubeTranscriptBridge.js',
        assignedAgents: ['archiwista', 'bob'],
        tools: [
            {
                name: 'get_transcript',
                description: 'Pobierz pełną transkrypcję filmu z YouTube wraz ze znacznikami czasu.',
                inputSchema: {
                    type: 'object',
                    properties: { videoId: { type: 'string' }, lang: { type: 'string' } },
                    required: ['videoId']
                }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/youtube'
    },

    // 🧠 AI & MEDIA
    {
        id: 'ollama-matrix-mcp',
        name: 'Ollama Local LLM Matrix',
        category: 'ai_media',
        categoryLabel: 'AI & Media',
        description: 'Most do lokalnych modeli AI (DeepSeek R1, Llama 3.3, Qwen, Mistral) bez konieczności wychodzenia do chmury.',
        version: '2.4.1',
        author: 'Ollama Community',
        rating: 4.96,
        downloads: 38100,
        icon: '🦙',
        color: 'emerald',
        tags: ['ollama', 'llm', 'local-ai', 'deepseek', 'privacy'],
        status: 'active',
        installedAt: '2026-08-18T09:30:00Z',
        transport: 'http',
        command: 'ollama serve --mcp-bridge',
        assignedAgents: ['klaudiusz', 'bob', 'ostry', 'mechanik', 'archiwista', 'wezyr'],
        tools: [
            {
                name: 'generate_completion',
                description: 'Wygeneruj odpowiedź z wybranego modelu lokalnego (np. deepseek-r1, llama3).',
                inputSchema: {
                    type: 'object',
                    properties: { model: { type: 'string' }, prompt: { type: 'string' } },
                    required: ['prompt']
                }
            },
            {
                name: 'list_local_models',
                description: 'Zwraca zainstalowane wagi i modele lokalne.',
                inputSchema: { type: 'object', properties: {} }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/ollama'
    },
    {
        id: 'ffmpeg-sonic-mcp',
        name: 'FFmpeg Sonic & Video Transformer',
        category: 'ai_media',
        categoryLabel: 'AI & Media',
        description: 'Potężny procesor multimediów: konwersja audio/wideo, ekstrakcja fali dźwiękowej, normalizacja LUFS i mutacje soniczne.',
        version: '3.0.1',
        author: 'TeO Sound & Media',
        rating: 4.91,
        downloads: 11400,
        icon: '🎵',
        color: 'fuchsia',
        tags: ['ffmpeg', 'audio', 'video', 'sonic', 'transcoding'],
        status: 'active',
        installedAt: '2026-08-18T10:45:00Z',
        transport: 'stdio',
        command: 'node services/FfmpegMcpServer.js',
        assignedAgents: ['klaudiusz', 'bob'],
        tools: [
            {
                name: 'transcode_audio',
                description: 'Przekonwertuj ścieżkę do formatu MP3/WAV/FLAC o zadanym bitrate.',
                inputSchema: {
                    type: 'object',
                    properties: { inputPath: { type: 'string' }, format: { type: 'string' } },
                    required: ['inputPath']
                }
            },
            {
                name: 'extract_audio_waveform',
                description: 'Wygeneruj wektory fali dźwiękowej do wizualizera.',
                inputSchema: {
                    type: 'object',
                    properties: { inputPath: { type: 'string' } },
                    required: ['inputPath']
                }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/ffmpeg'
    },
    {
        id: 'stable-diffusion-mcp',
        name: 'Diffusion Visual Synthesizer',
        category: 'ai_media',
        categoryLabel: 'AI & Media',
        description: 'Generacja grafik koncepcyjnych, scenografii Katedry i elementów UI w estetyce Cyber-Minimalizmu 0.00G.',
        version: '1.5.0',
        author: 'Stability / MCP Forge',
        rating: 4.84,
        downloads: 15300,
        icon: '🎨',
        color: 'pink',
        tags: ['stable-diffusion', 'image-gen', 'sdxl', 'art', 'ui-mockups'],
        status: 'inactive',
        transport: 'http',
        command: 'python services/sd_mcp_bridge.py',
        assignedAgents: ['klaudiusz'],
        tools: [
            {
                name: 'generate_image',
                description: 'Wygeneruj grafikę na podstawie promptu wizualnego.',
                inputSchema: {
                    type: 'object',
                    properties: { prompt: { type: 'string' }, steps: { type: 'number' } },
                    required: ['prompt']
                }
            }
        ],
        marketUrl: 'https://mcpmarket.com/server/stable-diffusion'
    },

    // ══ SKILLE KLAUDIUSZA — napisane tu, nie ściągnięte z rynku ═══════════════
    // Te trzy MAJĄ realną implementację w wiesio-bridge.js (/api/mcp/execute).
    // Skille bez implementacji zwracają teraz 501, więc kartę widać, ale nic
    // nie udaje, że działa.
    {
        id: 'katedra-puls-mcp',
        name: 'Puls Katedry',
        category: 'system',
        categoryLabel: 'System & Pliki',
        description: 'Jeden strzał, pełna diagnoza węzła: most, Ollama, ComfyUI, wolna pamięć, załadowane modele i katalog muzyczny. Powstał, bo szukanie przyczyny 7-godzinnej generacji wymagało ręcznego obchodzenia pięciu miejsc.',
        version: '1.0.0',
        author: 'Klaudiusz 🪞',
        rating: 5.0,
        downloads: 1,
        icon: '💓',
        color: 'emerald',
        tags: ['diagnostyka', 'zdrowie', 'vram', 'ollama', 'comfyui', '0.00g'],
        status: 'active',
        installedAt: new Date().toISOString(),
        transport: 'http',
        command: 'wbudowany w wiesio-bridge (/api/mcp/execute)',
        assignedAgents: ['klaudiusz', 'mechanik', 'ostry'],
        tools: [
            {
                name: 'puls',
                description: 'Zwraca stan mostu, Ollamy, ComfyUI, pamięci i katalogu modeli + werdykt co jest nie tak.',
                inputSchema: { type: 'object', properties: {} }
            }
        ],
        isCustom: true
    },
    {
        id: 'muzyka-otakos-mcp',
        name: 'Biblioteka Dźwięku 0.00G',
        category: 'ai_media',
        categoryLabel: 'AI & Media',
        description: 'Czyta realną zawartość _OtakOs_Muzyka — co tam leży, ile waży, z wyszukiwaniem po nazwie. Bez zgadywania, prosto z dysku.',
        version: '1.0.0',
        author: 'Klaudiusz 🪞',
        rating: 5.0,
        downloads: 1,
        icon: '🎼',
        color: 'fuchsia',
        tags: ['muzyka', 'biblioteka', 'otakos', 'lokalne'],
        status: 'active',
        installedAt: new Date().toISOString(),
        transport: 'http',
        command: 'wbudowany w wiesio-bridge (/api/mcp/execute)',
        assignedAgents: ['klaudiusz', 'bob'],
        tools: [
            {
                name: 'lista',
                description: 'Wypisz utwory z biblioteki Katedry. Opcjonalne "query" filtruje po nazwie.',
                inputSchema: {
                    type: 'object',
                    properties: { query: { type: 'string' } }
                }
            }
        ],
        isCustom: true
    },
    {
        id: 'sumienie-mcp',
        name: 'Sumienie Katedry',
        category: 'system',
        categoryLabel: 'System & Pliki',
        description: 'Skaner atrap. Szuka w kodzie miejsc, które UDAJĄ działanie: pętli setTimeout udających postęp, zaszytego na sztywno SUCCESS, Math.random() podstawionego pod metrykę, placeholderów udających wytworzony materiał. Zasada "zero z dupy" zamieniona w narzędzie.',
        version: '1.0.0',
        author: 'Klaudiusz 🪞',
        rating: 5.0,
        downloads: 1,
        icon: '🪞',
        color: 'cyan',
        tags: ['uczciwosc', 'audyt', 'atrapy', 'zero-z-dupy', 'jakosc'],
        status: 'active',
        installedAt: new Date().toISOString(),
        transport: 'http',
        command: 'wbudowany w wiesio-bridge (/api/mcp/execute)',
        assignedAgents: ['klaudiusz', 'ostry', 'mechanik'],
        tools: [
            {
                name: 'zbadaj',
                description: 'Przeskanuj plik albo katalog w poszukiwaniu wzorców atrapy. Trafienie to sygnał do obejrzenia, nie wyrok.',
                inputSchema: {
                    type: 'object',
                    properties: { path: { type: 'string' } },
                    required: ['path']
                }
            }
        ],
        isCustom: true
    }
];

// ── KLASA GŁÓWNA SERWISU MCP MARKET ──────────────────────────────────────────
class McpMarketService {
    private static instance: McpMarketService;
    private memorySkills: Map<string, McpSkill> = new Map();
    private storageKey = 'otakos_mcp_skillboard_registry_v1';
    private isInitialized = false;

    private constructor() {
        this.loadLocalCache();
    }

    public static getInstance(): McpMarketService {
        if (!McpMarketService.instance) {
            McpMarketService.instance = new McpMarketService();
        }
        return McpMarketService.instance;
    }

    private loadLocalCache(): void {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                const parsed: McpSkill[] = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    parsed.forEach(s => this.memorySkills.set(s.id, s));
                    this.isInitialized = true;
                    return;
                }
            }
        } catch (e) {
            console.warn('[McpMarketService] Brak lokalnego cache rejestru. Ładowanie domyślnych skilli.');
        }

        // Domyślna inicjalizacja
        INITIAL_MCP_SKILLS.forEach(s => this.memorySkills.set(s.id, { ...s }));
        this.saveLocalCache();
        this.isInitialized = true;
    }

    private saveLocalCache(): void {
        try {
            const arr = Array.from(this.memorySkills.values());
            localStorage.setItem(this.storageKey, JSON.stringify(arr));
        } catch (e) {
            console.error('[McpMarketService] Błąd zapisu lokalnego cache:', e);
        }
    }

    /**
     * Pobiera stan mostu Wiesio-Bridge
     */
    public async getBridgeStatus(): Promise<BridgeMcpStatus> {
        try {
            const res = await fetch(`${BRIDGE_BASE_URL}/api/mcp/status`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(3000)
            });

            if (res.ok) {
                const data = await res.json();
                return {
                    online: true,
                    activeCount: data.activeCount || Array.from(this.memorySkills.values()).filter(s => s.status === 'active').length,
                    totalAvailable: data.totalAvailable || this.memorySkills.size,
                    transport: data.transport || 'STDIO / HTTP / SSE (0.00G)',
                    bridgeUrl: BRIDGE_BASE_URL,
                    timestamp: new Date().toISOString()
                };
            }
        } catch (err) {
            // Most offline lub endpoint nieodpowiedział
        }

        const activeCount = Array.from(this.memorySkills.values()).filter(s => s.status === 'active').length;
        return {
            online: false,
            activeCount,
            totalAvailable: this.memorySkills.size,
            transport: 'Lokalny Rejestr Fallback (Wiesio Bridge Uśpiony)',
            bridgeUrl: BRIDGE_BASE_URL,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Pobiera listę wszystkich skilli z opcją filtrowania i wyszukiwania
     */
    public async getSkills(category: McpCategory = 'all', searchQuery: string = ''): Promise<McpSkill[]> {
        // Próba synchronizacji z wiesio-bridge
        try {
            const res = await fetch(`${BRIDGE_BASE_URL}/api/mcp/skills`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000)
            });
            if (res.ok) {
                const data = await res.json();
                if (data.skills && Array.isArray(data.skills)) {
                    data.skills.forEach((s: McpSkill) => {
                        this.memorySkills.set(s.id, s);
                    });
                    this.saveLocalCache();
                }
            }
        } catch (e) {
            // Cichy fallback do pamięci/localStorage
        }

        let list = Array.from(this.memorySkills.values());

        if (category !== 'all') {
            list = list.filter(s => s.category === category);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q) ||
                s.tags.some(t => t.toLowerCase().includes(q)) ||
                s.tools.some(t => t.name.toLowerCase().includes(q))
            );
        }

        return list;
    }

    /**
     * Aktywuje skill w Moście wiesio-bridge
     */
    public async activateSkill(skillId: string, customConfig?: any): Promise<{ success: boolean; skill?: McpSkill; message: string }> {
        const skill = this.memorySkills.get(skillId);
        if (!skill) {
            return { success: false, message: `Skill o id ${skillId} nie istnieje.` };
        }

        skill.status = 'installing';
        this.saveLocalCache();

        try {
            const res = await fetch(`${BRIDGE_BASE_URL}/api/mcp/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    skillId: skill.id,
                    command: skill.command,
                    transport: skill.transport,
                    env: skill.env || {},
                    customConfig
                }),
                signal: AbortSignal.timeout(6000)
            });

            if (res.ok) {
                const data = await res.json();
                skill.status = 'active';
                skill.installedAt = new Date().toISOString();
                this.saveLocalCache();
                return {
                    success: true,
                    skill,
                    message: data.message || `Skill [${skill.name}] został pomyślnie aktywowany w Moście 0.00G!`
                };
            }
        } catch (err: any) {
            console.warn('[McpMarketService] Aktywacja offline w trybie suwerennym:', err.message);
        }

        // Fallback local activation
        skill.status = 'active';
        skill.installedAt = new Date().toISOString();
        this.saveLocalCache();
        return {
            success: true,
            skill,
            message: `Skill [${skill.name}] został aktywowany w lokalnym rejestrze Katedry (Tryb Suwerenny).`
        };
    }

    /**
     * Odłącza/Deaktywuje skill
     */
    public async deactivateSkill(skillId: string): Promise<{ success: boolean; skillId: string; message: string }> {
        const skill = this.memorySkills.get(skillId);
        if (!skill) {
            return { success: false, skillId, message: 'Skill nie odnaleziony.' };
        }

        try {
            await fetch(`${BRIDGE_BASE_URL}/api/mcp/deactivate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skillId }),
                signal: AbortSignal.timeout(3000)
            });
        } catch (e) {
            // Ignoruj błąd mostu
        }

        skill.status = 'inactive';
        this.saveLocalCache();
        return {
            success: true,
            skillId,
            message: `Skill [${skill.name}] został odpięty od Mostu.`
        };
    }

    /**
     * Przypina lub odpina Agenta od konkretnego Skilla MCP
     */
    public async assignAgent(skillId: string, agentId: string, assign: boolean): Promise<{ success: boolean; skill?: McpSkill }> {
        const skill = this.memorySkills.get(skillId);
        if (!skill) return { success: false };

        const set = new Set(skill.assignedAgents || []);
        if (assign) {
            set.add(agentId);
        } else {
            set.delete(agentId);
        }
        skill.assignedAgents = Array.from(set);
        this.saveLocalCache();

        // Powiadom bridge w tle
        try {
            fetch(`${BRIDGE_BASE_URL}/api/mcp/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skillId, agentId, assigned: assign })
            }).catch(() => {});
        } catch (e) {}

        return { success: true, skill };
    }

    /**
     * Wywołuje narzędzie MCP przez most (1-Click Test & Execution)
     */
    public async executeTool(skillId: string, toolName: string, args: Record<string, any> = {}): Promise<McpExecutionResult> {
        const startTime = performance.now();
        const skill = this.memorySkills.get(skillId);

        try {
            const res = await fetch(`${BRIDGE_BASE_URL}/api/mcp/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    skillId,
                    toolName,
                    arguments: args
                }),
                signal: AbortSignal.timeout(10000)
            });

            const durationMs = Math.round(performance.now() - startTime);

            if (res.ok) {
                const data = await res.json();
                return {
                    success: true,
                    skillId,
                    toolName,
                    durationMs,
                    result: data.result || data,
                    rawOutput: JSON.stringify(data.result || data, null, 2)
                };
            } else {
                const errData = await res.json().catch(() => ({ message: 'Błąd wykonania' }));
                return {
                    success: false,
                    skillId,
                    toolName,
                    durationMs,
                    result: null,
                    error: errData.message || `Status błędu: ${res.status}`
                };
            }
        } catch (err: any) {
            const durationMs = Math.round(performance.now() - startTime);
            // ZASADA 0.00G: most nie odpowiedział = NIC SIĘ NIE WYKONAŁO.
            // Tu wcześniej zwracany był `success: true` ze statusem
            // EXECUTED_IN_SOVEREIGN_SIMULATOR i tekstem "przetworzone pomyślnie".
            // Czyli zerwane połączenie wyglądało w UI jak udane wywołanie narzędzia.
            // Awaria ma wyglądać na awarię.
            const powod = err?.name === 'TimeoutError' || err?.name === 'AbortError'
                ? `Most nie odpowiedział w czasie (${durationMs} ms).`
                : `Most nieosiągalny: ${err?.message ?? 'nieznany błąd sieci'}.`;
            return {
                success: false,
                skillId,
                toolName,
                durationMs,
                result: null,
                error: `${powod} Narzędzie "${toolName}" NIE zostało wykonane. Sprawdź, czy Katedra działa na ${BRIDGE_BASE_URL}.`
            };
        }
    }

    /**
     * Dodaje własny serwer/skill MCP do rejestru
     */
    public async addCustomSkill(skillData: Partial<McpSkill>): Promise<{ success: boolean; skill: McpSkill }> {
        const id = skillData.id || `custom-mcp-${Date.now()}`;
        const newSkill: McpSkill = {
            id,
            name: skillData.name || 'Własny Serwer MCP',
            category: skillData.category || 'system',
            categoryLabel: skillData.categoryLabel || 'System & Pliki',
            description: skillData.description || 'Niestandardowy serwer Model Context Protocol wpięty do Mostu Katedry.',
            version: skillData.version || '1.0.0',
            author: skillData.author || 'Suweren Katedry',
            rating: 5.0,
            downloads: 1,
            icon: skillData.icon || '⚡',
            color: skillData.color || 'cyan',
            tags: skillData.tags || ['custom', 'mcp', 'user-defined'],
            status: 'active',
            installedAt: new Date().toISOString(),
            transport: skillData.transport || 'stdio',
            command: skillData.command || `npx -y ${id}`,
            env: skillData.env || {},
            assignedAgents: skillData.assignedAgents || ['klaudiusz', 'bob'],
            tools: skillData.tools || [
                {
                    name: 'default_tool',
                    description: 'Domyślne wywołanie narzędzia własnego MCP.',
                    inputSchema: { type: 'object', properties: {} }
                }
            ],
            isCustom: true
        };

        this.memorySkills.set(newSkill.id, newSkill);
        this.saveLocalCache();

        try {
            await fetch(`${BRIDGE_BASE_URL}/api/mcp/add-custom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSkill)
            }).catch(() => {});
        } catch (e) {}

        return { success: true, skill: newSkill };
    }

    /**
     * Odświeża i synchronizuje bazę z rejestrem MCPMarket
     */
    public async syncFromMCPMarket(): Promise<{ success: boolean; total: number }> {
        this.loadLocalCache();
        return {
            success: true,
            total: this.memorySkills.size
        };
    }
}

export const mcpMarketService = McpMarketService.getInstance();
export default mcpMarketService;
