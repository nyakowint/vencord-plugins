/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { Queue } from "@utils/Queue";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, MessageStore, NavigationRouter, RestAPI, Text, UserStore } from "@webpack/common";
import { Message } from "discord-types/general";

const settings = definePluginSettings({
    reactAdd: { description: "Notify for Reaction added", type: OptionType.BOOLEAN, default: true, },
    reactRemove: { description: "Reaction removed", type: OptionType.BOOLEAN, default: true, },
    burstAdd: { description: "Burst added", type: OptionType.BOOLEAN, default: true, },
    burstRemove: { description: "Burst removed", type: OptionType.BOOLEAN, default: true, },
    ignoreBots: { description: "Ignore bot reactions", type: OptionType.BOOLEAN, default: true, },
});

const bruh = new Logger("ReactionNotifier"); /* remove when finished */

const messageFetchQueue = new Queue();

export default definePlugin({
    name: "ReactionNotifier",
    description: "Notifies you when someone reacts to your message",
    authors: [Devs.Animal],
    settings,


    flux: {
        MESSAGE_REACTION_ADD(r) {
            if (!settings.store.reactAdd) return;
            const currentUserId = UserStore.getCurrentUser().id;
            if (r.userId === currentUserId || r.messageAuthorId !== currentUserId) return;
            bruh.info(`Raw Reaction Add: ${r}`);
            const user = UserStore.getUser(r.userId);
            if (user.bot && settings.store.ignoreBots) return;
            // TODO: fetch unloaded messages or else get undefined content error lol
            let msg = messageCache.get(r.messageId)?.message;
            let msgId = r.messageId;
            if (!msg) {
                msg ??= MessageStore.getMessage(r.channelId, msgId);
                if (msg) {
                    messageCache.set(msgId, { message: msg, fetched: true });
                } else {
                    messageFetchQueue.push(() => fetchMessage(r.channelId, msgId)
                        .then(m => {
                            if (!m) return;
                            FluxDispatcher.dispatch({
                                type: "MESSAGE_UPDATE",
                                message: msg
                            });
                            const emoji = `https://cdn.discordapp.com/emojis/${r.emoji.id}.png?size=128`;
                            showNotification({
                                title: `${user.username} reacted with ${r.emoji.name}`,
                                body: m.content,
                                richBody:
                                    <>
                                        {r.emoji.id && <img className="vc-rn-emoji" src={emoji} width={24} height={24} alt="" />}
                                        <Text variant="text-md/normal">{m.content}</Text>
                                    </>,
                                icon: user.getAvatarURL(),
                                onClick() {
                                    const link = "/channels/" + (r.guildId ? r.guildId : "@me") + "/" + r.channelId + "/" + r.messageId;
                                    // focus discord
                                    window.focus();
                                    NavigationRouter.transitionTo(link);
                                }
                            });
                        })
                    );

                }
            }
        },
        MESSAGE_REACTION_REMOVE(r) {
            if (!settings.store.reactRemove) return;
            // TODO
        },
        BURST_REACTION_ADD(r) {
            if (!settings.store.burstAdd) return;
            // TODO
        },
        BURST_REACTION_REMOVE(r) {
            if (!settings.store.burstRemove) return;
            // TODO
        }
    },

    start() { },
    stop() { },
});


const messageCache = new Map<string, {
    message?: Message;
    fetched: boolean;
}>();

async function fetchMessage(channelID: string, messageID: string) {
    const cached = messageCache.get(messageID);
    if (cached) return cached.message;

    messageCache.set(messageID, { fetched: false });

    const res = await RestAPI.get({
        url: `/channels/${channelID}/messages`,
        query: {
            limit: 1,
            around: messageID
        },
        retries: 2
    }).catch(() => null);

    const msg = res?.body?.[0];
    if (!msg) return;

    const message: Message = MessageStore.getMessages(msg.channel_id).receiveMessage(msg).get(msg.id);

    messageCache.set(message.id, {
        message,
        fetched: true
    });

    return message;
}
