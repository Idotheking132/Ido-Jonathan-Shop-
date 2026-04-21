import express from 'express';
import session from 'express-session';
import axios from 'axios';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { isUserInGuild, getUserRoles, createTicket, closeTicket, updateTicketStatus, isBotReady } from './bot.js';
import client from './bot.js';
import * as db from './database.js';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

// Store connected clients
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`✓ Client connected. Total: ${clients.size}`);

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`✗ Client disconnected. Total: ${clients.size}`);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast updates to all connected clients
function broadcastUpdate(type, data) {
  const message = JSON.stringify({ type, data });
  clients.forEach(client => {
    if (client.readyState === 1) { // 1 = OPEN
      client.send(message);
    }
  });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  next();
};

const requireAdmin = async (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const roles = await getUserRoles(req.session.user.id);
  if (!roles.includes(process.env.ADMIN_ROLE_ID)) {
    return res.status(403).json({ error: 'Access denied - Admin only' });
  }
  
  next();
};

// Debug endpoint - remove after fixing
app.get('/debug/roles', async (req, res) => {
  const userId = req.query.id;
  if (!userId) return res.json({ error: 'provide ?id=YOUR_DISCORD_ID' });
  
  try {
    const roles = await getUserRoles(userId);
    const inGuild = roles.length > 0;
    res.json({
      userId,
      inGuild,
      roles,
      BUYER_ROLE_ID: process.env.BUYER_ROLE_ID,
      ADMIN_ROLE_ID: process.env.ADMIN_ROLE_ID,
      GUILD_ID: process.env.GUILD_ID,
      hasBuyer: roles.includes(process.env.BUYER_ROLE_ID),
      hasAdmin: roles.includes(process.env.ADMIN_ROLE_ID),
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: './public' });
});

app.get('/shop', requireAuth, (req, res) => {
  res.sendFile('shop.html', { root: './public' });
});

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile('admin.html', { root: './public' });
});

