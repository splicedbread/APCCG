import { SlashCommandBuilder } from "discord.js";
import discord from "discord.js";
import ApccgSlashCommand from "./apccg_slash_command.js";

export default class CommandHello extends ApccgSlashCommand {
    public override disabled(): boolean {
        return false;
    }

    public override commandData(): any {
        return new SlashCommandBuilder()
            .setName("coinflip")
            .setDescription("flip a coin")
            .addIntegerOption((option) => option.setName("flip_times").setDescription("How many times to flip?").setRequired(true))
            .addStringOption((option) => option.setName("heads_outcome").setDescription("What happens if it's heads?").setRequired(false))
            .addStringOption((option) => option.setName("tails_outcome").setDescription("What happens if it's tails?").setRequired(false))
            .addBooleanOption((option) => option.setName("no_fun_mode").setDescription("No graphics").setRequired(false))
    }

    public override async execute(args: any[]): Promise<boolean> {
        let interaction = args[0] as discord.ChatInputCommandInteraction;
        
        const rollTimes = (interaction.options.get("flip_times")?.value) as number;
        const headsOutcome = (interaction.options.get("heads_outcome")?.value ?? "") as string;
        const tailsOutcome = (interaction.options.get("tails_outcome")?.value ?? "") as string;
        const noFunmode = (interaction.options.get("no_fun_mode")?.value ?? false) as boolean;
        if (rollTimes == null || rollTimes <= 0) {
            await interaction.reply("# DIE");
            return false;
        }
        else if (rollTimes > 10) {
            await interaction.reply("ᴵ ᵐᵘˢᵗ ˢᵃʸ ⁿᵒ");
            return false;
        }
        interaction.deferReply();


        let headsCount = 0;
        for (let i = 0; i < rollTimes; i++) {
            let roll = Math.round(Math.random());
            if (roll == 1) {
                headsCount += 1;
                if (!noFunmode)
                    await interaction.channel.send(this.heads);
            }
            else {
                if (!noFunmode)
                    await interaction.channel.send(this.tails);
            }
        }
        this.sleep(2000).then(async () => {
            let msg = await interaction.editReply(`You rolled ${headsCount} heads and ${rollTimes - headsCount} tails!`); 
            
            if (2 * headsCount == rollTimes) {
                msg.reply(`🍞🍞🍞🍞🍞 𝒾𝓉𝓈 𝒶 𝓉𝒾𝑒 🍞🍞🍞🍞🍞`);
            }
            else if (headsCount > rollTimes / 2 && headsOutcome !== "") {
                msg.reply(`☝️꒰  ˘ω˘  ꒱☝️  ${headsOutcome}`);
            }
            else if (tailsOutcome !== "") {
                msg.reply(`☝️꒰  ˘ω˘  ꒱☝️  ${tailsOutcome}`);
            }
            else {
                msg.reply("☝️꒰  ˘ω˘  ꒱☝️");
            }
        }); 
        return true;
    }

    public sleep(ms) {
        return new Promise((resolve) => {
          setTimeout(resolve, ms);
        })
    }

    public override getTitle(): string {
        return "Coinflip";
    }

    public override getDescription(): string {
        return `**/coinflip** [number of flips] [heads outcome] [tails outcome] -> Flip a coin`;
    }

