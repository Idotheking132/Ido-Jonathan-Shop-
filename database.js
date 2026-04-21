import fs from 'fs';
import path from 'path';

const DB_FILE = 'shop.json';
const DB_BACKUP = 'shop.backup.json';

// Initialize database structure
let db = {
  products: [],
  purchases: [],
  tickets: [],
  cooldowns: {},
  blocked_users: {} // {userId: {until: timestamp, reason: string}}
};

// Load database from file
function loadDB() {
  try {
    // Try to load main file first
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
      console.log('✓ Database loaded from shop.json');
      return;
    }
    
    // If main file doesn't exist, try backup
    if (fs.existsSync(DB_BACKUP)) {
      const data = fs.readFileSync(DB_BACKUP, 'utf8');
      db = JSON.parse(data);
      // Restore from backup
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
      console.log('✓ Database restored from backup');
      return;
    }
    
    console.log('ℹ Database initialized (new)');
  } catch (error) {
    console.error('Error loading database:', error);
  }
}

// Save database to file
export function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    // Also save backup
    fs.writeFileSync(DB_BACKUP, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

// Load on startup
loadDB();

// Export db object for direct access
export { db };

// Products
export function getProducts() {
  return db.products.filter(p => p.stock > 0);
}

export function getAllProducts() {
  return db.products;
}

export function getProduct(id) {
  return db.products.find(p => p.id === id);
}

export function addProduct(name, description, price, stock, maxPurchase, imageUrl, discountVip) {
  const id = db.products.length > 0 ? Math.max(...db.products.map(p => p.id)) + 1 : 1;
  const product = {
    id,
    name,
    description,
    price,
    stock,
    max_purchase: maxPurchase,
    unlimited: maxPurchase === -1, // -1 means unlimited
    image_url: imageUrl,
    discount_vip: discountVip,
    created_at: new Date().toISOString()
  };
  db.products.push(product);
  saveDB();
  return { lastInsertRowid: id };
}

export function updateProduct(name, description, price, stock, maxPurchase, imageUrl, discountVip, id) {
  const index = db.products.findIndex(p => p.id === id);
  if (index !== -1) {
    db.products[index] = {
      ...db.products[index],
      name,
      description,
      price,
      stock,
      max_purchase: maxPurchase,
      unlimited: maxPurchase === -1,
      image_url: imageUrl,
      discount_vip: discountVip
    };
    saveDB();
  }
}

export function deleteProduct(id) {
  db.products = db.products.filter(p => p.id !== id);
  saveDB();
}

export function updateStock(quantity, id) {
  const product = db.products.find(p => p.id === id);
  if (product) {
    product.stock -= quantity;
    saveDB();
  }
}

// Purchases
export function addPurchase(userId, username, productId, quantity, totalPrice, ticketChannelId) {
  const id = db.purchases.length > 0 ? Math.max(...db.purchases.map(p => p.id)) + 1 : 1;
  const purchase = {
    id,
    user_id: userId,
    username,
    product_id: productId,
    quantity,
    total_price: totalPrice,
    ticket_channel_id: ticketChannelId,
    purchased_at: new Date().toISOString()
  };
  db.purchases.push(purchase);
  saveDB();
  return { lastInsertRowid: id };
}

export function getUserPurchases(userId) {
  return db.purchases.filter(p => p.user_id === userId);
}

export function getAllPurchases() {
  return db.purchases.map(purchase => {
    const product = db.products.find(p => p.id === purchase.product_id);
    return {
      ...purchase,
      product_name: product ? product.name : 'Unknown'
    };
  });
}

// Tickets
export function addTicket(userId, username, productId, quantity, totalPrice, channelId) {
  const id = db.tickets.length > 0 ? Math.max(...db.tickets.map(t => t.id)) + 1 : 1;
  const ticket = {
    id,
    user_id: userId,
    username,
    product_id: productId,
    quantity,
    total_price: totalPrice,
    channel_id: channelId,
    status: 'pending', // pending, approved, rejected, closed
    is_bulk: false, // false for regular, true for bulk order
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.tickets.push(ticket);
  saveDB();
  return ticket;
}

export function addBulkOrder(userId, username, items, totalPrice) {
  const id = db.tickets.length > 0 ? Math.max(...db.tickets.map(t => t.id)) + 1 : 1;
  const ticket = {
    id,
    user_id: userId,
    username,
    items, // array of {product_id, quantity}
    total_price: totalPrice,
    channel_id: null,
    status: 'pending_approval', // pending_approval, approved, rejected, closed
    is_bulk: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.tickets.push(ticket);
  saveDB();
  return ticket;
}

export function getTicket(channelId) {
  return db.tickets.find(t => t.channel_id === channelId);
}

export function getAllTickets() {
  return db.tickets.map(ticket => {
    const product = db.products.find(p => p.id === ticket.product_id);
    return {
      ...ticket,
      product_name: product ? product.name : 'Unknown'
    };
  });
}

export function updateTicketStatus(channelId, status) {
  const ticket = db.tickets.find(t => t.channel_id === channelId);
  if (ticket) {
    ticket.status = status;
    ticket.updated_at = new Date().toISOString();
    saveDB();
    return ticket;
  }
  return null;
}

export function deleteTicket(channelId) {
  db.tickets = db.tickets.filter(t => t.channel_id !== channelId);
  saveDB();
}

// Cooldowns - remove for specific user
export function removeCooldown(userId) {
  delete db.cooldowns[userId];
  saveDB();
}

// Cooldowns
export function getCooldown(userId) {
  return db.cooldowns[userId] ? { last_purchase: db.cooldowns[userId] } : null;
}

export function setCooldown(userId) {
  db.cooldowns[userId] = new Date().toISOString();
  saveDB();
}

// Blocked Users
export function blockUser(userId, hours, reason = '') {
  const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  db.blocked_users[userId] = {
    until,
    reason,
    blocked_at: new Date().toISOString()
  };
  saveDB();
  return { userId, until, reason };
}

export function unblockUser(userId) {
  delete db.blocked_users[userId];
  saveDB();
}

export function isUserBlocked(userId) {
  const block = db.blocked_users[userId];
  if (!block) return null;
  
  const now = new Date();
  const until = new Date(block.until);
  
  if (now > until) {
    // Block expired
    delete db.blocked_users[userId];
    saveDB();
    return null;
  }
  
  return block;
}

export function getAllBlockedUsers() {
  const now = new Date();
  const blocked = [];
  
  for (const [userId, block] of Object.entries(db.blocked_users)) {
    const until = new Date(block.until);
    if (now <= until) {
      blocked.push({
        user_id: userId,
        ...block,
        time_left: Math.ceil((until - now) / 1000 / 60) // minutes
      });
    } else {
      delete db.blocked_users[userId];
    }
  }
  
  saveDB();
  return blocked;
}

export default db;
