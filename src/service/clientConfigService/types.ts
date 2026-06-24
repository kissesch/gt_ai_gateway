type ClientName = "claude-code" | "codex";
type ConnectionMode = "gateway" | "vendor";
type ClientProtocol = "anthropic" | "responses";

interface ApplyClientConfigParams {
    client: ClientName;
    connectionMode?: ConnectionMode;
    protocol?: ClientProtocol;
    gatewayUrl: string;
    apiKey: string;
    model: string;
}

interface RestoreClientConfigParams {
    client: ClientName;
}

interface ClientConfigStatusResponse {
    available: boolean;
    reason?: string;
    clients: ClientConfigStatus[];
}

interface ClientConfigStatus {
    client: ClientName;
    displayName: string;
    installed: boolean;
    configured: boolean;
    backupExists: boolean;
    currentConfig: CurrentClientConfig | null;
    configPath: string;
    backupPath: string;
    message?: string;
}

interface CurrentClientConfig {
    configPath: string;
    backendUrl: string;
    token: string;
    model: string;
    protocol: ClientProtocol;
    gatewayUser: GatewayUserInfo | null;
}

interface GatewayUserInfo {
    id: number;
    name: string;
    type: string;
    status: string;
}

interface FileSystemApi {
    access(path: string): Promise<void>;
    copyFile(source: string, target: string): Promise<void>;
    mkdir(path: string, options: { recursive: boolean }): Promise<string | undefined>;
    readFile(path: string, encoding: "utf-8"): Promise<string>;
    writeFile(path: string, content: string, encoding: "utf-8"): Promise<void>;
}

interface PathApi {
    dirname(path: string): string;
    join(...paths: string[]): string;
}

interface ConfigAdapter {
    readonly client: ClientName;
    readonly displayName: string;
    readonly configPath: string;
    readonly backupPath: string;

    getStatus(): Promise<ClientConfigStatus>;
    apply(params: ApplyClientConfigParams): Promise<ClientConfigStatus>;
    restore(): Promise<ClientConfigStatus>;
}

export type {
    ApplyClientConfigParams,
    ClientConfigStatus,
    ClientConfigStatusResponse,
    ClientName,
    ClientProtocol,
    ConfigAdapter,
    ConnectionMode,
    CurrentClientConfig,
    FileSystemApi,
    GatewayUserInfo,
    PathApi,
    RestoreClientConfigParams,
};
