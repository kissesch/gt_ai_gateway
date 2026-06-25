import ormService from "../ormService";
import SgClientConfigBackup from "../../model/sgClientConfigBackup";
import type {
    ApplyClientConfigParams,
    ClientConfigBackupInfo,
    ClientConfigStatus,
    ClientConfigStatusResponse,
    ClientName,
    ConfigAdapter,
    CreateClientConfigBackupParams,
    FileSystemApi,
    PathApi,
    RenameClientConfigBackupParams,
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


async function getAdapter(client: ClientName): Promise<ConfigAdapter> {
    const adapters = await getAdapters();
    const adapter = adapters.find(item => item.client === client);
    if (!adapter) {
        throw new Error(`Unsupported client: ${client}`);
    }

    return adapter;
}


function formatBackupName(client: ClientName): string {
    const date = new Date();
    const timestamp = date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
    return `${client} ${timestamp}`;
}


async function toBackupInfo(record: any, adapter: ConfigAdapter): Promise<ClientConfigBackupInfo> {
    return {
        id: Number(record.id),
        client: record.client as ClientName,
        name: record.name,
        fileCount: Object.keys(record.configContent || {}).length,
        createdAt: String(record.created_at || record.createdAt || ""),
        config: await adapter.parseConfigContent(record.configContent || {}),
    };
}


function normalizeBackupRecords(records: any): any[] {
    if (Array.isArray(records)) {
        return records;
    }

    if (Array.isArray(records?.items)) {
        return records.items;
    }

    if (typeof records?.toData === "function") {
        const data = records.toData();
        return Array.isArray(data) ? data : [];
    }

    return [];
}


async function getBackups(client: ClientName, adapter: ConfigAdapter): Promise<ClientConfigBackupInfo[]> {
    const records = await SgClientConfigBackup.query()
        .where("client", client)
        .orderBy("id", "desc")
        .get();

    return await Promise.all(normalizeBackupRecords(records).map(record => toBackupInfo(record, adapter)));
}


async function enrichStatus(status: ClientConfigStatus, adapter: ConfigAdapter): Promise<ClientConfigStatus> {
    const backups = await getBackups(status.client, adapter);
    return {
        ...status,
        backupExists: backups.length > 0,
        backupCount: backups.length,
        backups,
    };
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
    const clients = await Promise.all(adapters.map(async (adapter) => {
        return await enrichStatus(await adapter.getStatus(), adapter);
    }));
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
    const status = await adapter.apply({
        ...params,
        connectionMode: params.connectionMode || "gateway",
        protocol: params.protocol,
        gatewayUrl: params.gatewayUrl.trim(),
        apiKey: params.apiKey.trim(),
        model: params.model?.trim() || "",
    });
    return await enrichStatus(status, adapter);
}


async function createBackup(params: CreateClientConfigBackupParams): Promise<ClientConfigBackupInfo> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    const adapter = await getAdapter(params.client);
    const configContent = await adapter.readConfigFiles();
    const record = await SgClientConfigBackup.query().create({
        client: params.client,
        name: params.name?.trim() || formatBackupName(params.client),
        configContent,
    });

    return await toBackupInfo(record, adapter);
}


async function renameBackup(params: RenameClientConfigBackupParams): Promise<ClientConfigBackupInfo> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    const name = params.name?.trim();
    if (!name) {
        throw new Error("Backup name is required");
    }

    const backup = await SgClientConfigBackup.query()
        .where("id", params.backupId)
        .where("client", params.client)
        .first();

    if (!backup) {
        throw new Error("Backup not found");
    }

    await backup.update({ name });
    backup.name = name;
    return await toBackupInfo(backup, await getAdapter(params.client));
}


async function restoreConfig(params: RestoreClientConfigParams): Promise<ClientConfigStatus> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    const adapter = await getAdapter(params.client);
    const backup = await SgClientConfigBackup.query()
        .where("id", params.backupId)
        .where("client", params.client)
        .first();

    if (!backup) {
        throw new Error("Backup not found");
    }

    return await enrichStatus(await adapter.restore(backup.configContent), adapter);
}


export default {
    createBackup,
    getStatus,
    applyConfig,
    renameBackup,
    restoreConfig,
};

export type {
    ApplyClientConfigParams,
    ClientConfigBackupInfo,
    ClientConfigStatus,
    ClientConfigStatusResponse,
};
