import fs from 'fs';
import path from 'path';

const DB_FILE = 'shop.json';

// Initialize database structure
let db = {
  products: [],
  purchases: [],
  tickets: [],
  cooldowns: {}
};

// Load database from file
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading database:', error);
  }
}

// Save database to file
function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

// Load on startup
loadDB();

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

// Cooldowns
export function getCooldown(userId) {
  return db.cooldowns[userId] ? { last_purchase: db.cooldowns[userId] } : null;
}

export function setCooldown(userId) {
  db.cooldowns[userId] = new Date().toISOString();
  saveDB();
}

export default db;
