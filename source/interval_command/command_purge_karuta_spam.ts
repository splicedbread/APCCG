import { CustomClient } from "../customclient.js";
import Database from "../database.js";
import { Logger, MessageType } from "../logger.js";
import ApccgIntervalCommand from "./apccg_interval_command.js";
import discord, { Channel, ChatInputCommandInteraction, CommandInteraction, InteractionType, Message, SlashCommandBuilder, TextChannel, User, channelLink } from "discord.js"; 


export default class CommandPurgeKarutaSpam extends ApccgIntervalCommand {
    lastRepeatEpoch : number = 0;
    repeatIntervalSeconds : number = 60;
    minMessageAgeToDeleteSeconds : number = 300;
    // must be less than or equal to 100
    messagesToLookBackOnLimit : number = 100;
    currentlyDisabled : boolean = false;

    commandData(): any {
        return new SlashCommandBuilder()
            .setName("kpurge")
            .setDescription("Control the auto-pruning of messages from and invoking Karuta")
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("register")
                    .setDescription("Register this channel to be purged")
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("unregister")
                    .setDescription("Remove this channel from the list of channels to be purged")
            )
            .addSubcommand((subcommand) =>
            subcommand
                .setName("force_delete")
                .setDescription("Remove messages around a certain message id")
                .addStringOption((input)=>
                    input.setName("messageid").setDescription("Id of message to center deletion around").setRequired(true)
                )
        );
    }

    execute(args: any[]): Promise<boolean> {
        const interaction = args[0] as discord.CommandInteraction;

        // Filters down command type so that getSubcommand() will work
        if (interaction.type !== InteractionType.ApplicationCommand || !interaction.isChatInputCommand()) 
            return new Promise<boolean> (() => false);

        let subcommandName: string = interaction.options.getSubcommand();
        switch (subcommandName) {
            case "register":
                return this.addChannelToDatabase(interaction);
            case "unregister":
                return this.removeChannelFromDatabase(interaction);
            case "force_delete":
                return this.deleteMessagesAround(interaction);
            default:
                Logger.log("Invalid subcommand run on /kpurge", MessageType.ERROR);
        }

        return new Promise<boolean> (() => false);
    }

    getInterval(): number {
        return this.repeatIntervalSeconds;
    }

    executeInterval(): Promise<boolean> {
        this.lastRepeatEpoch = Date.now() / 1000;

        try {
            Database.instance().getAllChannelsToKPurge().then((registeredChannels) => {
                if (registeredChannels === null) {
                    return;
                }

                for (const channelIdRow of registeredChannels) {
                    CustomClient.instance().channels.fetch((channelIdRow as any).channel_id).then((channel) => {
                        if (channel === null || !channel.isTextBased()) {
                            return;
                        }
    
                        channel.messages.fetch({ limit: this.messagesToLookBackOnLimit, cache: false}).then((messages) => {
                            for (const message of messages.values()) {
                                this.shouldDeleteMessage(message).then(shouldDelete => {
                                    if (shouldDelete) {
                                        message.delete().catch((err)=>{ /*✍️ ( ῟ᾥ῏ )✍️*/ });
                                    }
                                }).catch((err)=>{ /*ᕙ꒰  ˙꒳​˙   ꒱ᕗ */ }); 
                            }
                        });
                    }).catch((err) => {});
                }
    
                return new Promise<boolean>(() => true);
            });
        }
        catch (err) {
            Logger.log("Error encountered when deleting kspam")
        }

        return new Promise<boolean>(() => false);
    }

    disabled(): boolean {
        return this.currentlyDisabled;
    }

    getTitle(): string {
        return "Wipe KSpam";
    }

    getDescription(): string {
        return `**/register** -> Register channel to be purged
        **/unregister** -> Unregister channel from the purge list
        **/force_delete** -> Delete messages around a given message id
        Triggers every ${this.repeatIntervalSeconds} seconds. Deletes all messages invoking karuta or from karuta that are older than ${this.minMessageAgeToDeleteSeconds} seconds`;
    }

    shouldRepeatNow(): Promise<boolean> {
        if (Date.now() / 1000 - this.lastRepeatEpoch < this.repeatIntervalSeconds) {
            return new Promise<boolean>(() => false);
        }
        
        return new Promise<boolean>(() => true);
    }

    private async shouldDeleteMessage(message: Message) {
        const karutaId = '646937666251915264';
        const mantaroId = '213466096718708737';

        if (Math.abs(message.createdTimestamp - Date.now())/1000 < this.minMessageAgeToDeleteSeconds) {
            return false;
        }

        if (message.author.id === karutaId) {
            return true;
        }
        
        const messageContent = message.cleanContent;
        /* Purgable karuta text commands from users */
        if ((messageContent.startsWith('k') || messageContent.startsWith('K')) && messageContent.length < 30) { 
            return true;
        }

        if (message.author.id === mantaroId && messageContent.match(/-https:\/\/(twitter|x).com/g)) {
            return true;
        }
    }

    private async addChannelToDatabase(interaction: CommandInteraction): Promise<boolean> {
        const channelId = interaction.channel?.id;
        if (channelId === null || channelId === undefined) {
            return new Promise<boolean> (()=>false);
        }
        
        const success = await Database.instance().addChannelToKPurge(channelId);

        if (success) {
            interaction.reply("Added the channel to the naughty list");
        }
        else {
            interaction.reply("He's already dead boss");
        }

        return new Promise<boolean>(()=>{success});
    }

    private async deleteMessagesAround(interaction: ChatInputCommandInteraction): Promise<boolean> {
        if (interaction.channel === null) {
            interaction.reply("Where ARE you?");
            return new Promise<boolean>(()=>{false});
        }

        const aroundMessageId = interaction.options.get("messageid")?.value as string;

        interaction.channel.messages.fetch({ limit: this.messagesToLookBackOnLimit, around: aroundMessageId, cache: false}).then((messages) => {
            for (const message of messages.values()) {
                this.shouldDeleteMessage(message).then(shouldDelete => {
                    if (shouldDelete) {
                        message.delete().catch((err)=>{ /*✍️ ( ῟ᾥ῏ )✍️*/ });
                    }
                }).catch((err)=>{ /*ᕙ꒰  ˙꒳​˙   ꒱ᕗ */ }); 
            }
        });

        interaction.reply(`Attempting to delete messages around ${aroundMessageId}`).then((interactionResponse) => {setTimeout(()=>{interactionResponse.delete()}, 5000)});

        return new Promise<boolean>(()=>{true});
    }

    private async removeChannelFromDatabase(interaction: CommandInteraction): Promise<boolean> {
        const channelId = interaction.channel?.id;
        if (channelId === null || channelId === undefined) {
            return new Promise<boolean> (() => false);
        }

        const success = await Database.instance().removeChannelToKPurge(channelId);

        if (success) {
            interaction.reply("The turkey has been pardoned");
        }
        else {
            interaction.reply("Wow, that went worse than I thought possible");
        }

        return new Promise<boolean>(()=>{success});
    }
}