    heads = `.                  ░░░░░░░░░░░░░░░░░░░░                      
                ░░░░░░░░░░░░░░░░░░░░░▒░░                    
            ░░░░░░░░░▒▓▓████▓▓▓▓▒░░░░░░░░░░                 
            ░░░░░░▒░▒███████████▓▓▒▒▒▒▒░░░░                 
           ░░░░░▓▒▓█████████████████▓▒░░░░▒▒░               
          ░░░░░▒████████████▓▓▒▓▓▓▓▓▓▓▓▒▒░░░▒░░             
          ░░░░░▓▓▒▒▒▒▒▓▒█▓▒▒▒▒▓█████▓▓▓▒▒▒▒▒░░░░░           
          ░░░░▒█▓▓▓▓▒▒▒▓██▓▓▓▒▓██▓▓▓█▓█▓▒▒░░▒░▒  ░░         
          ░░░▓▓█▓▓████████▓▓▓▓████████▓▓▒▒▒▒▒░░░░           
          ░░░▓█████████▓▓▓▓▓▓▓▓███████▓▓▒▒▒▒░░░▒▒░          
          ░░▒▓██████▓▓█▓███████▓▓███▓▓▓▓▓▓▒▓▒▒▒▒▓▓░         
           ░░▓█████████▓▓▓▓▓▒▓██▓███▓▓▓▓▓▓▓▓▓░░▒▒▒░         
           ▒▒▓███████▓▒░      ▒▓▓▓▓▓▓▓▓▓▓▓▓▓▒░░░░░▒         
           ░▓█▓██████▓▒ ░░░░░░ ▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░░░░░         
           ░░▓███████▓▓▓▓███▓▓▒▓▓▓▓▓▒▒▒▓▓▒░░░░░░░░░░        
            ░░░▒▓████████████▓▓▓█▓▓▓▒▒▓▓░░░░▒░░░░░  ░       
               ▒█████████▓▓▓▓▓▓█▓▓▒▒▒▒▓▓░░░░▒░░░░░░  ░      
                ███▓▓▓▓▒░░░░░░▒▒▒▒▒▒▓▓▓▓░░░░░░░░░░░░        
                █████▓▓▒░░░░░░▒▒▒▒▓▓▓▓▓▒░░░░░░░░░░░░░░      
                 ██████▓▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░     
                 ▒▓▓██████▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░   
                 ░░░▒▓▓█████▓▒▒▓▓▓▓▓▓▓▒░░░░░░░░░░░▓█░░░░░   
                ░░█░░░░░▒▒▓▓▓▒▒▓▓▓▓▓▓▒░░░░░░░░░░░░░░░  ░░   
               ░░░░░░░▒░░▓▓▓▓▓▓▓▓▓▓▓▒▒░░░░░░░░░░░░░░░░ ░░░  
                   ░░░░░░▒▓▓▓▓▓▓▓▓▒░▒▒░▓░░░░░░░░░░░░░░      
                     ░░░▒▓▓▓▓▓▓▒░░▒▒▒░░▓░░░░░░░▒░░░░░░░     
                    ░░░░▓▓▓▓▓▓▒░░░░░░▒░▒░░░░░░░▒░░░░░░░     
                  ░░░░░▒▓▓▓▒▒░░░░░░░▒▒ ░░░░░░ ░░░░▒▒░░      
                  ░░░░▒▒▒▒▒▒░░░░░░░░▒▒ ░░░░░░ ░▒▒▒▒▒░       
                   ░░░░░░░░░░▒░░░░░░░   ░░░░  ▒▒░░          
                    ░░░   ▒░░░░▒▓▒░░░░    ░░  ▒              
`;

