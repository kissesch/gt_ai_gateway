export type ClientName = 'claude-code' | 'codex';
export type ClientConnectionMode = 'gateway' | 'vendor';
export type ClientProtocol = 'anthropic' | 'responses';

export interface ClientConfigStatus {
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

export interface CurrentClientConfig {
    configPath: string;
    backendUrl: string;
    token: string;
    model: string;
    protocol: ClientProtocol;
    gatewayUser: GatewayUserInfo | null;
}

export interface GatewayUserInfo {
    id: number;
    name: string;
    type: string;
    status: string;
}

export interface ClientConfigStatusResponse {
    available: boolean;
    reason?: string;
    clients: ClientConfigStatus[];
}

export interface ApplyClientConfigRequest {
    client: ClientName;
    connectionMode?: ClientConnectionMode;
    protocol?: ClientProtocol;
    gatewayUrl: string;
    apiKey: string;
    model: string;
}

export interface RestoreClientConfigRequest {
    client: ClientName;
}
