import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigKey } from "../../../src/constants";
import { ConfigItem } from "../../../src/service/configService";

const configMocks = vi.hoisted(() => ({
    getConfig: vi.fn(),
    setValue: vi.fn(),
}));

vi.mock("../../../src/service/configService", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../src/service/configService")>();
    return {
        ...actual,
        default: {
            getConfig: configMocks.getConfig,
            setValue: configMocks.setValue,
        },
    };
});

async function loadService() {
    return await import("../../src/service/hostService");
}


describe("hostService", () => {
    beforeEach(() => {
        vi.resetModules();
        configMocks.getConfig.mockReset();
        configMocks.setValue.mockReset();
    });

    it("uses existing host key from config and caches it in memory", async () => {
        configMocks.getConfig.mockResolvedValue(new ConfigItem("stored123", ""));
        const service = await loadService();

        await expect(service.getHostKey()).resolves.toBe("stored123");
        await expect(service.getHostKey()).resolves.toBe("stored123");

        expect(configMocks.getConfig).toHaveBeenCalledTimes(1);
        expect(configMocks.setValue).not.toHaveBeenCalled();
    });

    it("generates and stores a short uuid when config is missing", async () => {
        configMocks.getConfig.mockResolvedValue(new ConfigItem("", ""));
        configMocks.setValue.mockResolvedValue({});
        const service = await loadService();

        const hostKey = await service.getHostKey();
        const cachedHostKey = await service.getHostKey();

        expect(hostKey).toMatch(/^[0-9a-f]{8}$/);
        expect(cachedHostKey).toBe(hostKey);
        expect(configMocks.getConfig).toHaveBeenCalledTimes(1);
        expect(configMocks.setValue).toHaveBeenCalledTimes(1);
        expect(configMocks.setValue).toHaveBeenCalledWith(
            ConfigKey.HOST_KEY,
            hostKey,
        );
    });

    it("shares one loading promise for concurrent cold reads", async () => {
        let resolveConfig: (value: ConfigItem) => void = () => {};
        configMocks.getConfig.mockReturnValue(new Promise<ConfigItem>((resolve) => {
            resolveConfig = resolve;
        }));
        configMocks.setValue.mockResolvedValue({});
        const service = await loadService();

        const first = service.getHostKey();
        const second = service.getHostKey();
        resolveConfig(new ConfigItem("", ""));

        const [firstKey, secondKey] = await Promise.all([first, second]);

        expect(firstKey).toBe(secondKey);
        expect(configMocks.getConfig).toHaveBeenCalledTimes(1);
        expect(configMocks.setValue).toHaveBeenCalledTimes(1);
    });
});
