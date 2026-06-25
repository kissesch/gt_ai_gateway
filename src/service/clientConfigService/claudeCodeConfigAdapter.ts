import type { ApplyClientConfigParams, ClientConfigStatus, CurrentClientConfig, FileSystemApi, PathApi } from "./types";
import BaseConfigAdapter from "./baseConfigAdapter";
import configAdapterUtils from "./configAdapterUtils";
import { ClientName } from "../../constants";


class ClaudeCodeConfigAdapter extends BaseConfigAdapter {
    constructor(fs: FileSystemApi, path: PathApi, homeDir: string) {
        super(fs, path, ClientName.CLAUDE_CODE, "Claude Code", path.join(homeDir, ".claude", "settings.json"));
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


    async parseConfigContent(configContent: Record<string, string>): Promise<CurrentClientConfig | null> {
        const content = configContent[this.configPath] || "";
        if (!content) {
            return null;
        }

        const config = configAdapterUtils.parseJsonConfig(content);
        const backendUrl = config.env?.ANTHROPIC_BASE_URL || "";
        const token = config.env?.ANTHROPIC_AUTH_TOKEN || config.env?.ANTHROPIC_API_KEY || "";
        if (!backendUrl || !token) {
            return null;
        }

        const gatewayUser = await configAdapterUtils.findGatewayUserByToken(token);
        return {
            configPath: this.configPath,
            connectionMode: gatewayUser ? "gateway" : "vendor",
            backendUrl,
            token,
            model: config.model || "",
            protocol: "anthropic",
            gatewayUser,
        };
    }


    async getStatus(): Promise<ClientConfigStatus> {
        const installed = await this.isInstalled();
        let configured = false;
        let message: string | undefined;
        let currentConfig: CurrentClientConfig | null = null;

        if (installed && await configAdapterUtils.pathExists(this.fs, this.configPath)) {
            try {
                currentConfig = await this.parseConfigContent({ [this.configPath]: await this.readConfigFile() });
                configured = Boolean(currentConfig);
            } catch (error) {
                message = `配置文件解析失败: ${String(error)}`;
            }
        }

        return {
            client: this.client,
            displayName: this.displayName,
            installed,
            configured,
            backupExists: false,
            backupCount: 0,
            backups: [],
            currentConfig,
            configPath: this.configPath,
            configPaths: this.configPaths,
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
