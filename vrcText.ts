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
    sendNow: boolean,
    popNoise: boolean;
}

let lastSend = 0;

const plugin = definePlugin({
    name: "guinea pig bridge",
    description: "Discord => VRC text bridge.",
    authors: [Devs.Animal],
    tags: ["vrcText"],
    dependencies: ["CommandsAPI", "MessageEventsAPI"],
    settings: definePluginSettings({
        override: {
            description: "Inverted behavior: Send all messages to bridge (overridden with prefix)",
            type: OptionType.BOOLEAN,
            default: false,
            restartNeeded: false,
        },
        pTyping: {
            description: "Send messages as you're typing",
            type: OptionType.BOOLEAN,
            default: true,
            restartNeeded: false
        }
    }),
    toolboxActions: {
        "Clear Chatbox": () => {
            plugin.clearChatbox();
        },
        "Connect": () => {
            plugin.stop();
            plugin.start();
        }
    },
    clearChatbox() {
        sendWsMessage("", false);
        showToast("Chatbox cleared!");
    },
    flux: {
        DRAFT_CHANGE(d: MessageDraft) {
            if (ws.readyState === WebSocket.CLOSED) return;
            if (plugin.settings.store.override) {
                sendTyping(true);
            } else if (d.draft.startsWith("==") && d.draft.length > 3) {
                sendTyping(true);
                plugin.handleProceduralMessage(d.draft);
            }
            if (d.draft == "-=") {
                plugin.clearChatbox();
            }
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

        registerCommand(connect, "VRCText");

        const connectionSuccessful = await new Promise(res => setTimeout(() => res(ws.readyState === WebSocket.OPEN), 1000)); // check if open after 1s
        if (!connectionSuccessful) return;

        this.preSend = addPreSendListener((_, msg) => this.onSend(msg));
    },

    handleProceduralMessage(msg: string) {
        if (!plugin.settings.store.pTyping) return;
        const content = msg.replace("==", '').replace("=/=", '').trim();
        if (Date.now() - lastSend > 1050) {
            sendWsMessage(content, false);
            lastSend = Date.now();
        }
    },

    onSend(msg: MessageObject) {
        if (ws.readyState === WebSocket.CLOSED) {
            this.stop();
            return;
        }
        let content = msg.content.replace("==", '').replace("=/=", '');
        let trim = msg.content.trim();

        if (this.settings.store.override) {
            if (trim.startsWith("==")) {
                msg.content = content;
                return;
            }

            sendWsMessage(content);
            msg.content = ""; // hack to make it not send lol
            return;
        }

        if (trim.startsWith("==")) {
            sendWsMessage(content);
            msg.content = "";
            return;
        }

        if (trim.startsWith("=/=")) { // silent message, no pop sound
            sendWsMessage(content, false);
            msg.content = "";
            return;
        }
    },

    stop() {
        unregisterCommand("connect");
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

// https://docs.vrchat.com/docs/osc-as-input-controller

function sendWsMessage(msg: string, pop = true, now = true) {
    let bridgeMsg: BridgeMsg = {
        content: msg,
        sendNow: now,
        popNoise: pop
    };
    ws.send(JSON.stringify(bridgeMsg));
}


function sendTyping(isTyping: boolean) {
    ws.send(isTyping ? "typing:true" : "typing:false");
}

export default plugin;