    tails = `.
        ▒░░░                                               
      ▒▒▒░░▒▒░                       ░▒░                 
      ▒▒▓▒▒░▒▒▒▒▒░              ░▒▒░▓▓▓▒                 
      ▒▒▓▓▒░▒░░░░▒▒▒▒        ░▒░▒▓▓▓▓▓▓▒                 
      ░▒▒▒▒▒░░░▒▒▒▒▒▒▒▒▒▒▒░▒▒▒▒▒▓▓▓▓▓▓▓▒                 
     ░▒░░▒▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░▒▒▓▓▓▓▓▓▒░                 
       ░▒▓▓▒▒▒░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▒░                  
        ░▒▒░▒▒▒▒▓▓▓░▒▒▒▒▒▓▓▓▓▒▒▒▒▓▓▓▒░                   
        ▒░░▒▒▒▒▓▓▓▓▓▒▒▒▒▓▓▓▓▓▒▒▒▒▓▒▒                     
       ░  ▒▒▒▒▓▓▓▒▒▓▒▒▒░▓▓▒▒▓▓▒▒▒▒     ░▒░░▒▒▒░░         
          ▒▒▒▒▓▓▒▒ ▒▒▒▒░▓▒▓▒▓▓▒▒▒    ▒▓▓▓▓▓▓▓▓▓▓▓▓░      
          ▒▒▒▒▓▓▒░▒▓▒▒▒░▓▒ ▒▓▓▒▒░  ░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒     
         ░░░▒▒▓▓▓░▓▒░░░▒▓▒▒▒▓▒▒▒  ▒▒▓▓▓▓▓▓▓▓▓▓▓▒░        
         ░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▒▓▓▓▓▓▓▒▒▓▓▓▓▓▓▒▒░▒▒▓▓▓▒▒░    
      ░▒▓▓▓▓▓▓▓▓▓▓▓░▒▓▒▒▒▓▓▓▓▓▓▓▓▓▓░▓▓▓▓▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓  
        ▒▓▓▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▓▓▓▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒
       ▒░▓▓▒░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░▓▓▓▒▓▒▓▓░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒ 
     ▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░▒▒░░░░▒▒▒▒▒▒▓░▓▓▓▓▓▓▓▓▓▓▓▓▒▒     
   ░▓▓▓▓░    ░▒░▓▓▓▓▓▓▓▓▓▓▓   ▓▓▓▒░▒▒▓▓▓▓▓▓▓▓▓▓▓▒▒░      
  ░▓▓▓▓▓▓░    ░▓▓▓▓▓▓▓▓▓▓▓▓   ▓▓▓▓▓▓▒▓▓▓▓▓▓▓▓▓▓▒▒░       
  ▒▓▓▓▓▓░     ▒▓▓▓▓▓▓▓▓▓▓▒  ░▓▓▓▓▓▓▓▓▒▓▓▓▓▓▓▓▓▒▒░        
 ░▒▓▓▓▓▓▓    ░▒▓▓▓▓▓▓▓▓▓▓▒░▒▒▓▓▓▓▓▒▓▒▒▒▒▒▓▓▓▓▓▒░         
  ▒▓▓░░▓▓    ▒▓▓▓▓▓▓▓▓▓▓▓░▒▒▒▓▓▒▓▓▒▓░▒▒▒▓▓▒▒▓▒░          
  ░▒▓░ ▒▓   ░▒▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▓▓▒▓▒▒▒▒▒▒▓▒▒            
   ░▒░  ░▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓░▒▒▒▒▒▒▒▓▓░▒▒▒▒▒▒▒░
       ░▒▒▒▒▒▒▒▒▒▒▓▓▓▒▒▒▒▒▒▒▒░▒▒▒░▒▒▒▒▒░                 
       ▒▒▒▒▒░░░░░░▒▒▒░░░░    ░▒▒▒▒                       
      ▒▒▒▒▒▒                 ░▒▒▒▒                       
      ░▒▒▒▒▒                  ▒▒▒░                       
     ░▒▒▒▒▒▒░                ▓▓▓▓▓▒▒  
    ░░▓▓▓▓▓▓▓                ▓▓▓▓▓▒▒░ 
   ▒░░░░░░░░░░              ░░░░░░░░░░
  ░▒▒▓▓▓▓▓░░░░             ░░░▓▓▓▓▓▓░░░
▒▒▒▓▓▓▓▓▓▓▓▓░░            ░░▓▓▓▓▓▓▓▓▓▓░
 ▒▒▓▓▓▓▓▓▓▓▓▓▓             ▓▓▓▓▓▓▓▓▓▓▓░ 
 ▒░▒▓▓▓▓▒▒▓▓▒              ▒▒▒▓▓▓▓▓░░▒░`;

}
