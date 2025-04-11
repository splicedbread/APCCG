import sqlite3, { RunResult } from "sqlite3";
import { Logger, MessageType } from "./logger.js";

interface UserPermissions {
    canAlterUsers: boolean;
    canRunCommands: boolean;
    canStopContainers: boolean;
    canAddCommands: boolean;
    canRemoveCommands: boolean;
}

export default class Database {
    private static dbinstance: Database | null = null;
    private sqliteDatabase: sqlite3.Database;
    private constructor() {
        this.sqliteDatabase = new sqlite3.Database(
            "./data/apccg.db",
            sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
            (err) => {
                if (err) {
                    Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                    console.error(err.message);
                }
                console.log("Connected to the database.");
            }
        );
    }

    public static instance(): Database {
        if (Database.dbinstance == null) {
            Database.dbinstance = new Database();
            Database.dbinstance.createTablesIfNotExist();
        }

        return Database.dbinstance;
    }

    public createTablesIfNotExist(): void {
        Logger.log(`Initializing tables...`, MessageType.DEBUG);

        this.sqliteDatabase.run(`CREATE TABLE IF NOT EXISTS DockerCommands (
            command_name TEXT PRIMARY KEY NOT NULL,
            command_contents TEXT,
            notes TEXT
        )`);

        this.sqliteDatabase.run(`CREATE TABLE IF NOT EXISTS TrustedUsers (
            user_id TEXT PRIMARY KEY NOT NULL,
            can_alter_users NUMERIC DEFAULT 0,
            can_add_commands NUMERIC DEFAULT 0,
            can_remove_commands NUMERIC DEFAULT 0,
            can_run_commands NUMERIC DEFAULT 0,
            can_stop_commands NUMERIC DEFAULT 0
        )`);

        this.sqliteDatabase.run(`CREATE TABLE IF NOT EXISTS RadioStreams (
            radio_name TEXT PRIMARY KEY NOT NULL,
            radio_stream_link TEXT NOT NULL
        )`);

        this.sqliteDatabase.run(`CREATE TABLE IF NOT EXISTS KSpamRemovalChannels (
            channel_id TEXT PRIMARY KEY NOT NULL
        )`);

        this.sqliteDatabase.run(`CREATE TABLE IF NOT EXISTS RepoastChannels (
            channel_id TEXT PRIMARY KEY NOT NULL
        )`);

        this.sqliteDatabase.run(`CREATE TABLE IF NOT EXISTS RepoastForgetMe (
            message_id TEXT PRIMARY KEY NOT NULL
        )`);

        this.sqliteDatabase.run(`CREATE TABLE IF NOT EXISTS RepoastMedia (
            message_id TEXT PRIMARY KEY NOT NULL,
            channel_id TEXT NOT NULL,
            message_hash TEXT NOT NULL
        )`);

        this.sqliteDatabase.run(`CREATE TABLE IF NOT EXISTS KedamaFaces (
            id INTEGER PRIMARY KEY,
            face TEXT NOT NULL UNIQUE
        )`);

        this.sqliteDatabase.run(`CREATE TABLE IF NOT EXISTS CustomCommands (
            command_name TEXT NOT NULL,
            command_text TEXT,
            attachment_path TEXT
        )`);
    }

