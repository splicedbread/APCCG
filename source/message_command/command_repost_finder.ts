import { CustomClient } from "../customclient.js";
import Database from "../database.js";
import { Logger, MessageType } from "../logger.js";
import ApccgMessageCommand from "./apccg_message_command.js";
import discord, {
    Attachment,
    Channel,
    CommandInteraction,
    InteractionType,
    Message,
    SlashCommandBuilder,
    TextChannel,
    User,
    channelLink,
} from "discord.js";

export default class CommandRepostFinder extends ApccgMessageCommand {
    // Disabled until further development
    // public pattern: RegExp = /image\/.*|video\/.*/;

    public override getTitle(): string {
        return "Repost Finder";
    }

    public override getDescription(): string {
        return "Triggers on media attatched messages, tags messages as reposts if already found in channel history";
    }

    public override async execute(message: discord.Message): Promise<void> {}

    public override isMatch(message: discord.Message): boolean {
        if (message.attachments.size == 1) {
            let attach = message.attachments.first() as Attachment;
            return !!attach.contentType.match(this.pattern);
        }
        return false;
    }
}
