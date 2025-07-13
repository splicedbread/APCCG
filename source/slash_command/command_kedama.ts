import { ChatInputCommandInteraction, CommandInteraction, InteractionType, SlashCommandBuilder } from "discord.js";
import discord from "discord.js";
import ApccgSlashCommand from "./apccg_slash_command.js";
import { Logger, MessageType } from "../logger.js";
import Database from "../database.js";

export default class CommandHello extends ApccgSlashCommand {
    public override disabled(): boolean {
        return false;
    }

    public override commandData(): any {
        return new SlashCommandBuilder().setName("kedama").setDescription("Use a random kaomoji face")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("add")
                .setDescription("Add a new kaomoji to roll")
                .addStringOption((input) =>
                    input.setRequired(true).setName("kaomoji").setDescription("the face to add")
                )
        )
        .addSubcommand((subcommand) =>
            subcommand.setName("roll").setDescription("roll your fortune")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("list")
                .setDescription("Show a list of all kaomoji")
        );
    }

    public override async execute(args: any[]): Promise<boolean> {
        const interaction = args[0] as discord.CommandInteraction;

        // Filters down command type so that getSubcommand() will work
        if (interaction.type !== InteractionType.ApplicationCommand || !interaction.isChatInputCommand()) return false;

        let subcommandName: string = interaction.options.getSubcommand();

        switch (subcommandName) {
            case "add":
                return await this.addKaomojiToDatabase(interaction);
            case "roll":
                return await this.getRandomKaomoji(interaction);
            case "list":
                return await this.listAllKaomoji(interaction);
            default:
                Logger.log("Invalid subcommand run on /radio", MessageType.ERROR);
        }

        return false;
    }

    public override getTitle(): string {
        return "Kedama";
    }

    public override getDescription(): string {
        return `**/kedama add** [face] -> Add face to dictionary
        **/kedama roll** -> Get a random face
        **/kedama list** -> Print a list of all registered emojis
        `;
    }

    private async addKaomojiToDatabase(interaction: ChatInputCommandInteraction): Promise<boolean> {
        const kaomoji = interaction.options.get("kaomoji")?.value;
        
        if (typeof kaomoji !== "string") return false;

        let success = await Database.instance().addKedama(kaomoji);

        if (success) interaction.reply(`Added ${kaomoji}`);
        else interaction.reply(`**PEBKAC Error**`);

        return success;
    }

    private async listAllKaomoji(interaction: CommandInteraction): Promise<boolean> {
        const databaseResult = await Database.instance().getAllKedama();

        if (databaseResult == null) {
            interaction.reply("The day the kedama died (today) :weary:");
            return false;
        }

        let kedamaFaces = "";

        for (const obj of databaseResult) {
            kedamaFaces += (obj as any).face + "\n";
        }

        if (kedamaFaces === "") {
            kedamaFaces = "-";
        }
        
        interaction.reply(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
        interaction.channel!.send(`\`\`\`\n${kedamaFaces}\n\`\`\``);
        interaction.channel!.send("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<")
        return true;
    }

    private async getRandomKaomoji(interaction : CommandInteraction) : Promise<boolean> {
        const databaseResult = await Database.instance().getAllKedama();

        if (databaseResult == null) {
            interaction.reply("The day the kedama died (today) :weary:");
            return false;
        }

        let randomIndex = Math.floor(Math.random() * (databaseResult.length));

        interaction.reply((databaseResult[randomIndex] as any).face as string);
        return true;
    }
}