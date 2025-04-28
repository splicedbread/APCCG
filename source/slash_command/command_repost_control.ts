import { CustomClient } from "../customclient.js";
import Database from "../database.js";
import { Logger, MessageType } from "../logger.js";
import ApccgSlashCommand from "./apccg_slash_command.js";
import discord, {
    Channel,
    CommandInteraction,
    InteractionType,
    Message,
    SlashCommandBuilder,
    TextChannel,
    User,
    channelLink,
} from "discord.js";

export default class CommandRepostControl extends ApccgSlashCommand {
    lastRepeatEpoch: number = 0;
    repeatIntervalSeconds: number = 60;
    minMessageAgeToDeleteSeconds: number = 300;
    // must be less than or equal to 100
    messagesToLookBackOnLimit: number = 100;
    currentlyDisabled: boolean = true;

    public override commandData(): any {
        return new SlashCommandBuilder()
            .setName("repoast")
            .setDescription("Control the process of repost location")
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("register")
                    .setDescription(
                        "Register this channel to be be tracked for repost blaming",
                    ),
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("unregister")
                    .setDescription(
                        "Remove this channel from the list of channels that are being tracked for repost blame",
                    ),
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("forget_this")
                    .setDescription(
                        "Remove messages around a certain message id",
                    )
                    .addStringOption((input) =>
                        input
                            .setName("messageid")
                            .setDescription(
                                "Id of message to center deletion around",
                            )
                            .setRequired(true),
                    ),
            );
    }

    public override async execute(args: any[]): Promise<boolean> {
        const interaction = args[0] as discord.CommandInteraction;

        // Filters down command type so that getSubcommand() will work
        if (
            interaction.type !== InteractionType.ApplicationCommand ||
            !interaction.isChatInputCommand()
        )
            return new Promise<boolean>(() => false);

        let subcommandName: string = interaction.options.getSubcommand();
        switch (subcommandName) {
            case "register":
                return this.addChannelToDatabase(interaction);
            case "unregister":
                return this.removeChannelFromDatabase(interaction);
            case "forget_this":
                return this.forgetMessage(interaction);
            default:
                Logger.log(
                    "Invalid subcommand run on /repoast",
                    MessageType.ERROR,
                );
        }

        return new Promise<boolean>(() => false);
    }

    disabled(): boolean {
        return this.currentlyDisabled;
    }

    public override getTitle(): string {
        return "Repost Control";
    }

    getDescription(): string {
        return `**/register** -> Register channel to be tracked for repost blaming.
        **/unregister** -> Unregister channel from tracked repost blaming.
        **/forget_this** -> Delete message from the repost history.
        **/history_ingest** -> Ingest the history of the given channel for repost blaming.
        Triggers every new media message in a subscribed channel.`;
    }

    private async addChannelToDatabase(
        interaction: CommandInteraction,
    ): Promise<boolean> {
        const channelId = interaction.channel?.id;
        if (channelId === null || channelId === undefined) {
            return new Promise<boolean>(() => false);
        }

        const success = await Database.instance().addChannelToPoast(channelId);

        if (success) {
            interaction.reply("Added the channel to the 'to orphan' list");
        } else {
            interaction.reply("He's already dead boss");
        }

        return new Promise<boolean>(() => {
            success;
        });
    }

    private async forgetMessage(
        interaction: CommandInteraction,
    ): Promise<boolean> {
        return false;
    }

    private async removeChannelFromDatabase(
        interaction: CommandInteraction,
    ): Promise<boolean> {
        const channelId = interaction.channel?.id;
        if (channelId === null || channelId === undefined) {
            return new Promise<boolean>(() => false);
        }

        const success =
            await Database.instance().removeChannelFromPoast(channelId);

        if (success) {
            interaction.reply("The turkey has been pardoned");
        } else {
            interaction.reply("Wow, that went worse than I thought possible");
        }

        return new Promise<boolean>(() => {
            success;
        });
    }
}
