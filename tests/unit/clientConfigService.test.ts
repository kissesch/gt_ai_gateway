import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import clientConfigService from "../../src/service/clientConfigService/core";
import ormService from "../../src/service/ormService";


describe("clientConfigService", () => {
    let tempDir = "";
    let originalHome: string | undefined;
    let originalCodexHome: string | undefined;
    let originalOrmMode: "worker" | "node";

    beforeEach(async () => {
        originalHome = process.env.HOME;
        originalCodexHome = process.env.CODEX_HOME;
        originalOrmMode = ormService.mode;
        ormService.mode = "node";
        tempDir = await mkdtemp(join(tmpdir(), "gt-client-config-"));
        process.env.HOME = tempDir;
        process.env.CODEX_HOME = join(tempDir, ".codex");
        await mkdir(join(tempDir, ".claude"), { recursive: true });
        await mkdir(process.env.CODEX_HOME, { recursive: true });
    });

    afterEach(async () => {
        process.env.HOME = originalHome;
        process.env.CODEX_HOME = originalCodexHome;
        ormService.mode = originalOrmMode;
        await rm(tempDir, { recursive: true, force: true });
    });

    it("reports unavailable in worker mode", async () => {
        ormService.mode = "worker";

        const status = await clientConfigService.getStatus();

        expect(status.available).toBe(false);
        expect(status.clients).toEqual([]);
        expect(status.reason).toContain("本地安装");
    });

    it("writes and restores Claude Code settings", async () => {
        const configPath = join(tempDir, ".claude", "settings.json");
        await writeFile(configPath, JSON.stringify({ permissions: { allow: ["Bash(npm test)"] } }, null, 4));

        const status = await clientConfigService.applyConfig({
            client: "claude-code",
            gatewayUrl: "http://127.0.0.1:8720",
            apiKey: "test-token",
            model: "test-model",
        });

        expect(status.configured).toBe(true);
        expect(status.backupExists).toBe(true);
        const updated = JSON.parse(await readFile(configPath, "utf-8"));
        expect(updated.permissions.allow).toEqual(["Bash(npm test)"]);
        expect(updated.env.ANTHROPIC_BASE_URL).toBe("http://127.0.0.1:8720/llm");
        expect(updated.env.ANTHROPIC_AUTH_TOKEN).toBe("test-token");
        expect(updated.model).toBe("test-model");

        await clientConfigService.restoreConfig({ client: "claude-code" });
        const restored = JSON.parse(await readFile(configPath, "utf-8"));
        expect(restored).toEqual({ permissions: { allow: ["Bash(npm test)"] } });
    });

    it("writes Codex provider config", async () => {
        const configPath = join(tempDir, ".codex", "config.toml");
        await writeFile(configPath, "approval_policy = \"on-request\"\n\n[features]\nhooks = true\n");

        const status = await clientConfigService.applyConfig({
            client: "codex",
            gatewayUrl: "http://127.0.0.1:8720/",
            apiKey: "test-token",
            model: "test-model",
        });

        expect(status.configured).toBe(true);
        expect(status.backupExists).toBe(true);
        const updated = await readFile(configPath, "utf-8");
        expect(updated).toContain("approval_policy = \"on-request\"");
        expect(updated).toContain("model = \"test-model\"");
        expect(updated).toContain("model_provider = \"gt_ai_gateway\"");
        expect(updated).toContain("[model_providers.gt_ai_gateway]");
        expect(updated).toContain("base_url = \"http://127.0.0.1:8720/llm/v1\"");
        expect(updated).toContain("wire_api = \"responses\"");
        expect(updated).toContain("experimental_bearer_token = \"test-token\"");
        expect(updated).toContain("[features]");
    });

    it("writes direct upstream Claude Code settings without gateway path", async () => {
        const configPath = join(tempDir, ".claude", "settings.json");
        await writeFile(configPath, "{}");

        await clientConfigService.applyConfig({
            client: "claude-code",
            connectionMode: "vendor",
            protocol: "anthropic",
            gatewayUrl: "https://api.anthropic.com/v1/messages",
            apiKey: "vendor-token",
            model: "claude-sonnet",
        });

        const updated = JSON.parse(await readFile(configPath, "utf-8"));
        expect(updated.env.ANTHROPIC_BASE_URL).toBe("https://api.anthropic.com");
        expect(updated.env.ANTHROPIC_AUTH_TOKEN).toBe("vendor-token");
        expect(updated.model).toBe("claude-sonnet");
    });

    it("writes direct upstream Codex provider config without gateway path", async () => {
        const configPath = join(tempDir, ".codex", "config.toml");
        await writeFile(configPath, "");

        await clientConfigService.applyConfig({
            client: "codex",
            connectionMode: "vendor",
            protocol: "responses",
            gatewayUrl: "https://api.openai.com/v1/chat/completions",
            apiKey: "vendor-token",
            model: "gpt-5",
        });

        const updated = await readFile(configPath, "utf-8");
        expect(updated).toContain("base_url = \"https://api.openai.com/v1\"");
        expect(updated).toContain("experimental_bearer_token = \"vendor-token\"");
        expect(updated).toContain("model = \"gpt-5\"");
    });
});
