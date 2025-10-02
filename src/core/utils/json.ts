export const parseJson = <T>(value: string): T => {
    try {
        return JSON.parse(value) as T;
    } catch (error) {
        throw new Error(`Failed to parse JSON response: ${(error as Error).message}`);
    }
};
