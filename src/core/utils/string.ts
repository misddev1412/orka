const SLUG_FALLBACK = "prompt";

export const slugify = (value: string, fallback: string = SLUG_FALLBACK): string => {
    const trimmed = value.trim().toLowerCase();
    const slug = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    return slug.length > 0 ? slug.slice(0, 60) : fallback;
};
