import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('ready', () => {
  console.log(`✅ Discord Bot logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);

// Check if user is in guild
export async function isUserInGuild(userId) {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(userId);
    return !!member;
  } catch (error) {
    return false;
  }
}

// Get user roles
export async function getUserRoles(userId) {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(userId);
    return member.roles.cache.map(role => role.id);
  } catch (error) {
    return [];
  }
}

// Create ticket channel
export async function createTicket(userId, username, productName, quantity, totalPrice) {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const category = await guild.channels.fetch(process.env.TICKET_CATEGORY_ID);

    if (!category || category.type !== ChannelType.GuildCategory) {
      throw new Error('Category not found or invalid');
    }

    // Create ticket channel
    const ticketChannel = await guild.channels.create({
      name: `קנייה-באתר-${username}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: userId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        {
          id: process.env.ADMIN_ROLE_ID,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
      ],
    });

    // Send ticket message
    await ticketChannel.send({
      content: `<@${userId}>`,
      embeds: [{
        title: '🛒 קנייה חדשה מהאתר',
        color: 0x00ff00,
        fields: [
          { name: '👤 קונה', value: `<@${userId}>`, inline: true },
          { name: '📦 מוצר', value: productName, inline: true },
          { name: '🔢 כמות', value: quantity.toString(), inline: true },
          { name: '💰 מחיר כולל', value: `₪${totalPrice.toFixed(2)}`, inline: true },
        ],
        timestamp: new Date(),
        footer: { text: 'Ido & Jonathan Shop' },
      }],
    });

    return ticketChannel.id;
  } catch (error) {
    console.error('Error creating ticket:', error);
    throw error;
  }
}

export default client;
