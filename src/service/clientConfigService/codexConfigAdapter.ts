import type { ApplyClientConfigParams, ClientConfigStatus, CurrentClientConfig, FileSystemApi, PathApi } from "./types";
import BaseConfigAdapter from "./baseConfigAdapter";
import configAdapterUtils from "./configAdapterUtils";
import tomlUtil from "../../util/tomlUtil";


class CodexConfigAdapter extends BaseConfigAdapter {
    constructor(fs: FileSystemApi, path: PathApi, homeDir: string) {
        const codexHome = process.env.CODEX_HOME || path.join(homeDir, ".codex");
        super(fs, path, "codex", "Codex", path.join(codexHome, "config.toml"));
    }

    private buildBaseUrl(params: ApplyClientConfigParams): string {
        const url = params.gatewayUrl.replace(/\/+$/, "");
        if ((params.connectionMode || "gateway") === "vendor") {
            return url
                .replace(/\/responses\/?$/, "")
                .replace(/\/chat\/completions\/?$/, "");
        }
        return `${url}/llm/v1`;
    }


    async getStatus(): Promise<ClientConfigStatus> {
        const installed = await this.isInstalled();
        let configured = false;
        let message: string | undefined;
        let currentConfig: CurrentClientConfig | null = null;

        if (installed && await configAdapterUtils.pathExists(this.fs, this.configPath)) {
            try {
                const content = await this.readConfigFile();
                const provider = tomlUtil.getTomlValue(content, "model_provider") || "";
                const providerTable = provider ? `model_providers.${provider}` : "";
                const backendUrl = providerTable ? tomlUtil.getTomlTableValue(content, providerTable, "base_url") || "" : "";
                const token = providerTable ? tomlUtil.getTomlTableValue(content, providerTable, "experimental_bearer_token") || "" : "";
                configured = Boolean(provider && backendUrl && token);
                if (configured) {
                    currentConfig = {
                        configPath: this.configPath,
                        backendUrl,
                        token,
                        model: tomlUtil.getTomlValue(content, "model") || "",
                        protocol: "responses",
                        gatewayUser: await configAdapterUtils.findGatewayUserByToken(token),
                    };
                }
            } catch (error) {
                message = `配置文件读取失败: ${String(error)}`;
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
            throw new Error("Codex config directory not found");
        }

        let content = await this.readConfigFile();
        content = tomlUtil.upsertRootTomlValue(content, "model_provider", tomlUtil.buildTomlString("gt_ai_gateway"));

        if (params.model.trim()) {
            content = tomlUtil.upsertRootTomlValue(content, "model", tomlUtil.buildTomlString(params.model.trim()));
        }

        content = tomlUtil.upsertTomlTable(content, "model_providers.gt_ai_gateway", {
            name: tomlUtil.buildTomlString("GT AI Gateway"),
            base_url: tomlUtil.buildTomlString(this.buildBaseUrl(params)),
            wire_api: tomlUtil.buildTomlString("responses"),
            experimental_bearer_token: tomlUtil.buildTomlString(params.apiKey),
        });

        await this.writeConfigFile(`${content.trim()}\n`);
        return await this.getStatus();
    }
}


export default CodexConfigAdapter;
