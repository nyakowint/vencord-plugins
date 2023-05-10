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
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { MessageStore, NavigationRouter, Text, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    reactAdd: { description: "Notify for Reaction added", type: OptionType.BOOLEAN, default: true, },
    reactRemove: { description: "Reaction removed", type: OptionType.BOOLEAN, default: true, },
    burstAdd: { description: "Burst added", type: OptionType.BOOLEAN, default: true, },
    burstRemove: { description: "Burst removed", type: OptionType.BOOLEAN, default: true, },
    ignoreBots: { description: "Ignore bot reactions", type: OptionType.BOOLEAN, default: true, },
});

const bruh = new Logger("ReactionNotifier");

const isDM = (r: { guild_id: string; }) => !r.guild_id;

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
            bruh.info(`Reaction added: ${r}`);
            const user = UserStore.getUser(r.userId);
            // TODO: fetch unloaded messages or else get undefined content error lol
            const msg = MessageStore.getMessage(r.channelId, r.messageId);
            const emoji = `https://cdn.discordapp.com/emojis/${r.emoji.id}.png?size=128`;
            /*if (isDM(r)) {*/
            showNotification({
                title: `${user.username} reacted with ${r.emoji.name}`,
                body: msg.content ? msg.content : "",
                richBody:
                    <>
                        {r.emoji.id && <img className="vc-rn-emoji" src={emoji} width={24} height={24} alt="" />}
                        <Text variant="text-md/normal">{msg.content}</Text>
                    </>,
                icon: user.getAvatarURL(),
                onClick() {
                    const link = "/channels/" + (r.guild_id ? r.guild_id : "@me") + "/" + msg.channel_id + "/" + msg.id;
                    // focus discord
                    window.focus();
                    NavigationRouter.transitionTo(link);
                }
            });
            return;
            /*}*/
            if (settings.store.ignoreBots && r.member.user.bot) return;
            bruh.info(`Reaction added: ${r}`);
        },
        MESSAGE_REACTION_REMOVE(r) {
            if (!settings.store.reactRemove) return;
            bruh.info(`Reaction removed: ${r}`);
        },
        BURST_REACTION_ADD(r) {
            if (!settings.store.burstAdd) return;
            bruh.info(`Burst added: ${r}`);
        },
        BURST_REACTION_REMOVE(r) {
            if (!settings.store.burstRemove) return;
            bruh.info(`Burst removed: ${JSON.stringify(r)}`);
        }
    },

    start() { },
    stop() { },
});
