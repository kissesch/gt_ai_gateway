import { Context } from "hono";
import clientConfigService from "../service/clientConfigService/core";


async function status(c: Context) {
    return c.json(await clientConfigService.getStatus());
}


async function apply(c: Context) {
    const body = await c.req.json();
    return c.json(await clientConfigService.applyConfig(body));
}


async function restore(c: Context) {
    const body = await c.req.json();
    return c.json(await clientConfigService.restoreConfig(body));
}


export default {
    status,
    apply,
    restore,
};
