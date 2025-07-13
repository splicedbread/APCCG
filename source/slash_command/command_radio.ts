import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, InteractionType, Message, SlashCommandBuilder } from "discord.js";
import discord from "discord.js";
import ApccgSlashCommand from "./apccg_slash_command.js";
import { Logger, MessageType } from "../logger.js";
import {
    AudioPlayer,
    DiscordGatewayAdapterCreator,
    NoSubscriberBehavior,
    StreamType,
    VoiceConnection,
    createAudioResource,
    getVoiceConnection,
    joinVoiceChannel,
} from "@discordjs/voice";
import Database from "../database.js";

export default class CommandRadio extends ApccgSlashCommand {
    public disabled(): boolean {
        return false;
    }

    public commandData(): any {
        return new SlashCommandBuilder()
            .setName("radio")
            .setDescription("Play internet radio")
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("play")
                    .setDescription("Join a channel and play the stream specified")
                    .addStringOption((input) =>
                        input.setRequired(true).setName("stream_name").setDescription("name of the stream to play")
                    )
            )
            .addSubcommand((subcommand) =>
                subcommand.setName("stop").setDescription("Stop playing music and leave the channel")
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("remove")
                    .setDescription("Remove a stream from the list")
                    .addStringOption((input) =>
                        input.setRequired(true).setName("stream_name").setDescription("name of the stream to remove")
                    )
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("add")
                    .setDescription("Add a stream to the list")
                    .addStringOption((input) =>
                        input.setRequired(true).setName("stream_name").setDescription("name of the stream to add")
                    )
                    .addStringOption((input) =>
                        input.setRequired(true).setName("stream_url").setDescription("URL of the stream to add")
                    )
            )
            .addSubcommand((subcommand) =>
                subcommand.setName("list").setDescription("Show list of all radio stations")
            );
    }

    public async execute(args: any[]): Promise<boolean> {
        const interaction = args[0] as discord.CommandInteraction;

        // Filters down command type so that getSubcommand() will work
        if (interaction.type !== InteractionType.ApplicationCommand || !interaction.isChatInputCommand()) return false;

        let subcommandName: string = interaction.options.getSubcommand();

        switch (subcommandName) {
            case "play":
                return await this.JoinChannelAndPlay(interaction);
            case "stop":
                return await this.leaveChannelAndStop(interaction);
            case "add":
                return await this.addRadioToDatabase(interaction);
            case "remove":
                return await this.removeRadioFromDatabase(interaction);
            case "list":
                return await this.listAvailableRadio(interaction);
            default:
                Logger.log("Invalid subcommand run on /radio", MessageType.ERROR);
        }

        return false;
    }

    public override getTitle(): string {
        return "Radio";
    }

    public override getDescription(): string {
        return `**/radio play** [radio name] -> Join a channel and play the stream specified
        **/radio stop** -> Stop playing music leave the channel
        **/radio list** -> Lists available radio stations
        **/radio add** [radio name] [radio stream url]-> Add a radio stream
        **/radio remove** [radio name] -> Delete radio entry from list`;
    }

    audioPlayer: AudioPlayer | null = null;
    connection: VoiceConnection | null = null;
    lastStream: string | null = null;

    private async listAvailableRadio(interaction: ChatInputCommandInteraction): Promise<boolean> {
        const databaseResult = await Database.instance().getAllRadioStations();

        if (databaseResult == null) {
            interaction.reply("The day the music died (today) :weary:");
            return false;
        }

        let radioNames = "";
        let radioUrls = "";

        for (const obj of databaseResult) {
            radioNames += (obj as any).radio_name + "\n";
            radioUrls += (obj as any).radio_stream_link + "\n";
        }

        if (radioNames === "") {
            radioNames = "-";
        }

        if (radioUrls === "") {
            radioUrls = "-";
        }

        const embed = new EmbedBuilder()
            .setTitle("Radio Stations")
            .setColor("#FFFFFF")
            .setTimestamp()
            .addFields(
                { name: "Radio Name", value: radioNames, inline: true },
                { name: "Radio URL", value: radioUrls, inline: true }
            );

        interaction.reply({ embeds: [embed] });
        return true;
    }

    private async removeRadioFromDatabase(interaction: ChatInputCommandInteraction): Promise<boolean> {
        const streamName = interaction.options.get("stream_name")?.value;
        if (streamName == null || typeof streamName !== "string") return false;

        let success = await Database.instance().removeRadioStation(streamName);
        if (success) interaction.reply("Successfully removed the radio, if it existed.");
        else interaction.reply("Failed to remove entry.");

        return success;
    }

    private async addRadioToDatabase(interaction: ChatInputCommandInteraction): Promise<boolean> {
        const streamName = interaction.options.get("stream_name")?.value;
        const streamUrl = interaction.options.get("stream_url")?.value;
        
        if (typeof streamName !== "string" || typeof streamUrl !== "string") return false;

        let success = await Database.instance().addRadioStation(streamName, streamUrl);

        if (success) interaction.reply(`Added ${streamUrl} as ${streamName}`);
        else interaction.reply(`Failed to add ${streamName}`);

        return success;
    }

    private async JoinChannelAndPlay(interaction: ChatInputCommandInteraction): Promise<boolean> {
        const streamName = interaction.options.get("stream_name")?.value;
        if (typeof streamName !== 'string') {
            interaction.reply("That is certainly not the name of the station!");
            return false;
        }

        let streamLink = await Database.instance().getRadioStationUrlByName(streamName);

        if (streamLink == null) {
            interaction.reply("No such number bozo");
            return false;
        }

        this.lastStream = streamLink;
        const resource = createAudioResource(streamLink);

        Logger.log(`Playing streamlink: ${streamLink}`, MessageType.DEBUG);

        if ((interaction.member! as GuildMember).voice.channel !== null) {
            Logger.log(`Joining channel and playing tunes.`, MessageType.DEBUG);

            this.connection = joinVoiceChannel({
                channelId: (interaction.member! as GuildMember).voice.channel!.id,
                guildId: interaction.guild!.id,
                adapterCreator: interaction.guild!.voiceAdapterCreator as any,
            });

            this.audioPlayer = new AudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });
            this.audioPlayer.on("error", (error) => {
                Logger.log(`Audio Error: ${error.message}`, MessageType.ERROR);
            });

            this.audioPlayer.on("stateChange", (oldState, newState) => {
                Logger.log(
                    `Audio player transitioned from ${oldState.status} to ${newState.status}`,
                    MessageType.DEBUG
                );
                if (newState.status === "idle") {
                    Logger.log("Restarting audio stream.", MessageType.DEBUG);
                    this.attemptToRestartAudio();
                }
            });

            this.audioPlayer.on("debug", (message) => {
                Logger.log(`Debug message from audio player:`, MessageType.DEBUG);
                Logger.log(message, MessageType.DEBUG);
            });

            this.connection.subscribe(this.audioPlayer);
            this.audioPlayer.play(resource);

            interaction.reply(`Playing **${streamName}**`);
            return true;
        } else {
            interaction.reply("Where exactly should I play those sick tunes HMMM?");
        }

        return false;
    }

    private attemptToRestartAudio(): void {
        if (this.lastStream == null) return;

        const resource = createAudioResource(this.lastStream);
        this.audioPlayer?.play(resource);
    }

    private async leaveChannelAndStop(interaction: ChatInputCommandInteraction): Promise<boolean> {
        const guildId = interaction.guild!.id;
        if (!guildId) {
            return false;
        }

        const connection = getVoiceConnection(guildId);

        if (connection) {
            interaction.reply("My god did that smell good");
            connection.disconnect();
        } else {
            interaction.reply("LET ME IN");
        }

        return false;
    }
}
