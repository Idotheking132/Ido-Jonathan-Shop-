import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
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

// Handle .siteclose command
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('.siteclose')) return;

  try {
    // Check if user is admin
    const member = await message.guild.members.fetch(message.author.id);
    const isAdmin = member.roles.cache.has(process.env.ADMIN_ROLE_ID);

    if (!isAdmin) {
      return message.reply('❌ רק מנהלים יכולים לסגור טיקטים');
    }

    // Check if this is a ticket channel
    if (!message.channel.name.startsWith('קנייה-באתר-')) {
      return message.reply('❌ פקודה זו עובדת רק בערוצי טיקטים');
    }

    // Send closing message
    await message.reply('✅ הטיקט נסגר');

    // Wait a bit then delete the channel
    setTimeout(async () => {
      try {
        await message.channel.delete();
      } catch (err) {
        console.error('Error deleting channel:', err);
      }
    }, 2000);
  } catch (error) {
    console.error('Error in .siteclose command:', error);
    message.reply('❌ שגיאה בסגירת הטיקט');
  }
});

// Handle button interactions for bulk orders
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  
  if (customId.startsWith('approve_bulk_')) {
    const orderId = parseInt(customId.split('_')[2]);
    // Handle approval - will be done via API
    await interaction.reply('✅ הזמנה אושרה! יוצר טיקט...');
  } else if (customId.startsWith('reject_bulk_')) {
    const orderId = parseInt(customId.split('_')[2]);
    await interaction.reply('❌ הזמנה דחויה');
  }
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
          { name: '📊 סטטוס', value: '⏳ בהמתנה לאישור', inline: false },
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

// Close ticket channel
export async function closeTicket(channelId) {
  try {
    await waitForReady();
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      await channel.setArchived(true);
      setTimeout(() => {
        channel.delete().catch(err => console.error('Error deleting channel:', err));
      }, 2000);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error closing ticket:', error);
    return false;
  }
}

// Update ticket status
export async function updateTicketStatus(channelId, status, statusEmoji) {
  try {
    await waitForReady();
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      const messages = await channel.messages.fetch({ limit: 1 });
      const message = messages.first();
      if (message && message.embeds.length > 0) {
        const embed = message.embeds[0];
        const newEmbed = {
          ...embed,
          fields: embed.fields.map(f => 
            f.name === '📊 סטטוס' 
              ? { ...f, value: `${statusEmoji} ${status}` }
              : f
          ),
        };
        await message.edit({ embeds: [newEmbed] });
      }
    }
  } catch (error) {
    console.error('Error updating ticket status:', error);
  }
}

export default client;