// Auth routes
app.get('/auth/discord', (req, res) => {
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    // Exchange code for token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const user = userResponse.data;

    // Get user roles (this also confirms they're in the guild)
    const roles = await getUserRoles(user.id);
    console.log(`User ${user.username} (${user.id}) roles:`, roles);

    // If roles is empty, user is not in guild or bot can't see them
    if (roles.length === 0) {
      return res.redirect('/?error=not_in_guild');
    }

    // Check if user has buyer or admin role
    const hasAccess = roles.includes(process.env.BUYER_ROLE_ID) || 
                      roles.includes(process.env.ADMIN_ROLE_ID) ||
                      roles.includes(process.env.VIP_ROLE_ID);
    
    console.log(`hasAccess: ${hasAccess}`);
    console.log(`BUYER: ${process.env.BUYER_ROLE_ID} = ${roles.includes(process.env.BUYER_ROLE_ID)}`);
    console.log(`ADMIN: ${process.env.ADMIN_ROLE_ID} = ${roles.includes(process.env.ADMIN_ROLE_ID)}`);
    console.log(`VIP: ${process.env.VIP_ROLE_ID} = ${roles.includes(process.env.VIP_ROLE_ID)}`);
    
    if (!hasAccess) {
      return res.redirect('/?error=no_access');
    }

    // Save user to session
    req.session.user = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      roles: roles,
    };

    res.redirect('/shop');
  } catch (error) {
    console.error('Auth error:', error.response?.data || error.message);
    res.redirect('/?error=auth_failed');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// API routes
app.get('/api/user', requireAuth, (req, res) => {
  res.json(req.session.user);
});

app.get('/api/products', requireAuth, async (req, res) => {
  try {
    const products = db.getProducts();
    const roles = req.session.user.roles;
    const hasVIP = roles.includes(process.env.VIP_ROLE_ID);
    
    // Apply VIP discount if applicable
    const productsWithDiscount = products.map(product => ({
      ...product,
      original_price: product.price,
      price: hasVIP && product.discount_vip > 0 
        ? product.price * (1 - product.discount_vip / 100)
        : product.price,
      has_discount: hasVIP && product.discount_vip > 0,
      discount_percent: product.discount_vip,
    }));
    
    res.json(productsWithDiscount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/purchase', requireAuth, async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.session.user.id;
  const username = req.session.user.username;

  try {
    // Check if user is blocked
    const blockStatus = db.isUserBlocked(userId);
    if (blockStatus) {
      const until = new Date(blockStatus.until);
      const timeLeft = Math.ceil((until - new Date()) / 1000 / 60); // minutes
      return res.status(403).json({ 
        error: `אתה חסום מהאתר. זמן שנותר: ${timeLeft} דקות. סיבה: ${blockStatus.reason || 'לא צוין'}` 
      });
    }

    // Check cooldown (24 hours)
    const cooldown = db.getCooldown(userId);
    if (cooldown) {
      const lastPurchase = new Date(cooldown.last_purchase);
      const now = new Date();
      const hoursSince = (now - lastPurchase) / (1000 * 60 * 60);
      
      if (hoursSince < 24) {
        const hoursLeft = Math.ceil(24 - hoursSince);
        return res.status(429).json({ 
          error: `עליך להמתין ${hoursLeft} שעות נוספות לפני הקנייה הבאה` 
        });
      }
    }

    // Get product
    const product = db.getProduct(productId);
    if (!product) {
      return res.status(404).json({ error: 'מוצר לא נמצא' });
    }

    // Check stock
    if (product.stock < quantity) {
      return res.status(400).json({ error: 'אין מספיק במלאי' });
    }

    // Check max purchase
    if (quantity > product.max_purchase && product.max_purchase !== -1) {
      return res.status(400).json({ 
        error: `ניתן לקנות עד ${product.max_purchase} יחידות בלבד` 
      });
    }

    // Calculate price with VIP discount
    const roles = req.session.user.roles;
    const hasVIP = roles.includes(process.env.VIP_ROLE_ID);
    let price = product.price;
    
    if (hasVIP && product.discount_vip > 0) {
      price = price * (1 - product.discount_vip / 100);
    }
    
    const totalPrice = price * quantity;

    // Create ticket
    const ticketChannelId = await createTicket(
      userId, 
      username, 
      product.name, 
      quantity, 
      totalPrice
    );

    // Add ticket record (DON'T update stock yet - wait for approval)
    db.addTicket(userId, username, productId, quantity, totalPrice, ticketChannelId);

    // Set cooldown
    db.setCooldown(userId);

    res.json({ 
      success: true, 
      message: 'הקנייה בוצעה בהצלחה! נפתח לך טיקט בדיסקורד',
      ticketChannelId 
    });
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'שגיאה בביצוע הקנייה' });
  }
});

// Admin API routes
app.get('/api/admin/products', requireAdmin, (req, res) => {
  try {
    const products = db.getAllProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, description, price, stock, max_purchase, image_url, discount_vip } = req.body;
  
  try {
    const result = db.addProduct(
      name, 
      description || '', 
      parseFloat(price), 
      parseInt(stock), 
      parseInt(max_purchase) || 1,
      image_url || '',
      parseInt(discount_vip) || 0
    );
    
    // Broadcast update
    broadcastUpdate('product_added', db.getAllProducts());
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, description, price, stock, max_purchase, image_url, discount_vip } = req.body;
  
  try {
    db.updateProduct(
      name,
      description || '',
      parseFloat(price),
      parseInt(stock),
      parseInt(max_purchase) || 1,
      image_url || '',
      parseInt(discount_vip) || 0,
      parseInt(id)
    );
    
    // Broadcast update
    broadcastUpdate('product_updated', db.getAllProducts());
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  try {
    db.deleteProduct(parseInt(id));
    
    // Broadcast update
    broadcastUpdate('product_deleted', db.getAllProducts());
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/purchases', requireAdmin, (req, res) => {
  try {
    const purchases = db.getAllPurchases();
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tickets API
app.get('/api/admin/tickets', requireAdmin, (req, res) => {
  try {
    const tickets = db.getAllTickets();
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/tickets/:channelId/approve', requireAdmin, async (req, res) => {
  try {
    const { channelId } = req.params;
    const ticket = db.getTicket(channelId);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Update stock only now
    db.updateStock(ticket.quantity, ticket.product_id);

    // Add purchase record
    db.addPurchase(ticket.user_id, ticket.username, ticket.product_id, ticket.quantity, ticket.total_price, channelId);

    // Update ticket status
    db.updateTicketStatus(channelId, 'approved');
    
    await updateTicketStatus(channelId, '✅ אושר', '✅');
    
    // Broadcast update
    broadcastUpdate('ticket_approved', { channelId, ticket });
    
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/tickets/:channelId/reject', requireAdmin, async (req, res) => {
  try {
    const { channelId } = req.params;
    const ticket = db.updateTicketStatus(channelId, 'rejected');
    
    if (ticket) {
      await updateTicketStatus(channelId, '❌ דחוי', '❌');
      
      // Broadcast update
      broadcastUpdate('ticket_rejected', { channelId, ticket });
      
      res.json({ success: true, ticket });
    } else {
      res.status(404).json({ error: 'Ticket not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/tickets/:channelId/close', requireAdmin, async (req, res) => {
  try {
    const { channelId } = req.params;
    const ticket = db.updateTicketStatus(channelId, 'closed');
    
    if (ticket) {
      await closeTicket(channelId);
      db.deleteTicket(channelId);
      
      // Broadcast update
      broadcastUpdate('ticket_closed', { channelId });
      
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Ticket not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove cooldown for user
app.post('/api/admin/users/:userId/remove-cooldown', requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    db.removeCooldown(userId);
    res.json({ success: true, message: 'Cooldown removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Block user
app.post('/api/admin/users/:userId/block', requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const { hours, reason } = req.body;

    if (!hours || hours < 1) {
      return res.status(400).json({ error: 'Hours must be at least 1' });
    }

    const result = db.blockUser(userId, parseInt(hours), reason || '');
    broadcastUpdate('user_blocked', result);
    
    res.json({ success: true, message: `User blocked for ${hours} hours`, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unblock user
app.post('/api/admin/users/:userId/unblock', requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    db.unblockUser(userId);
    broadcastUpdate('user_unblocked', { userId });
    
    res.json({ success: true, message: 'User unblocked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all blocked users
app.get('/api/admin/blocked-users', requireAdmin, (req, res) => {
  try {
    const blocked = db.getAllBlockedUsers();
    res.json(blocked);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk order
app.post('/api/bulk-order', requireAuth, async (req, res) => {
  const { items } = req.body; // [{productId, quantity}, ...]
  const userId = req.session.user.id;
  const username = req.session.user.username;

  try {
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }

    // Validate all items exist and have stock
    let totalPrice = 0;
    const roles = req.session.user.roles;
    const hasVIP = roles.includes(process.env.VIP_ROLE_ID);

    for (const item of items) {
      const product = db.getProduct(item.productId);
      if (!product) {
        return res.status(404).json({ error: `Product ${item.productId} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Not enough stock for ${product.name}` });
      }

      let price = product.price;
      if (hasVIP && product.discount_vip > 0) {
        price = price * (1 - product.discount_vip / 100);
      }
      totalPrice += price * item.quantity;
    }

    // Create bulk order
    const bulkOrder = db.addBulkOrder(userId, username, items, totalPrice);

    // Send to approval channel
    const approvalChannelId = '1487800360784498826';
    
    try {
      const channel = await client.channels.fetch(approvalChannelId);
      
      if (!channel) {
        console.error('Approval channel not found:', approvalChannelId);
        return res.status(500).json({ error: 'Approval channel not found' });
      }

      const itemsList = items.map(item => {
        const product = db.getProduct(item.productId);
        return `• ${product.name} x${item.quantity}`;
      }).join('\n');

      const message = await channel.send({
        embeds: [{
          title: '📦 הזמנה גדולה חדשה',
          color: 0x5865F2,
          fields: [
            { name: '👤 קונה', value: `<@${userId}>`, inline: true },
            { name: '🆔 מזהה הזמנה', value: bulkOrder.id.toString(), inline: true },
            { name: '📋 פריטים', value: itemsList, inline: false },
            { name: '💰 סה"כ', value: `₪${totalPrice.toFixed(2)}`, inline: true },
          ],
          timestamp: new Date(),
          footer: { text: 'Ido & Jonathan Shop' },
        }],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                label: 'אישור הזמנה',
                style: 3,
                custom_id: `approve_bulk_${bulkOrder.id}`,
              },
              {
                type: 2,
                label: 'דחיית הזמנה',
                style: 4,
                custom_id: `reject_bulk_${bulkOrder.id}`,
              },
            ],
          },
        ],
      });

      console.log('✓ Bulk order message sent:', bulkOrder.id);

      res.json({ 
        success: true, 
        message: 'Bulk order sent for approval',
        orderId: bulkOrder.id
      });
    } catch (channelError) {
      console.error('Error sending to approval channel:', channelError.message);
      console.error('Channel ID:', approvalChannelId);
      console.error('Bot ready:', isBotReady());
      res.status(500).json({ error: 'Failed to send approval message: ' + channelError.message });
    }
  } catch (error) {
    console.error('Bulk order error:', error);
    res.status(500).json({ error: 'Error creating bulk order: ' + error.message });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
