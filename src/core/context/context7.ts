import { setTimeout as delay } from "node:timers/promises";

export interface Context7ProjectRecord {
    settings?: {
        project?: string;
        title?: string;
        tags?: string[];
        docsRepoUrl?: string;
    };
    version?: {
        lastUpdate?: string;
        totalPages?: number;
        totalSnippets?: number;
    };
}

export interface Context7Insight {
    projectPath: string;
    projectTitle?: string;
    topic: string;
    content: string;
    sourceUrl: string;
    lastUpdate?: string;
}

export interface Context7Result {
    insights: Context7Insight[];
    warnings: string[];
}

const API_BASE_URL = "https://context7.com";
const PROJECTS_ENDPOINT = `${API_BASE_URL}/api/projects`;
const USER_AGENT = "orka-mcp/0.0.1";
const MAX_RETRIES = 2;

let projectCache: Context7ProjectRecord[] | undefined;

class Context7Error extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = "Context7Error";
    }
}

const fetchJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
    const fetchFn = globalThis.fetch;
    if (!fetchFn) {
        throw new Context7Error("Global fetch API is not available in this runtime.");
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            const response = await fetchFn(url, {
                headers: {
                    "User-Agent": USER_AGENT,
                },
                signal,
            });

            if (!response.ok) {
                throw new Context7Error(`Context7 request failed (${response.status} ${response.statusText})`);
            }

            return (await response.json()) as T;
        } catch (error) {
            const isLastAttempt = attempt === MAX_RETRIES;
            if (isLastAttempt || error instanceof Context7Error) {
                throw error instanceof Context7Error ? error : new Context7Error("Context7 request failed", error);
            }

            const baseDelay = 200 * 2 ** attempt;
            const jitter = Math.random() * 100;
            await delay(baseDelay + jitter);
        }
    }

    throw new Context7Error("Context7 retry loop exhausted");
};

const fetchText = async (url: string, signal?: AbortSignal): Promise<string> => {
    const fetchFn = globalThis.fetch;
    if (!fetchFn) {
        throw new Context7Error("Global fetch API is not available in this runtime.");
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            const response = await fetchFn(url, {
                headers: {
                    "User-Agent": USER_AGENT,
                },
                signal,
            });

            if (!response.ok) {
                throw new Context7Error(`Context7 request failed (${response.status} ${response.statusText})`);
            }

            return await response.text();
        } catch (error) {
            const isLastAttempt = attempt === MAX_RETRIES;
            if (isLastAttempt || error instanceof Context7Error) {
                throw error instanceof Context7Error ? error : new Context7Error("Context7 request failed", error);
            }

            const baseDelay = 200 * 2 ** attempt;
            const jitter = Math.random() * 100;
            await delay(baseDelay + jitter);
        }
    }

    throw new Context7Error("Context7 retry loop exhausted");
};

const normalise = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const ensureLeadingSlash = (value: string): string => (value.startsWith("/") ? value : `/${value}`);

const scoreProject = (project: Context7ProjectRecord, term: string): number => {
    const normalisedTerm = normalise(term);
    if (!project?.settings?.project) {
        return 0;
    }

    const path = project.settings.project;
    const title = project.settings.title ?? "";
    const tags = project.settings.tags ?? [];
    const pathNormalised = normalise(path);
    const pathLeaf = normalise(path.split("/").pop() ?? "");
    const titleNormalised = normalise(title);

    let score = 0;

    if (pathNormalised === normalisedTerm) score = Math.max(score, 10);
    if (pathLeaf === normalisedTerm) score = Math.max(score, 9);
    if (titleNormalised === normalisedTerm) score = Math.max(score, 8);
    if (pathNormalised.includes(normalisedTerm)) score = Math.max(score, 6);
    if (titleNormalised.includes(normalisedTerm)) score = Math.max(score, 5);

    for (const tag of tags) {
        if (normalise(tag) === normalisedTerm) {
            score = Math.max(score, 7);
            break;
        }
    }

    if (project.version?.lastUpdate) {
        score += 0.25;
    }

    return score;
};

export const loadContext7Projects = async (): Promise<Context7ProjectRecord[]> => {
    if (projectCache) {
        return projectCache;
    }

    try {
        const projects = await fetchJson<Context7ProjectRecord[]>(PROJECTS_ENDPOINT);
        projectCache = Array.isArray(projects) ? projects : [];
        return projectCache;
    } catch (error) {
        throw new Context7Error("Failed to fetch Context7 project catalog", error);
    }
};

const resolveProject = async (term: string): Promise<Context7ProjectRecord | undefined> => {
    const projects = await loadContext7Projects();
    let best: { project: Context7ProjectRecord; score: number } | undefined;

    for (const project of projects) {
        const score = scoreProject(project, term);
        if (score <= 0) continue;
        if (!best || score > best.score) {
            best = { project, score };
        }
    }

    return best?.project;
};

const buildTopic = (tech: string, prompt: string): string =>
    `Latest official guidance (2025) for ${tech} relevant to: ${prompt}`;

const truncateContent = (value: string, limit: number): string => {
    if (value.length <= limit) {
        return value.trim();
    }

    return `${value.slice(0, limit - 3).trim()}...`;
};

export const fetchContext7Insights = async (
    techCandidates: string[],
    prompt: string,
    options?: { maxProjects?: number; tokenLimit?: number },
): Promise<Context7Result> => {
    const insights: Context7Insight[] = [];
    const warnings: string[] = [];
    const seenPaths = new Set<string>();

    const maxProjects = options?.maxProjects ?? 2;
    const tokenLimit = options?.tokenLimit ?? 1200;

    const uniqueCandidates = techCandidates
        .map((candidate) => candidate.trim())
        .filter((candidate, index, list) => candidate.length > 0 && list.indexOf(candidate) === index)
        .slice(0, 6);

    if (uniqueCandidates.length === 0) {
        return { insights, warnings };
    }

    try {
        await loadContext7Projects();
    } catch (error) {
        warnings.push(
            error instanceof Error
                ? `Context7 catalog unavailable: ${error.message}`
                : "Context7 catalog unavailable due to unknown error.",
        );
        return { insights, warnings };
    }

    for (const tech of uniqueCandidates) {
        if (insights.length >= maxProjects) break;

        try {
            const project = await resolveProject(tech);
            if (!project?.settings?.project) {
                warnings.push(`Context7 project not found for '${tech}'.`);
                continue;
            }

            const projectPath = ensureLeadingSlash(project.settings.project);
            if (seenPaths.has(projectPath)) {
                continue;
            }

            const topic = buildTopic(tech, prompt);
            const queryUrl = `${API_BASE_URL}${projectPath}/llms.txt?topic=${encodeURIComponent(topic)}&tokens=${tokenLimit}`;

            const content = await fetchText(queryUrl);
            insights.push({
                projectPath,
                projectTitle: project.settings.title,
                topic,
                content: truncateContent(content, 2000),
                sourceUrl: queryUrl,
                lastUpdate: project.version?.lastUpdate,
            });
            seenPaths.add(projectPath);
        } catch (error) {
            warnings.push(
                error instanceof Error
                    ? `Context7 query for '${tech}' failed: ${error.message}`
                    : `Context7 query for '${tech}' failed due to unknown error.`,
            );
        }
    }

    return { insights, warnings };
};
