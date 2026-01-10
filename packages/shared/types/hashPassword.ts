export type HashPassword = (password: string, salt?: string) => Promise<string>;
