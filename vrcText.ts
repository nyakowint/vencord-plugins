import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ApplicationCommandInputType, ApplicationCommandOptionType, Command, registerCommand, sendBotMessage, unregisterCommand } from "@api/Commands";
import { Toasts } from "@webpack/common";
import { addPreSendListener, MessageObject, removePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { FluxEvents } from "@webpack/types";

let ws: WebSocket;

type MessageDraft = {
    type: FluxEvents,
    channelId: string,
    draft: string,
    draftType: number;
};

interface BridgeMsg {
    content: string,
    immediate: boolean,
    popNoise: boolean;
}

const plugin = definePlugin({
    name: "guinea pig bridge",
    description: "Discord => VRC text bridge.",
    authors: [Devs.Animal],
    dependencies: ["CommandsAPI", "MessageEventsAPI"],
    settings: definePluginSettings({
        override: {
            description: "Inverted behavior: Send all messages to bridge (overridden with prefix)",
            type: OptionType.BOOLEAN,
            default: false,
            restartNeeded: false,
        }
    }),
    toolboxActions: {
        "Clear Chatbox": () => {
            sendTyping(false);
            sendWsMessage("", false);
            showToast("Chatbox cleared!");
        },
        "Connect": () => {
            plugin.stop();
            plugin.start();
            return;
        }
    },
    flux: {
        DRAFT_CHANGE(d: MessageDraft) {
            if (!d.draft.startsWith("==") || !d.draft.startsWith("==/")) return;
            sendTyping(false);
        }
    },

    async start() {
        let connect: Command = {
            name: "connect",
            description: "Connect to bridge websocket",
            inputType: ApplicationCommandInputType.BUILT_IN,

            execute: async () => {
                this.stop();
                this.start();
                return;
            }
        };


        if (ws) ws.close();
        ws = new WebSocket("ws://127.0.0.1:6942");

        ws.onopen = () => {
            showToast("Connected to OSC bridge");
        };

        registerCommand(connect, "vrcText");

        const connectionSuccessful = await new Promise(res => setTimeout(() => res(ws.readyState === WebSocket.OPEN), 1000)); // check if open after 1s
        if (!connectionSuccessful) return;

        this.preSend = addPreSendListener((_, msg) => this.onSend(msg));
    },

    onSend(msg: MessageObject) {
        if (ws.readyState === WebSocket.CLOSED) {
            this.stop();
            return;
        }
        let content = msg.content.replace(/^==\/?/, '');
        let trim = msg.content.trim();
        if (this.settings.store.override) {
            if (trim.startsWith("==")) {
                msg.content = content;
                return;
            }
            sendWsMessage(content);
            msg.content = ""; // hack to make it not send lol
            return;
        } else if (trim.startsWith("==")) {
            let silent = trim.startsWith("==/");
            sendWsMessage(content, silent);
            msg.content = "";
        }
    },

    stop() {
        removePreSendListener(this.preSend);
    },

    commands:
        [{
            name: "override",
            description: "Toggle override mode, sends all messages NOT with prefix",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.BOOLEAN,
                    name: "value",
                    description: "boolean of override mode",
                    required: true
                }
            ],

            execute: async (args, ctx) => {
                plugin.settings.store.override = Boolean(args[0].value);

                sendBotMessage(ctx.channel.id, {
                    content: `Override mode is now ${args[0].value}.`,
                });
                return;
            }
        }],
});

function showToast(msg: string) {
    Toasts.show({
        message: msg,
        type: Toasts.Type.SUCCESS,
        id: Toasts.genId(),
        options: {
            duration: 5000,
            position: Toasts.Position.TOP
        }
    });
}

function sendWsMessage(msg: string, pop = true, now = true) {
    let bridgeMsg: BridgeMsg = {
        content: msg,
        immediate: now,
        popNoise: pop
    };
    ws.send(JSON.stringify(bridgeMsg));
    sendTyping(false);
}

let lastTyping = 0;

function sendTyping(isTyping: boolean) {
    const now = Date.now();
    if (isTyping && now - lastTyping < 3000) return;

    ws.send(isTyping ? "typing:true" : "typing:false");
    lastTyping = now;
}

export default plugin;
