// yes, i can just use the message object as it is, then messages will be wiped when someone deletes them (not the desired result for what's supposed to be a NOTES plugin if the NOTES disappear randomly)

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Logger } from "@utils/Logger";
import { Button, ChannelStore, Text, Tooltip } from "@webpack/common";
import { find, findByCodeLazy } from "@webpack";
import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import {
    closeModal, ModalCloseButton,
    ModalContent, ModalFooter,
    ModalHeader, ModalRoot,
    ModalSize, openModal
} from "@utils/modal";
import ErrorBoundary from "@components/ErrorBoundary";
import { LazyComponent } from "@utils/react";
import { addButton, removeButton } from "@api/MessagePopover";
import { DataStore } from "@api/index";
import { MessageAttachment } from "discord-types/general";
import { Moment } from "moment";


const STORE_PREFIX = "MessageNotes_List";

const ChannelMessage = LazyComponent(() => find(m => m.type?.toString()?.includes('["message","compact","className",')));
const createBotMessage = findByCodeLazy('username:"Clyde"');

interface SavedNote {
    id: string;
    content: string;
    meta: {
        guildId: string;
        channelId: string;
    };
    attachments: MessageAttachment[];
    author: string;
}

interface iUser {
    avatar: string;
    discriminator: string;
    id: string;
    username: string;
    display_name?: string;
    avatarDecoration?: string;
}

interface iMessage {
    channel_id?: string;
    guild_id?: string;
    author: iUser;
    content: string;
    id: string;
    type: number;
    timestamp: string | Moment;
    referenced_message?: iMessage;
    tts: boolean;
    components?: any;
    attachments: any[];
    embeds: any[];
    member?: {
        avatar?: string;
        roles: string[];
        joined_at: string;
        premium_since?: string;
        nick?: string;
        deaf: boolean;
        mute: boolean;
        flags: number;
    };
    mentions: string[];
}

function fakeMessage(message: iMessage) {
    // we have to camelCase channelId because discord™.
    const msg = createBotMessage({
        channelId: message.channel_id,
        content: message.content,
        guildId: message.guild_id,
        author: message.author
    });
    // the above message now has the functions hasFlag() and stuff,
    // which makes it valid for the component 👍.
    msg.id = message.id;
    msg.flags = 0;
    return msg;
}

const getNotes = () => DataStore.get(STORE_PREFIX).then<any[]>(t => t ?? []);
const addNote = async (n: any) => {
    const notes = await getNotes();
    notes.push(n);
    DataStore.set(STORE_PREFIX, notes);
    return notes;
};
const removeNote = async (id: string) => {
    let notes = await getNotes();
    notes = notes.filter((n: SavedNote) => n.id !== id);
    DataStore.set(STORE_PREFIX, notes);
    return notes;
};

//balls

function NotebookIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24">
            <path
                fill="currentColor"
                d="M6.729 2a.586.586 0 0 0-.586.586v1.172a.586.586 0 1 0 1.171 0V2.586A.585.585 0 0 0 6.73 2zm3.515 0a.586.586 0 0 0-.586.586v1.172a.586.586 0 1 0 1.172 0V2.586A.585.585 0 0 0 10.244 2zm3.516 0a.586.586 0 0 0-.586.586v1.172a.587.587 0 0 0 1.174 0V2.586A.588.588 0 0 0 13.76 2zm3.515 0a.586.586 0 0 0-.586.586v1.172a.587.587 0 0 0 1.174 0V2.586A.588.588 0 0 0 17.275 2zM4.967 3.28A1.756 1.756 0 0 0 3.8 4.93v15.312c0 .97.787 1.758 1.758 1.758h12.888a1.76 1.76 0 0 0 1.758-1.758V4.93a1.757 1.757 0 0 0-1.172-1.65v.478a1.76 1.76 0 0 1-1.758 1.758 1.76 1.76 0 0 1-1.757-1.758 1.76 1.76 0 0 1-3.518 0 1.76 1.76 0 0 1-1.758 1.758 1.76 1.76 0 0 1-1.758-1.758 1.76 1.76 0 0 1-3.517 0v-.479zm1.762 3.993h10.546a.586.586 0 1 1 0 1.172H6.73a.586.586 0 1 1 0-1.172zm0 3.514h10.546a.587.587 0 0 1 0 1.174H6.73a.587.587 0 0 1 0-1.174zm0 3.594h10.546a.586.586 0 1 1 0 1.172H6.73a.586.586 0 1 1 0-1.172zm0 3.515h10.546a.586.586 0 1 1 0 1.172H6.73a.586.586 0 1 1 0-1.172z" />
        </svg>

    );
}

const NotesButton = () => (
    <Tooltip text="Notebook" position="right">
        {({ onMouseLeave, onMouseEnter }) => (
            <Button
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onClick={openNotesModal}
                color={Button.Colors.PRIMARY}
                size={Button.Sizes.ICON}
                style={{
                    borderRadius: '50%',
                    marginLeft: '12px', marginBottom: '6px',
                    backgroundColor: 'var(--background-primary)',
                    width: '48px', height: '48px',

                }}
            ><NotebookIcon />
            </Button>
        )}
    </Tooltip>
);



async function openNotesModal() {
    const notes = await getNotes();
    const key = openModal(props => (
        <ErrorBoundary>
            <ModalRoot {...props} size={ModalSize.MEDIUM}>
                <ModalHeader>
                    <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Message Notebook</Text>
                    <ModalCloseButton onClick={() => closeModal(key)} />
                </ModalHeader>
                <ModalContent>
                    {notes.map((n: any) => (
                        <div>
                            <ChannelMessage
                                id={`message-notes-${n.id}`}
                                message={/*MessageStore.getMessage(n.channel_id, n.id)*/
                                    fakeMessage(n)
                                }
                                channel={
                                    { ...ChannelStore.getChannel(n.channelId), isFirstMessageInForumPost: () => { } }
                                    /* new Channel({ id: "message-notes-vc" }) */
                                }
                                key={n.id}
                                groupId={n.id}
                                compact={false}
                                isHighlight={false}
                                isLastItem={false}
                                renderContentOnly={false}
                                subscribeToComponentDispatch={false}
                            />
                            <Button onClick={
                                () => { /* NavigationRouter.transitionTo(`/channels/${n.meta.guildId}/${n.meta.channelId}/${n.id}`); */ }
                            }>Jump to message</Button>
                        </div>
                    ))};
                </ModalContent >
                <ModalFooter>
                </ModalFooter>
            </ModalRoot >
        </ErrorBoundary >
    ));
}

const logger = new Logger("notes", "#90aee5");
export default definePlugin({
    name: "MessageNotes",
    description: "Save messages to a notebook for easy access",
    authors: [Devs.Nyako],
    dependencies: ["MessagePopoverAPI", "ServerListAPI"],

    start() {
        addServerListElement(ServerListRenderPosition.Above, this.renderNotesButton);
        addButton("AddNote", msg => {
            let channel = ChannelStore.getChannel(msg.channel_id);
            return {
                label: "Add to Notebook",
                icon: NotebookIcon,
                message: msg,
                channel: channel,
                onClick: () => {
                    /* const newNote: SavedNote = {
                        id: msg.id,
                        author: msg.author.id,
                        content: msg.content,
                        meta: {
                            guildId: channel.guild_id,
                            channelId: channel.id,
                        },
                        attachments: msg.attachments,
                    }; */
                    addNote(fakeMessage(msg));
                }
            };
        });
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, this.renderNotesButton);
        removeButton("AddNote");
    },

    renderNotesButton: () => <NotesButton />,
});

