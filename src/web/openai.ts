import { Context } from "hono";
import { stream, streamText, streamSSE } from 'hono/streaming'
import {EventStreamContentType, fetchEventSource} from '@fortaine/fetch-event-source';


let id = 0

const upStreamUrl:string = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

async function chatCompletions (c: Context){

    let fetchES = await fetchEventSource(upStreamUrl, {
        async onopen(response:Response) {
            if (response.ok && response.headers.get('content-type') === EventStreamContentType) {
                console.log("onOpen:", response);

                return; // everything's good

            } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                // client-side errors are usually non-retriable:
                console.log("onOpen, but has error:", response);

                const contentType = response.headers.get("content-type");
                console.log("upstream response content type: ", contentType);

                if (contentType?.startsWith("text/plain") || contentType?.startsWith("application/json")) {
                    let responseText:string = await response.clone().text();
                    console.log("responseText:",responseText);
                }

                console.log("fallback to json response");
                //c.res.headers.set("Content-Type","application/json");
                //await stream.write('{""}')
                //await stream.close()

            } else {
                console.log("onOpen, but content-type not except:", response);
            }
        },
        onmessage(msg) {
            // if the server emits an error message, throw an exception
            // so it gets handled by the onerror callback below:

            console.log("onMessage:", msg);
        },
        onclose() {
            // if the server closes the connection unexpectedly, retry:

            console.log("onClose");
        },
        onerror(err:Response) {
            console.log("onerror:", err);
        }

    });

    console.log("after fetchES");

    return streamSSE(c, async (stream) => {
    });
}

export {
    chatCompletions
}