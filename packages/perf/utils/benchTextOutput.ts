type BenchTextOutput = {
    teeLine: (s: string) => void;
    close: () => Promise<void>;
};

function stripAnsi(input: string): string {
    // eslint-disable-next-line no-control-regex
    return input.replace(/\u001B\[[0-9;]*[A-Za-z]/g, "");
}

function formatEnvHeader(): string {
    const now = new Date();
    const lines: string[] = [];
    lines.push(`date: ${now.toISOString()}`);
    lines.push(`platform: ${process.platform}`);
    lines.push(`arch: ${process.arch}`);
    lines.push(`bun: ${typeof (Bun as any).version === "string" ? (Bun as any).version : "unknown"}`);
    lines.push(`node: ${typeof process.version === "string" ? process.version : "unknown"}`);
    return lines.map((s) => `${s}\n`).join("");
}

export function createBenchTextOutput(options: { resultFilePath: string; writeToTerminal: boolean; includeEnvHeader: boolean }): BenchTextOutput {
    const file = Bun.file(options.resultFilePath);
    const chunks: string[] = [];

    if (options.includeEnvHeader) {
        chunks.push(formatEnvHeader());
        chunks.push("\n");
    }

    return {
        teeLine(s: string) {
            if (options.writeToTerminal) {
                try {
                    process.stdout.write(s.endsWith("\n") ? s : `${s}\n`);
                } catch {
                    // ignore
                }
            }

            const plain = stripAnsi(s);
            chunks.push(plain.endsWith("\n") ? plain : `${plain}\n`);
        },
        async close() {
            await Bun.write(file, chunks.join(""));
        }
    };
}
