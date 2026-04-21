import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

let botReady = false;

client.once('ready', () => {
  console.log(`✅ Discord Bot logged in as ${client.user.tag}`);
  botReady = true;
});

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('Failed to login bot:', err);
});

// Wait for bot to be ready
function waitForReady(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (botReady) return resolve();
    const interval = setInterval(() => {
      if (botReady) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Bot not ready in time'));
    }, timeout);
  });
}

// Check if user is in guild
export async function isUserInGuild(userId) {
  try {
    await waitForReady();
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    // Force fetch member from API (not cache)
    const member = await guild.members.fetch({ user: userId, force: true });
    return !!member;
  } catch (error) {
    console.error('isUserInGuild error:', error.message);
    return false;
  }
}

// Get user roles
export async function getUserRoles(userId) {
  try {
    await waitForReady();
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    // Force fetch member from API (not cache)
    const member = await guild.members.fetch({ user: userId, force: true });
    const roles = member.roles.cache.map(role => role.id);
    console.log(`Roles for ${userId}:`, roles);
    return roles;
  } catch (error) {
    console.error('getUserRoles error:', error.message);
    return [];
  }
}

// Create ticket channel
export async function createTicket(userId, username, productName, quantity, totalPrice) {
  try {
    await waitForReady();
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const category = await guild.channels.fetch(process.env.TICKET_CATEGORY_ID);

    if (!category || category.type !== ChannelType.GuildCategory) {
      throw new Error('Category not found or invalid');
    }

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

    await ticketChannel.send({
      content: `<@${userId}>`,
      embeds: [{
        title: '🛒 קנייה חדשה מהאתר',
        color: 0x5865F2,
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
