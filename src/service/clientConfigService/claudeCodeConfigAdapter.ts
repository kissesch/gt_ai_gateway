import type { ApplyClientConfigParams, ClientConfigStatus, CurrentClientConfig, FileSystemApi, PathApi } from "./types";
import BaseConfigAdapter from "./baseConfigAdapter";
import configAdapterUtils from "./configAdapterUtils";


class ClaudeCodeConfigAdapter extends BaseConfigAdapter {
    constructor(fs: FileSystemApi, path: PathApi, homeDir: string) {
        super(fs, path, "claude-code", "Claude Code", path.join(homeDir, ".claude", "settings.json"));
    }

    private buildBaseUrl(params: ApplyClientConfigParams): string {
        const url = params.gatewayUrl.replace(/\/+$/, "");
        if ((params.connectionMode || "gateway") === "vendor") {
            return url
                .replace(/\/v1\/messages\/?$/, "")
                .replace(/\/v1\/?$/, "");
        }
        return `${url}/llm`;
    }


    async getStatus(): Promise<ClientConfigStatus> {
        const installed = await this.isInstalled();
        let configured = false;
        let message: string | undefined;
        let currentConfig: CurrentClientConfig | null = null;

        if (installed && await configAdapterUtils.pathExists(this.fs, this.configPath)) {
            try {
                const config = configAdapterUtils.parseJsonConfig(await this.readConfigFile());
                const backendUrl = config.env?.ANTHROPIC_BASE_URL || "";
                const token = config.env?.ANTHROPIC_AUTH_TOKEN || config.env?.ANTHROPIC_API_KEY || "";
                configured = Boolean(backendUrl && token);
                if (configured) {
                    currentConfig = {
                        configPath: this.configPath,
                        backendUrl,
                        token,
                        model: config.model || "",
                        protocol: "anthropic",
                        gatewayUser: await configAdapterUtils.findGatewayUserByToken(token),
                    };
                }
            } catch (error) {
                message = `配置文件解析失败: ${String(error)}`;
            }
        }

        return {
            client: this.client,
            displayName: this.displayName,
            installed,
            configured,
            backupExists: await configAdapterUtils.pathExists(this.fs, this.backupPath),
            currentConfig,
            configPath: this.configPath,
            backupPath: this.backupPath,
            message,
        };
    }


    async apply(params: ApplyClientConfigParams): Promise<ClientConfigStatus> {
        if (!(await this.isInstalled())) {
            throw new Error("Claude Code config directory not found");
        }

        const config = configAdapterUtils.parseJsonConfig(await this.readConfigFile());
        config.env = {
            ...(config.env || {}),
            ANTHROPIC_BASE_URL: this.buildBaseUrl(params),
            ANTHROPIC_AUTH_TOKEN: params.apiKey,
            CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
        };

        if (params.model.trim()) {
            config.model = params.model.trim();
        }

        await this.writeConfigFile(`${JSON.stringify(config, null, 4)}\n`);
        return await this.getStatus();
    }
}


export default ClaudeCodeConfigAdapter;
