import { ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, Interaction, InteractionType, SlashCommandBuilder, User } from "discord.js";
import discord from "discord.js";
import ApccgSlashCommand from "./apccg_slash_command.js";
import { Logger, MessageType } from "../logger.js";
import Database from "../database.js";
import child_process from "child_process";

export default class CommandDocker extends ApccgSlashCommand {
    public override disabled(): boolean {
        return false;
    }

    public override commandData(): any {
        return new SlashCommandBuilder()
            .setName("docker")
            .setDescription("Control containers with Docker")
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("add")
                    .setDescription("Register a new Docker command")
                    .addStringOption((input) =>
                        input
                            .setRequired(true)
                            .setName("name")
                            .setDescription("short name for the command ([a-zA-Z0-9_]{3,20})")
                    )
                    .addStringOption((input) =>
                        input.setRequired(true).setName("command").setDescription("command to run (without --name)")
                    )
                    .addStringOption((input) =>
                        input.setRequired(false).setName("notes").setDescription("Server IP, other notes")
                    )
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("remove")
                    .setDescription("Remove a command")
                    .addStringOption((input) =>
                        input.setRequired(true).setName("name").setDescription("short name for the command")
                    )
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("run")
                    .setDescription("Run a command")
                    .addStringOption((input) =>
                        input.setRequired(true).setName("name").setDescription("short name for the command")
                    )
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("stop")
                    .setDescription("Stop a running container")
                    .addStringOption((input) =>
                        input.setRequired(true).setName("name").setDescription("short name for the command")
                    )
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("info")
                    .setDescription("Show the command aliased by short name")
                    .addStringOption((input) =>
                        input.setRequired(true).setName("name").setDescription("short name for the command")
                    )
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("op")
                    .setDescription("Add a user as a Docker operator")
                    .addUserOption((input) => input.setRequired(true).setName("user").setDescription("User to add"))
                    .addBooleanOption((input) =>
                        input.setRequired(true).setName("can_alter_users").setDescription("add/remove user permission")
                    )
                    .addBooleanOption((input) =>
                        input
                            .setRequired(true)
                            .setName("can_start_containers")
                            .setDescription("start container permission")
                    )
                    .addBooleanOption((input) =>
                        input
                            .setRequired(true)
                            .setName("can_stop_containers")
                            .setDescription("stop container permission")
                    )
                    .addBooleanOption((input) =>
                        input.setRequired(true).setName("can_add_commands").setDescription("add command permission")
                    )
                    .addBooleanOption((input) =>
                        input
                            .setRequired(true)
                            .setName("can_remove_commands")
                            .setDescription("remove command permission")
                    )
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName("de-op")
                    .setDescription("Remove a user as a Docker operator")
                    .addUserOption((input) => input.setRequired(true).setName("user").setDescription("User to remove"))
            )
            .addSubcommand((subcommand) => subcommand.setName("status").setDescription("Show container status"));
    }

    public override getTitle(): string {
        return "Docker Commands";
    }

    public override getDescription(): string {
        return `**/docker add** _[command name] [docker command] [(Optional) notes]_ -> Add a "docker run" command                                                 
      **/docker remove** _[command name]_ -> Remove an existing command                                                 
      **/docker run** _[command name]_ -> Run an available command                                                   
      **/docker stop** _[command name]_ -> Stop a running container                                                   
      **/docker status** -> See running containers and available commands                              
      **/docker op** _[user]_ -> Add permissions to a user                                                  
      **/docker de-op** _[user]_ -> Remove permissions from a user                                             
      **/docker info** _[command name]_ -> Display details about backing docker command`;
    }

    public override async execute(args: any[]): Promise<boolean> {
        const interaction = args[0] as discord.CommandInteraction;

        // Filters down command type so that getSubcommand() will work
        if (interaction.type !== InteractionType.ApplicationCommand || !interaction.isChatInputCommand()) return false;

        let subcommandName: string = interaction.options.getSubcommand();

        switch (subcommandName) {
            case "add":
                return await this.addCommand(interaction);
            case "info":
                return await this.getCommandInfo(interaction);
            case "remove":
                return await this.removeCommand(interaction);
            case "run":
                return await this.runCommand(interaction);
            case "stop":
                return await this.stopContainer(interaction);
            case "status":
                return await this.getDockerStatus(interaction);
            case "op":
                return await this.addUser(interaction);
            case "de-op":
                return await this.removeUser(interaction);
            default:
                Logger.log("Invalid subcommand run on /docker", MessageType.ERROR);
        }
        return true;
    }

    private rejectionString: string = "𝗧𝗵𝗲 𝗗𝗮𝗼 𝘁𝗵𝗮𝘁 𝗰𝗮𝗻 𝗯𝗲 𝘀𝗽𝗼𝗸𝗲𝗻 𝗶𝘀 𝗻𝗼𝘁 𝘁𝗵𝗲 𝗲𝘁𝗲𝗿𝗻𝗮𝗹 𝗗𝗮𝗼";

    private async getCommandInfo(interaction: ChatInputCommandInteraction): Promise<boolean> {
        let commandName = interaction.options.get("name")?.value as string;

        await interaction.reply(`Looking up info for ${commandName}...`);

        let database = Database.instance();
        let res = await database.getCommandContentsByName(commandName);

        if (res == null) {
            return new Promise<boolean>((resolve, reject) => resolve(false));
        }

        let commandFunction = (res as any).command_contents;

        if (commandFunction === "") commandFunction = "-";

        interaction.channel!.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`Command Info - ${commandName}`)
                    .setColor(0x6699cc)
                    .addFields(
                        {
                            name: "Command Name",
                            value: `${commandName}`,
                            inline: false,
                        },
                        {
                            name: "Command Function",
                            value: `${commandFunction}`,
                            inline: false,
                        }
                    )
                    .setTimestamp(),
            ],
        });

        return new Promise<boolean>((resolve, reject) => resolve(true));
    }

    private async addUser(interaction: ChatInputCommandInteraction): Promise<boolean> {
        if (!(await this.canAlterUsers(interaction))) {
            interaction.reply(this.rejectionString);
            return new Promise<boolean>((resolve, reject) => resolve(false));
        }

        let userToChange = interaction.user as User;
        const canAlterUsers = interaction.options.get("can_alter_users")?.value as boolean;
        const canAddCommands = interaction.options.get("can_add_commands")?.value as boolean;
        const canRemoveCommands = interaction.options.get("can_remove_commands")?.value as boolean;
        const canRunCommands = interaction.options.get("can_start_containers")?.value as boolean;
        const canStopCommands = interaction.options.get("can_stop_containers")?.value as boolean;

        let database = Database.instance();
        let res = await database.addDockerUser(
            userToChange.id,
            canAlterUsers,
            canAddCommands,
            canRemoveCommands,
            canRunCommands,
            canStopCommands
        );

        if (res) {
            interaction.reply(`Registered user \"${userToChange.username}\"`);
        } else {
            interaction.reply(`Failed to register user \"${userToChange.username}\"`);
        }

        return new Promise<boolean>((resolve, reject) => resolve(res));
    }

    private async removeUser(interaction: CommandInteraction): Promise<boolean> {
        if (!(await this.canAlterUsers(interaction))) {
            interaction.reply(this.rejectionString);
            return new Promise<boolean>((resolve, reject) => resolve(false));
        }

        let userToChange = interaction.user as User;

        let database = Database.instance();
        let res = await database.removeDockerUser(userToChange.id);

        if (res) {
            interaction.reply(`Removed user \"${userToChange.username}\"`);
        } else {
            interaction.reply(`Failed to remove user \"${userToChange.username}\"`);
        }

        return new Promise<boolean>((resolve, reject) => resolve(res));
    }

    private async addCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
        if (!(await this.canAddCommands(interaction))) {
            await interaction.reply(this.rejectionString);
            return new Promise<boolean>((resolve, reject) => resolve(false));
        }

        let commandName = interaction.options.get("name")?.value as string;

        let acceptableCommandNameRegex: RegExp = new RegExp("^[a-zA-Z0-9_]{3,20}$");
        if (!commandName.match(acceptableCommandNameRegex)) {
            await interaction.reply("You missed that one - try another! 🍾");
            return new Promise<boolean>((resolve, reject) => resolve(false));
        }

        let commandString = interaction.options.get("command")?.value as string;
        let notes = interaction.options.get("notes")?.value as string;
        if (notes == null) notes = "-";

        let database = Database.instance();
        let res = await database.addDockerCommand(commandName, commandString, notes);

        if (res) interaction.reply(`Added command \"${commandName}\" as \"${commandString}\"`);
        else interaction.reply(`Error adding command \"${commandName}\" as \"${commandString}\"`);

        return new Promise<boolean>((resolve, reject) => resolve(res));
    }

    private async removeCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
        if (!(await this.canRemoveCommands(interaction))) {
            interaction.reply(this.rejectionString);
            return new Promise<boolean>((resolve, reject) => resolve(false));
        }

        let commandName = interaction.options.get("name")?.value as string;

        let database = Database.instance();
        let res = await database.removeDockerCommand(commandName);

        if (res) interaction.reply(`Removed command \"${commandName}\", if it existed.`);
        else interaction.reply(`Error removing command \"${commandName}\"`);

        return new Promise<boolean>((resolve, reject) => resolve(res));
    }

    private async runCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
        if (!(await this.canRunCommands(interaction))) {
            interaction.reply(this.rejectionString);
            return new Promise<boolean>((resolve, reject) => resolve(false));
        }

        let commandName = interaction.options.get("name")?.value as string;

        let database = Database.instance();
        let res = await database.getCommandContentsByName(commandName);

        if (res == null) {
            interaction.reply(`Failed to find command \"${commandName}\"`);
        } else {
            let commandContents = (res as any).command_contents;
            interaction.reply(`Running container \"${commandName}\".`);
            let resArr = commandContents.split(" ");
            resArr.splice(2, 0, `--name="${commandName}"`);
            res = resArr.join(" ");
            child_process.spawn(`${res}`, { shell: true });
        }

        return new Promise<boolean>((resolve, reject) => resolve(res != null));
    }

    private async stopContainer(interaction: ChatInputCommandInteraction): Promise<boolean> {
        if (!(await this.canStopCommands(interaction))) {
            interaction.reply(this.rejectionString);
            return new Promise<boolean>((resolve, reject) => resolve(false));
        }

        let commandName = interaction.options.get("name")?.value as string;

        interaction.reply(`Stopping \"${commandName}\"...`);

        return new Promise<boolean>((resolve, reject) => {
            child_process.exec(`docker stop ${commandName}`, (error, stdout, stderr) => {
                if (error) {
                    interaction.channel!.send(`"${commandName}" was not running.`);
                    reject(`Error: ${error}`);
                    return;
                }
                if (stderr) {
                    interaction.channel!.send(`"${commandName}" was not running.`);
                    reject(`Stderr: ${stderr}`);
                    return;
                }

                interaction.channel!.send(`Stopped "${commandName}".`);
                resolve(true);
            });
        });
    }

    private async getDockerStatus(interaction: CommandInteraction): Promise<boolean> {
        await interaction.reply(`Inpsecting status...`);

        let database = Database.instance();
        let res = await database.getAllDockerCommands();

        if (res == null) {
            return new Promise<boolean>((resolve, reject) => resolve(false));
        }

        let commandNames = "";
        let commandFunctions = "";
        let notes = "";

        for (const commandRow of res) {
            commandNames += (commandRow as any).command_name + "\n";
            commandFunctions += (commandRow as any).command_contents + "\n";
            notes += (commandRow as any).notes + "\n";
        }

        if (commandFunctions === "") commandFunctions = "-";
        if (commandNames === "") commandNames = "-";
        if (notes === "") notes = "-";

        let activeContainers = (await this.getRunningContainers()).filter((entry) => {
            return commandNames.includes(entry);
        });
        let activeContainerText: string;
        if (activeContainers.length === 0) {
            activeContainerText = "No running containers";
        } else {
            activeContainerText = activeContainers.join("\n");
        }

        interaction.channel!.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Docker Info")
                    .setColor(0x6699cc)
                    .addFields(
                        {
                            name: "Command Name",
                            value: `${commandNames}`,
                            inline: true,
                        },
                        { name: "Notes", value: `${notes}`, inline: true },
                        {
                            name: "Active Containers",
                            value: `${activeContainerText}`,
                            inline: false,
                        }
                    )
                    .setTimestamp(),
            ],
        });

        return new Promise<boolean>((resolve, reject) => resolve(true));
    }

    private async canAlterUsers(interaction: CommandInteraction): Promise<boolean> {
        let database = Database.instance();
        let res = await database.getUserPermissions(interaction.user.id);

        return new Promise<boolean>((resolve, reject) => resolve(res.canAlterUsers));
    }

    private async canAddCommands(interaction: CommandInteraction): Promise<boolean> {
        let database = Database.instance();
        let res = await database.getUserPermissions(interaction.user.id);

        return new Promise<boolean>((resolve, reject) => resolve(res.canAddCommands));
    }

    private async canRemoveCommands(interaction: CommandInteraction): Promise<boolean> {
        let database = Database.instance();
        let res = await database.getUserPermissions(interaction.user.id);

        return new Promise<boolean>((resolve, reject) => resolve(res.canRemoveCommands));
    }

    private async canRunCommands(interaction: CommandInteraction): Promise<boolean> {
        let database = Database.instance();
        let res = await database.getUserPermissions(interaction.user.id);

        return new Promise<boolean>((resolve, reject) => resolve(res.canRunCommands));
    }

    private async canStopCommands(interaction: CommandInteraction): Promise<boolean> {
        let database = Database.instance();
        let res = await database.getUserPermissions(interaction.user.id);

        return new Promise<boolean>((resolve, reject) => resolve(res.canStopContainers));
    }

    private async getRunningContainers(): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            child_process.exec(`docker ps`, (error, stdout, stderr) => {
                if (error) {
                    reject(`Error: ${error}`);
                    return;
                }
                if (stderr) {
                    reject(`Stderr: ${stderr}`);
                    return;
                }

                let result = [];
                for (const output of stdout.matchAll(/(\w+)$/gm)) {
                    if (output[1] != "NAMES") result.push(output[1]);
                }

                resolve(result);
            });
        });
    }
}
