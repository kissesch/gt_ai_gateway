import ormService from "../ormService";
import type {
    ApplyClientConfigParams,
    ClientConfigStatus,
    ClientConfigStatusResponse,
    ConfigAdapter,
    FileSystemApi,
    PathApi,
    RestoreClientConfigParams,
} from "./types";
import ClaudeCodeConfigAdapter from "./claudeCodeConfigAdapter";
import CodexConfigAdapter from "./codexConfigAdapter";


function getHomeDir(): string {
    return process.env.HOME || process.env.USERPROFILE || "";
}


async function loadNodeApis(): Promise<{ fs: FileSystemApi; path: PathApi }> {
    const fs = await import("fs/promises");
    const path = await import("path");
    return { fs, path };
}


async function getAdapters(): Promise<ConfigAdapter[]> {
    const homeDir = getHomeDir();
    if (!homeDir) {
        throw new Error("Cannot determine user home directory");
    }

    const { fs, path } = await loadNodeApis();
    return [
        new ClaudeCodeConfigAdapter(fs, path, homeDir),
        new CodexConfigAdapter(fs, path, homeDir),
    ];
}


async function getAdapter(client: string): Promise<ConfigAdapter> {
    const adapters = await getAdapters();
    const adapter = adapters.find(item => item.client === client);
    if (!adapter) {
        throw new Error(`Unsupported client: ${client}`);
    }

    return adapter;
}


async function getStatus(): Promise<ClientConfigStatusResponse> {
    if (ormService.isWorker) {
        return {
            available: false,
            reason: "客户端管理需要读写本机配置文件，请本地安装后使用。",
            clients: [],
        };
    }

    const adapters = await getAdapters();
    const clients = await Promise.all(adapters.map(adapter => adapter.getStatus()));
    return {
        available: true,
        clients,
    };
}


async function applyConfig(params: ApplyClientConfigParams): Promise<ClientConfigStatus> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    if (!params.gatewayUrl?.trim()) {
        throw new Error("Gateway URL is required");
    }

    if (!params.apiKey?.trim()) {
        throw new Error("API key is required");
    }

    const adapter = await getAdapter(params.client);
    return await adapter.apply({
        ...params,
        connectionMode: params.connectionMode || "gateway",
        protocol: params.protocol,
        gatewayUrl: params.gatewayUrl.trim(),
        apiKey: params.apiKey.trim(),
        model: params.model?.trim() || "",
    });
}


async function restoreConfig(params: RestoreClientConfigParams): Promise<ClientConfigStatus> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    const adapter = await getAdapter(params.client);
    return await adapter.restore();
}


export default {
    getStatus,
    applyConfig,
    restoreConfig,
};

export type {
    ApplyClientConfigParams,
    ClientConfigStatus,
    ClientConfigStatusResponse,
};