    public getAllCustomCommandNames() : Promise<object[] | null> {
        Logger.log(`Getting all commands`);
        return new Promise<object[] | null>((resolve, reject) => {
            this.sqliteDatabase.all<string>(
                `
                SELECT DISTINCT command_name 
                FROM CustomCommands
                ORDER BY rowid ASC, command_name ASC`,
                (err: Error | null, rows: object[]) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(null);
                        return;
                    }

                    resolve(rows);
                    return;
                }
            );
        });
    }

    public getSingleCommand(commandName : string) : Promise<object | null> {
        return new Promise<object | null>((resolve, reject) => {
            this.sqliteDatabase.all<string>(
                `
                SELECT command_name, command_text, attachment_path 
                FROM CustomCommands
                WHERE command_name = ?
                ORDER BY rowid ASC`,
                [commandName],
                (err: Error | null, rows: unknown[]) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(null);
                        return;
                    }
                    if (rows == null || rows.length === 0) {
                        resolve(null);
                        return;
                    }

                    let rowN = 0;
                    if (rows.length > 1) {
                        rowN = Math.floor(Math.random() * (rows.length));
                        rowN = (rowN === rows.length) ? rows.length - 1 : rowN;
                    }

                    let result = rows[rowN];
                    resolve(result as object);
                    return;
                }
            );
        });
    }

    public removeSingleCommand(commandName : string) : Promise<boolean> {
        Logger.log(`Removing command '${commandName}'`);
        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
            DELETE FROM CustomCommands
            WHERE command_name = ?`,
                [commandName],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public addCustomCommand(commandName : string, commandText : string, attachmentPath : string) : Promise<boolean> {
        Logger.log(`Adding command ${commandName}`);
        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
            INSERT INTO CustomCommands (command_name, command_text, attachment_path)
            VALUES (?, ?, ?)`,
                [commandName, commandText, attachmentPath],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public getAllKedama() : Promise<object[] | null> {
        Logger.log(`Getting all kedama faces`);
        return new Promise<object[] | null>((resolve, reject) => {
            this.sqliteDatabase.all<string>(
                `
                SELECT face 
                FROM KedamaFaces`,
                (err: Error | null, rows: object[]) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(null);
                        return;
                    }

                    resolve(rows);
                    return;
                }
            );
        });
    }

    public addKedama(kaomoji: string) : Promise<boolean> {
        Logger.log(`Adding face ${kaomoji}`);
        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
            INSERT INTO KedamaFaces (face)
            VALUES (?)`,
                [kaomoji],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public addChannelToKPurge(channelId: string): Promise<boolean> {
        Logger.log(`Adding channel to purge ${channelId}`);
        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
            INSERT INTO KSpamRemovalChannels (channel_id)
            VALUES (?)`,
                [channelId],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public removeChannelToKPurge(channelId: string): Promise<boolean> {
        Logger.log(`Removing channel to purge ${channelId}`);
        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
            DELETE FROM KSpamRemovalChannels
            WHERE channel_id = ?`,
                [channelId],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public getAllChannelsToKPurge(): Promise<object[] | null> {
        Logger.log(`Retrieving all channels to purge`);
        return new Promise<object[] | null>((resolve, reject) => {
            this.sqliteDatabase.all<string>(
                `
                SELECT channel_id 
                FROM KSpamRemovalChannels`,
                (err: Error | null, rows: object[]) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(null);
                        return;
                    }

                    resolve(rows);
                    return;
                }
            );
        });
    }

    public addChannelToPoast(channelId: string): Promise<boolean> {
        Logger.log(`Adding channel to find poasts ${channelId}`);
        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
            INSERT INTO RepoastChannels (channel_id)
            VALUES (?)`,
                [channelId],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public removeChannelFromPoast(channelId: string): Promise<boolean> {
        Logger.log(`Removing channel from finding poasts ${channelId}`);
        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
            DELETE FROM RepoastChannels
            WHERE channel_id = ?`,
                [channelId],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public getAllChannelsToPoast(): Promise<object[] | null> {
        Logger.log(`Retrieving all channels to find poasts`);
        return new Promise<object[] | null>((resolve, reject) => {
            this.sqliteDatabase.all<string>(
                `
                SELECT channel_id 
                FROM RepoastChannels`,
                (err: Error | null, rows: object[]) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(null);
                        return;
                    }

                    resolve(rows);
                    return;
                }
            );
        });
    }

    public forgetMessageFromChannel(messageId: String): Promise<boolean> {
        Logger.log(`Adding message to be forgotten ${messageId}`);
        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
            INSERT INTO RepoastForgetMe (message_id)
            VALUES (?);

            DELETE FROM RepoastMedia
            WHERE message_id = ?;
            `,
                [messageId, messageId],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public addMediaPoastFromChannel(channelId: String, messageId: String, mediaHash: String): Promise<boolean> {
        Logger.log(`Adding media to be tracked, m:${messageId},c:${channelId}`);
        return new Promise<boolean>((resolve, reject) =>{ 
            this.sqliteDatabase.run(
                `
            INSERT INTO RepoastMedia (message_id, channel_id, media_hash)
            VALUES (?,?,?);
                `,
                [messageId, channelId, mediaHash],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public getAllMediaHashFromChannel(channelId: String): Promise<object[] | null> {
        Logger.log(`Retrieving all media poasts from channel ${channelId}`);
        return new Promise<object[] | null>((resolve, reject) => {
            this.sqliteDatabase.all<string>(
                `
                SELECT * 
                FROM RepoastMedia
                where channel_id = ${channelId}`,
                (err: Error | null, rows: object[]) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(null);
                        return;
                    }

                    resolve(rows);
                    return;
                }
            );
        });
    }

    public addRadioStation(radioName: string, radioLink: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
            INSERT INTO RadioStreams (radio_name, radio_stream_link)
            VALUES (?,?)`,
                [radioName, radioLink],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public getRadioStationUrlByName(radioName: string): Promise<string | null> {
        return new Promise<string | null>((resolve, reject) => {
            this.sqliteDatabase.all<string>(
                `
                SELECT radio_name, radio_stream_link 
                FROM RadioStreams
                WHERE radio_name = ?`,
                [radioName],
                (err: Error | null, rows: unknown[]) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(null);
                        return;
                    }
                    if (rows == null || rows.length === 0) {
                        resolve(null);
                        return;
                    }

                    let result = rows[0];
                    resolve((result as any).radio_stream_link as string);
                    return;
                }
            );
        });
    }

    public removeRadioStation(radioName: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
            DELETE FROM RadioStreams
            WHERE radio_name = ?`,
                [radioName],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public getAllRadioStations(): Promise<object[] | null> {
        return new Promise<object[] | null>((resolve, reject) => {
            this.sqliteDatabase.all<string>(
                `
                SELECT radio_name, radio_stream_link 
                FROM RadioStreams`,
                (err: Error | null, rows: object[]) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(null);
                        return;
                    }

                    resolve(rows);
                    return;
                }
            );
        });
    }

    public addDockerUser(
        userId: string,
        canAlterUsers: boolean,
        canAddCommands: boolean,
        canRemoveCommands: boolean,
        canRunCommands: boolean,
        canStopCommands: boolean
    ): Promise<boolean> {
        Logger.log(`Adding user ${userId}`, MessageType.DEBUG);

        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
            INSERT INTO TrustedUsers (user_id, can_alter_users, can_add_commands, can_remove_commands, can_run_commands, can_stop_commands)
            VALUES (?,?,?,?,?,?)`,
                [
                    userId,
                    canAlterUsers ? 1 : 0,
                    canAddCommands ? 1 : 0,
                    canRemoveCommands ? 1 : 0,
                    canRunCommands ? 1 : 0,
                    canStopCommands ? 1 : 0,
                ],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public removeDockerUser(userId: string): Promise<boolean> {
        Logger.log(`Removing user ${userId}`, MessageType.DEBUG);

        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
            DELETE FROM TrustedUsers
            WHERE user_id = ?`,
                [userId],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public getUserPermissions(userId: string): Promise<UserPermissions> {
        Logger.log(`Checking user permissions for ${userId}`, MessageType.DEBUG);
        return new Promise<UserPermissions>((resolve, reject) => {
            this.sqliteDatabase.all(
                `
            SELECT * 
            FROM TrustedUsers
            WHERE user_id = ?`,
                [userId],
                (err: Error | null, rows: unknown[]): void => {
                    if (err != null) {
                        console.log(err);
                        Logger.log(
                            `SQL Error: ${err?.message}; ${err.name}; ${err.cause}; ${err}`,
                            MessageType.WARNING
                        );
                        reject(null);
                        return;
                    } else if (rows.length == 0) {
                        let noPerms: UserPermissions = {
                            canAlterUsers: false,
                            canRunCommands: false,
                            canStopContainers: false,
                            canAddCommands: false,
                            canRemoveCommands: false,
                        };
                        resolve(noPerms);
                        return;
                    }

                    let userPermData = rows[0];
                    let userPerms: UserPermissions = {
                        canAlterUsers: ((userPermData as any).can_alter_users as number) == 1,
                        canRunCommands: ((userPermData as any).can_run_commands as number) == 1,
                        canStopContainers: ((userPermData as any).can_stop_commands as number) == 1,
                        canAddCommands: ((userPermData as any).can_add_commands as number) == 1,
                        canRemoveCommands: ((userPermData as any).can_remove_commands as number) == 1,
                    };
                    resolve(userPerms);
                    return;
                }
            );
        });
    }

    public addDockerCommand(commandName: string, commandContents: string, notes: string = "-"): Promise<boolean> {
        Logger.log(`Adding new command '${commandContents}' as '${commandName}'`, MessageType.DEBUG);

        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
                INSERT INTO DockerCommands (command_name, command_contents, notes) 
                VALUES (?,?,?)`,
                [commandName, commandContents, notes],
                (err: Error | null) => {
                    if (err != null) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                    return;
                }
            );
        });
    }

    public removeDockerCommand(commandName: string): Promise<boolean> {
        Logger.log(`Removing command ${commandName}`, MessageType.DEBUG);

        return new Promise<boolean>((resolve, reject) => {
            this.sqliteDatabase.run(
                `
                DELETE FROM DockerCommands 
                WHERE command_name = ?`,
                [commandName],
                (err: Error | null) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(false);
                        return;
                    }

                    resolve(true);
                    return;
                }
            );
        });
    }

    public getCommandContentsByName(commandName: string): Promise<object | null> {
        Logger.log(`Inspecting command ${commandName}`, MessageType.DEBUG);

        return new Promise<object | null>((resolve, reject) => {
            this.sqliteDatabase.all<object>(
                `
                SELECT command_contents, notes 
                FROM DockerCommands
                WHERE command_name = ?`,
                [commandName],
                (err: Error | null, rows: object[]) => {
                    if (err || rows.length == 0) {
                        Logger.log(`SQL Error: ${err == null ? "No results" : err.message}`, MessageType.WARNING);
                        resolve(null);
                        return;
                    }

                    resolve(rows[0]);
                    return;
                }
            );
        });
    }

    public getAllDockerCommands(): Promise<object[] | null> {
        Logger.log("Inspecting all commands", MessageType.DEBUG);
        return new Promise<object[] | null>((resolve, reject) => {
            this.sqliteDatabase.all<string>(
                `
                SELECT command_name, command_contents, notes 
                FROM DockerCommands`,
                (err: Error | null, rows: object[]) => {
                    if (err) {
                        Logger.log(`SQL Error: ${err.message}`, MessageType.WARNING);
                        resolve(null);
                        return;
                    }

                    resolve(rows);
                    return;
                }
            );
        });
    }
}
