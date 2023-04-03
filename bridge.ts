import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ApplicationCommandInputType, ApplicationCommandOptionType, Command, registerCommand, sendBotMessage, unregisterCommand } from "@api/Commands";
import { Toasts } from "@webpack/common";
import { addPreSendListener, MessageObject, removePreSendListener } from "@api/MessageEvents";
import Logger from "@utils/Logger";
import { Settings } from "Vencord";

let ws: WebSocket;

const logger = new Logger("VBridge", "#90aee5");
export default definePlugin({
    name: "guinea pig bridge",
    description: "Discord => VRC text bridge",
    authors: [Devs.Animal],
    dependencies: ["CommandsAPI", "MessageEventsAPI"],
    options: {
        override: {
            description: "Inverted behavior: Send all messages to bridge (overridden with prefix)",
            type: OptionType.BOOLEAN,
            default: false,
            restartNeeded: false,
        }
    },
    commands: [{
        name: "lol",
        description: "Send message to osc",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [
            {
                type: ApplicationCommandOptionType.STRING,
                name: "msg",
                description: "message to osc",
                required: true
            }
        ],

        execute: async (args, ctx) => {
            sendWsMessage(args[0].value);
            sendBotMessage(ctx.channel.id, {
                content: "Sent!",
            });
            return;
        }
    },
    {
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
            Settings.plugins.VBridge.override = args[0].value;

            sendBotMessage(ctx.channel.id, {
                content: `Override mode is now ${args[0].value}.`,
            });
            return;
        }
    }],

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
            Toasts.show({
                message: "Connected to osc bridge",
                type: Toasts.Type.SUCCESS,
                id: Toasts.genId(),
                options: {
                    duration: 5000,
                    position: Toasts.Position.TOP
                }
            });
        };

        registerCommand(connect, "VBridge");

        const connectionSuccessful = await new Promise(res => setTimeout(() => res(ws.readyState === WebSocket.OPEN), 1000)); // check if open after 1s
        if (!connectionSuccessful) return;

        this.preSend = addPreSendListener((_, msg) => this.onSend(msg));
    },

    onSend(msg: MessageObject) {
        if (ws.readyState === WebSocket.CLOSED) return this.stop();
        let content = msg.content.replace('==', '');
        if (Settings.plugins.VBridge.override) {
            if (msg.content.startsWith("==")) {
                msg.content = content;
                return;
            }
            sendWsMessage(msg.content);
            msg.content = ""; // hack to make it not send lol
            return;
        } else if (msg.content.startsWith("==")) {
            sendWsMessage(content);
            msg.content = "";
        }
    },

    stop() {
        unregisterCommand("connect");
        removePreSendListener(this.preSend);
    },

    sendMessage(msg: string) {
        sendWsMessage(msg);
    }
});

function sendWsMessage(msg: string) {
    try {
        ws.send(msg);
    } catch (err) {
        logger.error(err);
    }
}

