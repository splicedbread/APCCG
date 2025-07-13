import { ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, GuildMember, InteractionType, Message, SlashCommandBuilder } from "discord.js";
import ApccgSlashCommand from "./apccg_slash_command.js";
import { Logger, MessageType } from "../logger.js";
import { AudioPlayer, DiscordGatewayAdapterCreator, NoSubscriberBehavior, VoiceConnection, createAudioResource, getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";
import ytdl from '@distube/ytdl-core';
import { google } from 'googleapis';
import hmt from "../../hmt.json" with { type: "json" };


export default class CommandRadio extends ApccgSlashCommand {
    public disabled(): boolean {
        return false;
    }

    public commandData(): any {
        return new SlashCommandBuilder()
            .setName("youtube")
            .setDescription("Interact with Youtube")
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("play")
                    .setDescription("Join a channel and play the video specified")
                    .addStringOption((input) =>
                        input.setRequired(true).setName("video_url").setDescription("URL of the video to play")
                    )
            )
            .addSubcommand((subcommand) =>
                subcommand.setName("stop").setDescription("Stop playing music and leave the channel")
            )
            .addSubcommand((subcommand) =>
                subcommand.setName("repeat").setDescription("Toggle repeat of current song")
                    .addStringOption(option => 
                        option.setName("repeat_option")
                        .setDescription("Repeat track or playlist")
                        .addChoices({name: "playlist", value: "playlist"}, {name: "track", value: "track"}, {name: "off", value: "off"})
                        .setRequired(true))
            )
            .addSubcommand((subcommand) =>
                subcommand.setName("queue").setDescription("View song queue")
            )
            .addSubcommand((subcommand) =>
                subcommand.setName("skip").setDescription("Skip to the next song in the queue")
                    .addIntegerOption((option) => 
                        option.setName("number_to_skip")
                            .setDescription("Number of songs to skip")
                            .setRequired(false))
            )
            .addSubcommand((subcommand) =>
                subcommand.setName("shuffle").setDescription("Shuffle all songs in the queue")
            );
    }
  
    public async execute(args: any[]): Promise<boolean> {
        const interaction = args[0] as CommandInteraction;

        // Filters down command type so that getSubcommand() will work
        if (interaction.type !== InteractionType.ApplicationCommand || !interaction.isChatInputCommand()) return false;

        let subcommandName: string = interaction.options.getSubcommand();

        switch (subcommandName) {
            case "play":
                return await this.queueSong(interaction);
            case "stop":
                return await this.leaveChannelAndStop(interaction);
            case "repeat":
                return this.toggleRepeatCurrentTrack(interaction);
            case "queue":
                return this.viewQueue(interaction);
            case "skip":
                return this.skipSong(interaction);
            case "shuffle":
                return this.shuffleQueue(interaction);
            default:
                Logger.log("Invalid subcommand run on /youtube", MessageType.ERROR);
        }

        return false;
    }

    public override getTitle(): string {
        return "Youtube";
    }

    public override getDescription(): string {
        return `**/youtube play** [video URL] -> Join a channel and play the URL specified
        **/youtube stop** -> Stop playing music leave the channel
        **/youtube repeat** -> Toggle repeat of current song
        **/youtube shuffle** -> shuffle songs in queue
        **/youtube queue** -> Show queued songs
        **/youtube skip** -> Skip to next song in queue`;
    }


    youtube = google.youtube({
        version: 'v3',
        auth: hmt.YOUTUBE_API_KEY,
    });


    audioPlayerToChannelMap : { [key: string]: AudioPlayer } = {};
    connectionToChannelMap : { [key: string]: VoiceConnection } = {};
    currentSongToChannelMap : { [key: string]: string } = {};
    videoQueueToChannelMap : { [key: string]: YoutubeVideoDetails[] } = {};
    repeatModeToChannelMap : { [key: string]: "track" | "none" | "playlist" } = {};

    private getRepeatMode(interaction: CommandInteraction): "track" | "none" | "playlist" {
        if (interaction.guildId === null) {
            return "none";
        }

        if (interaction.guildId in this.repeatModeToChannelMap) {
            return this.repeatModeToChannelMap[interaction.guildId];
        }

        return "none";
    }

    private setRepeatMode(interaction: CommandInteraction, repeatMode: "track" | "none" | "playlist") {
        if (interaction.guildId === null) {
            return;
        }

        this.repeatModeToChannelMap[interaction.guildId] = repeatMode;
    }

    private getVideoQueue(interaction: CommandInteraction): YoutubeVideoDetails[] {
        if (interaction.guildId === null) {
            return [];
        }

        if (!(interaction.guildId in this.videoQueueToChannelMap)) {
            this.videoQueueToChannelMap[interaction.guildId] = [];
        }

        return this.videoQueueToChannelMap[interaction.guildId];
    }

    private setVideoQueue(interaction: CommandInteraction, videoQueue: YoutubeVideoDetails[] | null): void{
        if (interaction.guildId === null) {
            return;
        }

        if (videoQueue === null) {
            delete this.videoQueueToChannelMap[interaction.guildId];
            return;
        }
        
        this.videoQueueToChannelMap[interaction.guildId] = videoQueue;
    }

    private getVoiceConnection(interaction: CommandInteraction): VoiceConnection | null {
        if (interaction.guildId && interaction.guildId in this.connectionToChannelMap) {
            return this.connectionToChannelMap[interaction.guildId];
        }

        return null;
    }

    private setVoiceConnection(interaction: CommandInteraction, connection: VoiceConnection | null): void {
        if (interaction.guildId === null) {
            return;
        }

        if (connection === null) {
            delete this.connectionToChannelMap[interaction.guildId];
            return;
        }
        
        this.connectionToChannelMap[interaction.guildId] = connection;
    }

    private getCurrentSongUrl(interaction: CommandInteraction): string {
        if (interaction.guildId && interaction.guildId in this.currentSongToChannelMap) {
            return this.currentSongToChannelMap[interaction.guildId];
        }

        return "";
    }

    private setCurrentSongUrl(interaction: CommandInteraction, currentSongUrl: string | null): void {
        if (interaction.guildId === null) {
            return;
        }

        if (currentSongUrl === null) {
            delete this.currentSongToChannelMap[interaction.guildId];
            return;
        }
        
        this.currentSongToChannelMap[interaction.guildId] = currentSongUrl;
    }

    private getAudioPlayer(interaction: CommandInteraction): AudioPlayer | null {
        if (interaction.guildId && interaction.guildId in this.audioPlayerToChannelMap) {
            return this.audioPlayerToChannelMap[interaction.guildId];
        }

        return null;
    }

    private setAudioPlayer(interaction: CommandInteraction, audioPlayer : AudioPlayer | null): void {
        if (interaction.guildId === null) {
            return;
        }

        if (audioPlayer === null) {
            delete this.audioPlayerToChannelMap[interaction.guildId];
            return;
        }

        this.audioPlayerToChannelMap[interaction.guildId] = audioPlayer;
    }

    private shuffleQueue(interaction: CommandInteraction) : boolean {
        let newQueue = [];

        while (this.getVideoQueue(interaction).length !== 0) {
            let randomIndex = Math.floor(Math.random() * 100) % this.getVideoQueue(interaction).length;
        
            newQueue.push(this.getVideoQueue(interaction).splice(randomIndex, 1)[0]);    
        }

        this.setVideoQueue(interaction, newQueue);


        let factorialChart = [
            1, 
            2, 
            6, 
            24, 
            120, 
            720, 
            5040, 
            40320, 
            362880, 
            3628800,
            39916800,
            479001600,
            6227020800,
            87178291200,
            1307674368000,
            20922789888000,
            355687428096000,
            6402373705728000,
            121645100408832000n,
            2432902008176640000n
        ]

        if (this.getVideoQueue(interaction).length <= 20) {
            interaction.reply(`Picked the *definitive* best order for your playlist out of ${factorialChart[this.getVideoQueue(interaction).length - 1]} possiblities!`);
        }
        else {
            interaction.reply(`Picked the definitive best order for your playlist out of`);
            interaction.channel!.send("# NEAR INFINITE");
            interaction.channel!.send("possiblities!");
        }

        return true;
    }

    private skipSong(interaction: ChatInputCommandInteraction) : boolean {
        if (this.getRepeatMode(interaction) !== "none") {
            this.setRepeatMode(interaction, "none");
            interaction.channel?.send("(Repeat disabled)");
        }

        let skipNumber = interaction.options.get("number_to_skip")?.value as number ?? 1;

        while (skipNumber > 1) {
            this.getVideoQueue(interaction).shift();
            skipNumber--;
        }

        interaction.reply("Skipping the song...");

        this.playNextSong(interaction);

        return true;
    }


    private toggleRepeatCurrentTrack(interaction: ChatInputCommandInteraction) : boolean {

        let repeatOption = interaction.options.get("repeat_option")?.value as string;

        if (repeatOption === "none") {
            this.setRepeatMode(interaction, "none");;
        }
        else if (repeatOption === "track") {
            this.setRepeatMode(interaction, "track");;
        }
        else if (repeatOption === "playlist") {
            this.setRepeatMode(interaction, "playlist");;
        }
        else {
            this.setRepeatMode(interaction, "none");;
        }



        if (this.getRepeatMode(interaction) === "track") {
            interaction.reply("Repeating current track!");
        }
        else if (this.getRepeatMode(interaction) === "playlist") {
            interaction.reply("Repeating current playlist");
        }
        else {
            interaction.reply("I am repeat you off :pensive:");
        }

        return true;
    }


    private convertIsoDurationToSeconds(isoDuration : string) : number {
        try {
            let totalSeconds = 0;
            let hours = isoDuration.match(/(\d+)H/);
            let minutes = isoDuration.match(/(\d+)M/);
            let seconds = isoDuration.match(/(\d+)S/);
        
            if (hours) totalSeconds += parseInt(hours[1]) * 3600;
            if (minutes) totalSeconds += parseInt(minutes[1]) * 60;
            if (seconds) totalSeconds += parseInt(seconds[1]);
        
            return totalSeconds;
        }
        catch (err) {
            Logger.log(err, MessageType.LOG);
        }
    }

    private async getSingleVideoDetails(videoId: string): Promise<YoutubeVideoDetails | null> {
        try {
            const response = await this.youtube.videos.list({
                part: ['snippet', 'contentDetails'],
                id: [videoId]
            }).catch(err => Logger.log(err, MessageType.LOG));

            if (response == null) {
                Logger.log("Exception occured in getSingleVideoDetails");
                return null;
            }
            if ((response as any)!.data!.items === undefined || (response as any).data.items.length === 0) {
                Logger.log("Failed in first section");
              return null;
            }
        
            const video = (response as any).data.items[0];
            const title = video!.snippet!.title ?? "";
            const channelName = video!.snippet!.channelTitle ?? "";
            const durationSeconds = this.convertIsoDurationToSeconds(video!.contentDetails!.duration ?? "");
            

            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

            return new YoutubeVideoDetails(title, durationSeconds, channelName, videoUrl);
          } catch (error) {
            console.error('Failed to retrieve video details:', error);
            return null;
          }
    }

    private async getPlaylistVideosFromAPI(playlistId: string, nextPageToken = '', youtubeVideoDetails: YoutubeVideoDetails[] = []): Promise<YoutubeVideoDetails[] | null> {
        try {
          const response = await this.youtube.playlistItems.list({
            part: ['snippet','contentDetails'],
            playlistId: playlistId,
            maxResults: 50, // Max allowed by the API
            pageToken: nextPageToken,
          });

          if (response === undefined) {
            return [];
          }
          
          let index = 0;
          response.data.items!.forEach(item => {
            const videoId = item.snippet!.resourceId!.videoId;
            const video = response!.data!.items![index];
            index++;
            const title = video.snippet!.title ?? "";
            const channelName = video.snippet!.channelTitle ?? "";
            Logger.log(`Durations: ${video.contentDetails!.endAt ?? ""} AND ${video.contentDetails!.startAt ?? ""} AND ${(video.contentDetails as any)!.duration ?? ""}`);
            const durationSeconds = this.convertIsoDurationToSeconds(video.contentDetails!.endAt ?? "") - this.convertIsoDurationToSeconds(video.contentDetails!.startAt ?? "");

            
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            youtubeVideoDetails.push(new YoutubeVideoDetails(title, durationSeconds, channelName, videoUrl));
          });
      
          if (response.data.nextPageToken) {
            return this.getPlaylistVideosFromAPI(playlistId, response.data.nextPageToken, youtubeVideoDetails).catch((err) => { Logger.log(err, MessageType.LOG)}) as any;
          } else {
            return youtubeVideoDetails;
          }
        } catch (error) {
          console.error('Error fetching playlist videos:', error);
          return [];
        }
      }

    private viewQueue(interaction: CommandInteraction): boolean {
        try {
            interaction.reply({embeds: [this.getQueueEmbed(interaction)]});
            return true;
        }
        catch (err) {
            Logger.log(err, MessageType.LOG);
        }
    }

    private getQueueEmbed(interaction: CommandInteraction): EmbedBuilder {
        try {
            const blue = 0x6699cc;

            let queueString = "";
    
            for (const videoDetails of this.getVideoQueue(interaction)) {
                const durationString = `${Math.floor(videoDetails.durationSeconds / 60)}:${Math.floor(videoDetails.durationSeconds % 60)}`;
                const newString = `**[${videoDetails.videoName}]** - ${videoDetails.channelName} [${durationString === "0" ? "?" : durationString}]\n`;
    
                if (newString.length + queueString.length >= 1020) {
                    queueString += "...";
                    break;
                }
    
                queueString += newString;
            }
            
            return (
                new EmbedBuilder()
                    .setTitle("Queue")
                    .setColor(blue)
                    .addFields(
                        {
                            name: "Currently playing",
                            value: this.getCurrentSongUrl(interaction)
                        },
                        {
                            name: "Queue",
                            value: queueString,
                        }
                    )
                    .setTimestamp()
            );
        }
        catch (err) {
            Logger.log(err, MessageType.LOG);
        }
    }

    private playNextSong(interaction: CommandInteraction): void {
        try {
            if (this.getRepeatMode(interaction) === "track" && this.getCurrentSongUrl(interaction) !== null) {

                const stream = ytdl(this.getCurrentSongUrl(interaction), { filter: 'audioonly' });
                const resource = createAudioResource(stream);
    
                this.getAudioPlayer(interaction)!.play(resource);
    
                // Spams chat with the same message on account of the repeating nature.
                // interaction.channel!.send(`Playing **${this.getCurrentSongUrl(interaction)}**`);
                
                return;
            }
    
            if (this.getVideoQueue(interaction).length > 0) {
                const nextVideoDetails = this.getVideoQueue(interaction).shift();
                
    
                if (nextVideoDetails === undefined || this.getAudioPlayer(interaction) === null) {
                    return;
                }
    
                if (this.getRepeatMode(interaction) === "playlist") {
                    this.getVideoQueue(interaction).push(nextVideoDetails);
                }
    
    
                this.setCurrentSongUrl(interaction, nextVideoDetails.url);
    
                const stream = ytdl(nextVideoDetails.url, { filter: 'audioonly' });
                const resource = createAudioResource(stream);
    
                this.getAudioPlayer(interaction)!.play(resource);
                interaction.channel!.send(`Playing **[${nextVideoDetails.videoName}](${nextVideoDetails.url}) - [${nextVideoDetails.durationSeconds}s]**`);
            } else {
                Logger.log("No more songs in the queue.", MessageType.DEBUG);
                this.leaveChannelAndStop(interaction);
            }
        }
        catch (err) {
            Logger.log(err, MessageType.LOG);
        }
    }

    private joinChannelAndRegisterHooks(interaction: CommandInteraction) {
        try {
            if ((interaction.member! as GuildMember).voice.channel !== null) {
                Logger.log(`Joining channel and playing tunes.`, MessageType.DEBUG);

            const connection = joinVoiceChannel({
                channelId: (interaction.member! as GuildMember).voice.channel!.id,
                guildId: interaction.guild!.id,
                adapterCreator: interaction.guild!.voiceAdapterCreator as DiscordGatewayAdapterCreator,
            });


            const audioPlayer = new AudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });

            audioPlayer.on("error", (error) => {
                Logger.log(`Audio Error: ${error.message}`, MessageType.ERROR);
            });

            audioPlayer.on("stateChange", (oldState, newState) => {
                Logger.log(
                    `Audio player transitioned from ${oldState.status} to ${newState.status}`,
                    MessageType.DEBUG
                );

                if (newState.status === "idle") {
                    Logger.log("Starting next song.", MessageType.DEBUG);
                    this.playNextSong(interaction);
                }
            });

            audioPlayer.on("debug", (message) => {
                Logger.log(`Debug message from audio player:`, MessageType.DEBUG);
                Logger.log(message, MessageType.DEBUG);
            });

            connection.subscribe(audioPlayer);

            this.setAudioPlayer(interaction, audioPlayer);
            this.setVoiceConnection(interaction, connection);

            this.playNextSong(interaction);
            return true;
            } else {
                interaction.reply("Where exactly should I play those sick tunes HMMM?");
            }
        }
        catch (err) {
            Logger.log(err, MessageType.LOG);
        }
    }

    private async queueSong(interaction: ChatInputCommandInteraction): Promise<boolean> {
        try {
            const videoUrl = interaction.options.get("video_url")?.value;
            if (typeof videoUrl !== 'string') {
                interaction.reply("That is certainly not the URL of the video!");
                return false;
            }
            
            interaction.reply(`Queuing up ${videoUrl}...`);
    
            if (videoUrl.includes("&list=")) { // For indirect playlist links like https://www.youtube.com/watch?v=DN0RLQZ9b1k&list=iUtyHuSfghTlyp-udhwidadoPWOIDHAO&index=1
                let playlistId: string = "";
                videoUrl.split("&").forEach((substring) => {
                    if (substring.includes("list=")) {
                        playlistId = substring.split("=")[1];
                    }
                })
    
                if (playlistId === "") {
                    interaction.channel!.send("Failed to parse playlist :c");
                    return false;
                }
    
                Logger.log(`Fetching playlist data for list with identifier ${playlistId}`)
                let results = await this.getPlaylistVideosFromAPI(playlistId);
                if (results == null) {
                    Logger.log("Ran into exception when getting videos");
                    return false;
                }
                this.getVideoQueue(interaction).push(...(results));
            }
            else if (videoUrl.includes("playlist")) { // For direct playlist links like https://www.youtube.com/playlist?list=iUtyHuSfghTlyp-udhwidadoPWOIDHAO
                let playlistId: string = videoUrl.split("?")[1].split("=")[1];
    
                if (playlistId === "") {
                    interaction.channel!.send("Failed to parse playlist :c");
                    return false;
                }
    
                Logger.log(`Fetching playlist data for list with identifier ${playlistId}`)
                let results = await this.getPlaylistVideosFromAPI(playlistId);
                if (results == null) {
                    Logger.log("Ran into exception when getting videos");
                    return false;
                }

                this.getVideoQueue(interaction).push(...(results));
            }
            else if (videoUrl.includes("youtu.be")) {
                // For links like this: https://youtu.be/ZZzzvYJ8gAY
    
                let videoId = videoUrl.split(".be/")[1];
                if (videoId.includes("?")) {
                    videoId = videoId.split("?")[0];
                }
                const youtubeDetails = await this.getSingleVideoDetails(videoId);
                if (youtubeDetails === null) {
                    Logger.log(`Error in fetching details for video ${videoUrl}`)
                    interaction.channel!.send("Failed to parse video :c");
                    return false;
                }
    
                this.getVideoQueue(interaction).push(new YoutubeVideoDetails(youtubeDetails.videoName, youtubeDetails.durationSeconds, youtubeDetails.channelName, youtubeDetails.url));
            }
            else {
                // For links like this: https://www.youtube.com/watch?v=HHHfW55oO33
                const videoId = videoUrl.split("?")[1].split("=")[1].slice(0, 11);
    
                const youtubeDetails = await this.getSingleVideoDetails(videoId);
                if (youtubeDetails === null) {
                    Logger.log(`Error in fetching details for video ${videoUrl}`)
                    interaction.channel!.send("Failed to parse video :c");
                    return false;
                }
    
                this.getVideoQueue(interaction).push(new YoutubeVideoDetails(youtubeDetails.videoName, youtubeDetails.durationSeconds, youtubeDetails.channelName, youtubeDetails.url));
            }
    
            if (this.getVoiceConnection(interaction) !== null) {
                return true;
            }
    
            this.joinChannelAndRegisterHooks(interaction);
    
            return true;

        }
        catch (err) {
            Logger.log(err, MessageType.LOG);
        }
    }

    private async leaveChannelAndStop(interaction: CommandInteraction): Promise<boolean> {
        try {
            const guildId = interaction.guild!.id;
            if (!guildId) {
                return false;
            }
    
            const connection = getVoiceConnection(guildId);
    
            if (connection) {
                if (interaction.replied) {
                    interaction.channel!.send("My good did that smell god");
                }
                else {
                    interaction.reply("My god did that smell good");
                }
                connection.disconnect();
                this.setVoiceConnection(interaction, null);
                this.setAudioPlayer(interaction, null);
                this.setCurrentSongUrl(interaction, null);
                this.setVideoQueue(interaction, null);
    
            } else {
                interaction.reply("LET ME IN");
            }
    
            return true;   
        }
        catch (err) {
            Logger.log(err, MessageType.LOG);
        }
    }
}


class YoutubeVideoDetails {

    public constructor(videoName : string, durationSeconds : number, channelName : string, url : string) {
        this.videoName = videoName;
        this.durationSeconds = durationSeconds;
        this.channelName = channelName;
        this.url = url;
    }

    videoName : string = "";
    durationSeconds: number = 0;
    channelName: string = "";
    url : string = "";
}