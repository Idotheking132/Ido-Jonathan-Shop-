import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';
import * as db from './database.js';
import { saveDB } from './database.js';

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
  console.log(`Bot is ready to send messages`);
});

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('Discord client warning:', warning);
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
  
  // Handle close ticket button
  if (customId.startsWith('close_ticket_')) {
    const channelId = customId.split('_')[2];
    try {
      await interaction.deferReply();
      
      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        return interaction.editReply('❌ הערוץ לא נמצא');
      }

      // Check if user is admin
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isAdmin = member.roles.cache.has(process.env.ADMIN_ROLE_ID);

      if (!isAdmin && interaction.user.id !== channel.topic?.split('|')[0]) {
        return interaction.editReply('❌ רק מנהלים או בעל הטיקט יכולים לסגור');
      }

      // Update database
      db.updateTicketStatus(channelId, 'closed');

      // Send closing message
      await interaction.editReply('✅ הטיקט נסגר');

      // Delete channel after 2 seconds
      setTimeout(async () => {
        try {
          await channel.delete();
          console.log(`✓ Ticket channel closed: ${channelId}`);
        } catch (err) {
          console.error('Error deleting channel:', err);
        }
      }, 2000);
    } catch (error) {
      console.error('Error closing ticket:', error);
      await interaction.editReply('❌ שגיאה בסגירת הטיקט');
    }
  }
  
  if (customId.startsWith('approve_bulk_')) {
    const orderId = parseInt(customId.split('_')[2]);
    try {
      await interaction.deferReply();
      
      // Get the bulk order from database
      const allTickets = db.getAllTickets();
      const bulkOrder = allTickets.find(t => t.id === orderId && t.is_bulk);
      
      if (!bulkOrder) {
        return interaction.editReply('❌ הזמנה לא נמצאה');
      }

      console.log(`📦 Approving bulk order #${orderId} for ${bulkOrder.username}`);

      // Create ticket for the user FIRST
      let ticketChannelId;
      try {
        ticketChannelId = await createTicket(
          bulkOrder.user_id,
          bulkOrder.username,
          `הזמנה גדולה #${orderId}`,
          bulkOrder.items.length,
          bulkOrder.total_price
        );
        console.log(`✓ Ticket created: ${ticketChannelId}`);
      } catch (ticketErr) {
        console.error('Error creating ticket:', ticketErr);
        return interaction.editReply('❌ שגיאה בפתיחת הטיקט');
      }

      // Update stock for all items
      for (const item of bulkOrder.items) {
        db.updateStock(item.quantity, item.productId);
      }

      // Update bulk order status and channel
      const ticketIndex = db.db.tickets.findIndex(t => t.id === orderId);
      if (ticketIndex !== -1) {
        db.db.tickets[ticketIndex].status = 'approved';
        db.db.tickets[ticketIndex].channel_id = ticketChannelId;
        saveDB();
      }

      // Send DM to user with ticket link
      try {
        const user = await client.users.fetch(bulkOrder.user_id);
        
        // Build items list for DM
        const itemsList = bulkOrder.items.map(item => {
          const product = db.getProduct(item.productId);
          return `• ${product ? product.name : 'Unknown'} x${item.quantity}`;
        }).join('\n');

        await user.send({
          embeds: [{
            title: '✅ הזמנה אושרה!',
            color: 0x38a169,
            description: 'ההזמנה שלך אושרה בהצלחה',
            fields: [
              { name: '🆔 מזהה הזמנה', value: `#${orderId}`, inline: true },
              { name: '💰 סה"כ', value: `₪${bulkOrder.total_price.toFixed(2)}`, inline: true },
              { name: '📋 פריטים', value: itemsList, inline: false },
              { name: '🎫 טיקט', value: `<#${ticketChannelId}>`, inline: false },
            ],
            timestamp: new Date(),
            footer: { text: 'Ido & Jonathan Shop' },
          }],
        });
        console.log(`✓ DM sent to ${bulkOrder.username}`);
      } catch (err) {
        console.error('Could not send DM:', err);
      }

      await interaction.editReply(`✅ הזמנה #${orderId} אושרה!\n🎫 טיקט: <#${ticketChannelId}>\n📧 הודעה נשלחה לקונה`);
    } catch (error) {
      console.error('Error approving bulk order:', error);
      await interaction.editReply('❌ שגיאה באישור ההזמנה');
    }
  } 
  else if (customId.startsWith('reject_bulk_')) {
    const orderId = parseInt(customId.split('_')[2]);
    try {
      await interaction.deferReply();
      
      // Get the bulk order
      const allTickets = db.getAllTickets();
      const bulkOrder = allTickets.find(t => t.id === orderId && t.is_bulk);
      
      if (!bulkOrder) {
        return interaction.editReply('❌ הזמנה לא נמצאה');
      }

      console.log(`❌ Rejecting bulk order #${orderId} for ${bulkOrder.username}`);

      // Update status
      const ticketIndex = db.db.tickets.findIndex(t => t.id === orderId);
      if (ticketIndex !== -1) {
        db.db.tickets[ticketIndex].status = 'rejected';
        saveDB();
      }

      // Send DM to user
      try {
        const user = await client.users.fetch(bulkOrder.user_id);
        await user.send({
          embeds: [{
            title: '❌ הזמנה דחויה',
            color: 0xe53e3e,
            description: 'הזמנתך דחויה על ידי מנהל',
            fields: [
              { name: '🆔 מזהה הזמנה', value: `#${orderId}`, inline: true },
              { name: '💰 סה"כ', value: `₪${bulkOrder.total_price.toFixed(2)}`, inline: true },
            ],
            timestamp: new Date(),
            footer: { text: 'Ido & Jonathan Shop' },
          }],
        });
        console.log(`✓ Rejection DM sent to ${bulkOrder.username}`);
      } catch (err) {
        console.error('Could not send DM:', err);
      }

      await interaction.editReply(`❌ הזמנה #${orderId} דחויה\n📧 הודעה נשלחה לקונה`);
    } catch (error) {
      console.error('Error rejecting bulk order:', error);
      await interaction.editReply('❌ שגיאה בדחיית ההזמנה');
    }
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

export function isBotReady() {
  return botReady;
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

    // Determine if this is a bulk order or single item
    const isBulkOrder = productName.includes('הזמנה גדולה');

    const embed = {
      title: isBulkOrder ? '📦 הזמנה גדולה חדשה' : '🛒 קנייה חדשה מהאתר',
      color: isBulkOrder ? 0x9333ea : 0x5865F2,
      description: isBulkOrder ? 'ההזמנה שלך אושרה בהצלחה!' : 'קנייה חדשה בהמתנה לאישור',
      fields: [
        { name: '👤 קונה', value: `<@${userId}>`, inline: true },
        { name: '📦 פריטים', value: quantity.toString(), inline: true },
        { name: '💰 סה"כ', value: `₪${totalPrice.toFixed(2)}`, inline: true },
        { name: '📊 סטטוס', value: isBulkOrder ? '✅ אושר' : '⏳ בהמתנה לאישור', inline: false },
      ],
      timestamp: new Date(),
      footer: { text: 'Ido & Jonathan Shop' },
    };

    const components = [
      {
        type: 1,
        components: [
          {
            type: 2,
            label: 'סגור טיקט',
            style: 4,
            custom_id: `close_ticket_${ticketChannel.id}`,
          },
        ],
      },
    ];

    await ticketChannel.send({
      content: `<@${userId}>`,
      embeds: [embed],
      components: components,
    });

    console.log(`✓ Ticket created for ${username}: ${ticketChannel.id}`);
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
