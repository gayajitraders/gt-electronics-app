import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'gayaji_traders_super_secret_key_12345';
const DB_PATH = path.join(__dirname, 'db', 'database.json');

// --- Helper: Read / Write DB ---
function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading DB:', err);
    return { users: [], products: [], coupons: [], orders: [], wishlists: {}, carts: {} };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing DB:', err);
    return false;
  }
}

// --- Helper: Cryptography ---
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Custom Base64url encode/decode for JWT
function base64urlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Decode JWT token parts
function base64urlDecode(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

// Sign JWT Token
function signToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadWithExp = { ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 };
  const payloadEncoded = base64urlEncode(JSON.stringify(payloadWithExp));
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
    
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

// Verify JWT Token
function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const [headerEncoded, payloadEncoded, signature] = parts;
  
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
    
  if (signature !== expectedSignature) return null;
  
  try {
    const payload = JSON.parse(base64urlDecode(payloadEncoded));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// --- Middleware: Extract User ---
function authenticateRequest(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
      const parts = c.trim().split('=');
      acc[parts[0]] = parts[1];
      return acc;
    }, {});
    token = cookies['token'];
  }
  
  return verifyToken(token);
}

// --- Request Body Reader ---
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

// --- Response Helper ---
function sendJSON(res, data, statusCode = 200, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...headers
  });
  res.end(JSON.stringify(data));
}

// --- Router and File Server ---
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`${method} ${pathname}`);

  // ----------------------------------------------------
  // API ROUTES
  // ----------------------------------------------------

  // 1. Auth API
  if (pathname === '/api/auth/signup' && method === 'POST') {
    try {
      const { name, email, password, phone } = await parseJsonBody(req);
      if (!name || !email || !password || !phone) {
        return sendJSON(res, { error: 'Please provide all details' }, 400);
      }
      
      const db = readDB();
      if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return sendJSON(res, { error: 'Email already registered' }, 400);
      }
      
      const newUser = {
        id: 'u_' + Date.now(),
        name,
        email: email.toLowerCase(),
        passwordHash: hashPassword(password),
        role: 'CUSTOMER',
        phone,
        addresses: []
      };
      
      db.users.push(newUser);
      writeDB(db);
      
      const token = signToken({ userId: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name });
      return sendJSON(res, { 
        message: 'Registration successful',
        token,
        user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, phone: newUser.phone }
      }, 201, {
        'Set-Cookie': `token=${token}; HttpOnly; Path=/; Max-Age=86400`
      });
    } catch (err) {
      return sendJSON(res, { error: 'Invalid data format' }, 400);
    }
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const { email, password } = await parseJsonBody(req);
      if (!email || !password) {
        return sendJSON(res, { error: 'Please enter email and password' }, 400);
      }
      
      const db = readDB();
      const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user || user.passwordHash !== hashPassword(password)) {
        return sendJSON(res, { error: 'Invalid email or password' }, 401);
      }
      
      const token = signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });
      return sendJSON(res, {
        message: 'Login successful',
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone }
      }, 200, {
        'Set-Cookie': `token=${token}; HttpOnly; Path=/; Max-Age=86400`
      });
    } catch (err) {
      return sendJSON(res, { error: 'Invalid data format' }, 400);
    }
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    return sendJSON(res, { message: 'Logged out successfully' }, 200, {
      'Set-Cookie': 'token=; HttpOnly; Path=/; Max-Age=0'
    });
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const userPayload = authenticateRequest(req);
    if (!userPayload) {
      return sendJSON(res, { error: 'Unauthorized' }, 401);
    }
    
    const db = readDB();
    const user = db.users.find(u => u.id === userPayload.userId);
    if (!user) {
      return sendJSON(res, { error: 'User not found' }, 404);
    }
    
    return sendJSON(res, {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, addresses: user.addresses || [] }
    });
  }

  // Address APIs
  if (pathname === '/api/auth/address' && method === 'POST') {
    const userPayload = authenticateRequest(req);
    if (!userPayload) return sendJSON(res, { error: 'Unauthorized' }, 401);
    
    try {
      const { tag, name, phone, street, city, state, pincode } = await parseJsonBody(req);
      if (!tag || !name || !phone || !street || !city || !state || !pincode) {
        return sendJSON(res, { error: 'All fields required' }, 400);
      }
      
      const db = readDB();
      const userIndex = db.users.findIndex(u => u.id === userPayload.userId);
      if (userIndex === -1) return sendJSON(res, { error: 'User not found' }, 404);
      
      if (!db.users[userIndex].addresses) db.users[userIndex].addresses = [];
      const newAddress = { id: 'addr_' + Date.now(), tag, name, phone, street, city, state, pincode };
      db.users[userIndex].addresses.push(newAddress);
      writeDB(db);
      
      return sendJSON(res, { message: 'Address saved successfully', address: newAddress }, 201);
    } catch (e) {
      return sendJSON(res, { error: 'Invalid address data' }, 400);
    }
  }

  if (pathname.startsWith('/api/auth/address/') && method === 'DELETE') {
    const userPayload = authenticateRequest(req);
    if (!userPayload) return sendJSON(res, { error: 'Unauthorized' }, 401);
    
    const addressId = pathname.substring('/api/auth/address/'.length);
    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === userPayload.userId);
    
    if (userIndex !== -1 && db.users[userIndex].addresses) {
      db.users[userIndex].addresses = db.users[userIndex].addresses.filter(addr => addr.id !== addressId);
      writeDB(db);
      return sendJSON(res, { message: 'Address deleted' });
    }
    return sendJSON(res, { error: 'Address not found' }, 404);
  }

  // 2. Product APIs
  if (pathname === '/api/products' && method === 'GET') {
    const db = readDB();
    let products = db.products;
    
    const searchQuery = parsedUrl.searchParams.get('q');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    
    const category = parsedUrl.searchParams.get('category');
    if (category) {
      products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    
    const lowStock = parsedUrl.searchParams.get('lowStock');
    if (lowStock === 'true') {
      products = products.filter(p => p.stock <= 5);
    }
    
    return sendJSON(res, products);
  }

  if (pathname === '/api/products' && method === 'POST') {
    const userPayload = authenticateRequest(req);
    if (!userPayload || userPayload.role !== 'ADMIN') {
      return sendJSON(res, { error: 'Unauthorized. Admin role required.' }, 403);
    }
    
    try {
      const { name, description, price, category, stock, imageUrl } = await parseJsonBody(req);
      if (!name || !price || !category || stock === undefined) {
        return sendJSON(res, { error: 'Missing product details' }, 400);
      }
      
      const db = readDB();
      const newProduct = {
        id: 'p_' + Date.now(),
        name,
        description: description || '',
        price: Number(price),
        category,
        stock: Number(stock),
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=120'
      };
      
      db.products.push(newProduct);
      writeDB(db);
      return sendJSON(res, { message: 'Product created successfully', product: newProduct }, 201);
    } catch (e) {
      return sendJSON(res, { error: 'Invalid specifications' }, 400);
    }
  }

  if (pathname.startsWith('/api/products/') && method === 'PUT') {
    const userPayload = authenticateRequest(req);
    if (!userPayload || userPayload.role !== 'ADMIN') {
      return sendJSON(res, { error: 'Unauthorized' }, 403);
    }
    
    const productId = pathname.substring('/api/products/'.length);
    try {
      const updates = await parseJsonBody(req);
      const db = readDB();
      const productIndex = db.products.findIndex(p => p.id === productId);
      
      if (productIndex === -1) return sendJSON(res, { error: 'Product not found' }, 404);
      
      const updatedProduct = {
        ...db.products[productIndex],
        ...updates,
        price: updates.price !== undefined ? Number(updates.price) : db.products[productIndex].price,
        stock: updates.stock !== undefined ? Number(updates.stock) : db.products[productIndex].stock
      };
      
      db.products[productIndex] = updatedProduct;
      writeDB(db);
      return sendJSON(res, { message: 'Product updated successfully', product: updatedProduct });
    } catch (e) {
      return sendJSON(res, { error: 'Invalid specs' }, 400);
    }
  }

  if (pathname.startsWith('/api/products/') && method === 'DELETE') {
    const userPayload = authenticateRequest(req);
    if (!userPayload || userPayload.role !== 'ADMIN') {
      return sendJSON(res, { error: 'Unauthorized' }, 403);
    }
    
    const productId = pathname.substring('/api/products/'.length);
    const db = readDB();
    const initialLen = db.products.length;
    db.products = db.products.filter(p => p.id !== productId);
    
    if (db.products.length === initialLen) {
      return sendJSON(res, { error: 'Product not found' }, 404);
    }
    
    writeDB(db);
    return sendJSON(res, { message: 'Product deleted successfully' });
  }

  // 3. Cart & Wishlist APIs
  if (pathname === '/api/cart' && method === 'GET') {
    const userPayload = authenticateRequest(req);
    if (!userPayload) return sendJSON(res, { error: 'Unauthorized' }, 401);
    
    const db = readDB();
    return sendJSON(res, db.carts[userPayload.userId] || []);
  }

  if (pathname === '/api/cart' && method === 'POST') {
    const userPayload = authenticateRequest(req);
    if (!userPayload) return sendJSON(res, { error: 'Unauthorized' }, 401);
    
    try {
      const { productId, quantity } = await parseJsonBody(req);
      if (!productId || quantity === undefined) {
        return sendJSON(res, { error: 'Product ID and qty required' }, 400);
      }
      
      const db = readDB();
      const product = db.products.find(p => p.id === productId);
      if (!product) return sendJSON(res, { error: 'Product not found' }, 404);
      
      if (quantity > product.stock) {
        return sendJSON(res, { error: `Only ${product.stock} items left.` }, 400);
      }
      
      if (!db.carts[userPayload.userId]) db.carts[userPayload.userId] = [];
      const idx = db.carts[userPayload.userId].findIndex(item => item.productId === productId);
      
      if (quantity <= 0) {
        if (idx !== -1) db.carts[userPayload.userId].splice(idx, 1);
      } else {
        if (idx !== -1) {
          db.carts[userPayload.userId][idx].quantity = Number(quantity);
        } else {
          db.carts[userPayload.userId].push({
            productId,
            name: product.name,
            price: product.price,
            imageUrl: product.imageUrl,
            quantity: Number(quantity)
          });
        }
      }
      
      writeDB(db);
      return sendJSON(res, db.carts[userPayload.userId]);
    } catch (e) {
      return sendJSON(res, { error: 'Invalid payload' }, 400);
    }
  }

  if (pathname === '/api/wishlist' && method === 'GET') {
    const userPayload = authenticateRequest(req);
    if (!userPayload) return sendJSON(res, { error: 'Unauthorized' }, 401);
    
    const db = readDB();
    return sendJSON(res, db.wishlists[userPayload.userId] || []);
  }

  if (pathname === '/api/wishlist' && method === 'POST') {
    const userPayload = authenticateRequest(req);
    if (!userPayload) return sendJSON(res, { error: 'Unauthorized' }, 401);
    
    try {
      const { productId } = await parseJsonBody(req);
      if (!productId) return sendJSON(res, { error: 'Product ID required' }, 400);
      
      const db = readDB();
      if (!db.wishlists[userPayload.userId]) db.wishlists[userPayload.userId] = [];
      
      const idx = db.wishlists[userPayload.userId].indexOf(productId);
      let isAdded = false;
      if (idx === -1) {
        db.wishlists[userPayload.userId].push(productId);
        isAdded = true;
      } else {
        db.wishlists[userPayload.userId].splice(idx, 1);
      }
      
      writeDB(db);
      return sendJSON(res, { isAdded, wishlist: db.wishlists[userPayload.userId] });
    } catch (e) {
      return sendJSON(res, { error: 'Invalid payload' }, 400);
    }
  }

  // 4. Coupon APIs
  if (pathname === '/api/coupons/validate' && method === 'POST') {
    try {
      const { code } = await parseJsonBody(req);
      if (!code) return sendJSON(res, { error: 'Coupon code required' }, 400);
      
      const db = readDB();
      const coupon = db.coupons.find(c => c.code.toUpperCase() === code.toUpperCase() && c.isActive);
      if (!coupon) return sendJSON(res, { error: 'Invalid coupon code' }, 400);
      
      if (new Date(coupon.expiryDate) < new Date()) {
        return sendJSON(res, { error: 'Coupon is expired' }, 400);
      }
      return sendJSON(res, coupon);
    } catch (e) {
      return sendJSON(res, { error: 'Invalid payload' }, 400);
    }
  }

  if (pathname === '/api/coupons' && method === 'GET') {
    const userPayload = authenticateRequest(req);
    if (!userPayload || userPayload.role !== 'ADMIN') return sendJSON(res, { error: 'Unauthorized' }, 403);
    const db = readDB();
    return sendJSON(res, db.coupons);
  }

  if (pathname === '/api/coupons' && method === 'POST') {
    const userPayload = authenticateRequest(req);
    if (!userPayload || userPayload.role !== 'ADMIN') return sendJSON(res, { error: 'Unauthorized' }, 403);
    
    try {
      const { code, discountPercent, maxDiscount, expiryDate } = await parseJsonBody(req);
      if (!code || !discountPercent || !maxDiscount || !expiryDate) {
        return sendJSON(res, { error: 'All coupon fields required' }, 400);
      }
      
      const db = readDB();
      if (db.coupons.find(c => c.code.toUpperCase() === code.toUpperCase())) {
        return sendJSON(res, { error: 'Coupon code already exists' }, 400);
      }
      
      const newCoupon = {
        code: code.toUpperCase(),
        discountPercent: Number(discountPercent),
        maxDiscount: Number(maxDiscount),
        expiryDate,
        isActive: true
      };
      db.coupons.push(newCoupon);
      writeDB(db);
      return sendJSON(res, { message: 'Coupon created successfully', coupon: newCoupon }, 201);
    } catch (e) {
      return sendJSON(res, { error: 'Invalid arguments' }, 400);
    }
  }

  if (pathname.startsWith('/api/coupons/') && method === 'DELETE') {
    const userPayload = authenticateRequest(req);
    if (!userPayload || userPayload.role !== 'ADMIN') return sendJSON(res, { error: 'Unauthorized' }, 403);
    
    const couponCode = pathname.substring('/api/coupons/'.length).toUpperCase();
    const db = readDB();
    const initialLen = db.coupons.length;
    db.coupons = db.coupons.filter(c => c.code !== couponCode);
    
    if (db.coupons.length === initialLen) return sendJSON(res, { error: 'Coupon not found' }, 404);
    
    writeDB(db);
    return sendJSON(res, { message: 'Coupon deleted successfully' });
  }

  // 5. Orders APIs
  if (pathname === '/api/orders' && method === 'GET') {
    const userPayload = authenticateRequest(req);
    if (!userPayload) return sendJSON(res, { error: 'Unauthorized' }, 401);
    
    const db = readDB();
    let userOrders = [];
    if (userPayload.role === 'ADMIN') {
      userOrders = db.orders;
    } else if (userPayload.role === 'DELIVERY_BOY') {
      userOrders = db.orders.filter(o => o.deliveryBoyId === userPayload.userId);
    } else {
      userOrders = db.orders.filter(o => o.userId === userPayload.userId);
    }
    return sendJSON(res, userOrders);
  }

  if (pathname === '/api/orders' && method === 'POST') {
    const userPayload = authenticateRequest(req);
    if (!userPayload) return sendJSON(res, { error: 'Unauthorized' }, 401);
    
    try {
      const { addressId, paymentMethod, paymentDetails, couponCode } = await parseJsonBody(req);
      if (!addressId || !paymentMethod) return sendJSON(res, { error: 'Address and pay mode required' }, 400);
      
      const db = readDB();
      const cart = db.carts[userPayload.userId] || [];
      if (cart.length === 0) return sendJSON(res, { error: 'Your cart is empty' }, 400);
      
      // Verify stocks
      for (const item of cart) {
        const prod = db.products.find(p => p.id === item.productId);
        if (!prod || prod.stock < item.quantity) {
          return sendJSON(res, { error: `Appliance "${item.name}" is out of stock` }, 400);
        }
      }
      
      let subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      let discount = 0;
      
      if (couponCode) {
        const coupon = db.coupons.find(c => c.code.toUpperCase() === couponCode.toUpperCase() && c.isActive);
        if (coupon && new Date(coupon.expiryDate) >= new Date()) {
          discount = Math.min((subtotal * coupon.discountPercent) / 100, coupon.maxDiscount);
        }
      }
      const totalAmount = Math.max(subtotal - discount, 0);
      
      const user = db.users.find(u => u.id === userPayload.userId);
      const address = user.addresses.find(addr => addr.id === addressId);
      if (!address) return sendJSON(res, { error: 'Valid shipping address required' }, 400);
      
      // Decrement stocks
      for (const item of cart) {
        const prod = db.products.find(p => p.id === item.productId);
        prod.stock -= item.quantity;
      }
      
      const newOrder = {
        id: 'ord_' + Math.floor(100000 + Math.random() * 900000),
        userId: userPayload.userId,
        customerName: user.name,
        customerPhone: user.phone,
        items: cart,
        subtotal,
        discount,
        totalAmount,
        paymentMethod,
        paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PAID',
        paymentDetails: paymentDetails || {},
        orderStatus: 'PLACED',
        address,
        couponCode: couponCode || null,
        deliveryBoyId: null,
        deliveryBoyName: null,
        statusHistory: [
          { status: 'PLACED', time: new Date().toISOString(), remark: 'Order placed on Gaya Ji Traders.' }
        ],
        createdAt: new Date().toISOString()
      };
      
      db.orders.push(newOrder);
      db.carts[userPayload.userId] = []; // Clear cart
      writeDB(db);
      return sendJSON(res, { message: 'Order placed', order: newOrder }, 201);
    } catch (e) {
      return sendJSON(res, { error: 'Checkout failed' }, 400);
    }
  }

  // Order Cancellation API: RESTORES stock levels!
  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/cancel') && method === 'PUT') {
    const userPayload = authenticateRequest(req);
    if (!userPayload) return sendJSON(res, { error: 'Unauthorized' }, 401);
    
    const segments = pathname.split('/');
    const orderId = segments[3];
    
    const db = readDB();
    const order = db.orders.find(o => o.id === orderId);
    
    if (!order) return sendJSON(res, { error: 'Order not found' }, 404);
    
    // Check role permission
    if (userPayload.role === 'CUSTOMER' && order.userId !== userPayload.userId) {
      return sendJSON(res, { error: 'Access denied.' }, 403);
    }
    
    if (order.orderStatus === 'DELIVERED' || order.orderStatus === 'OUT_FOR_DELIVERY' || order.orderStatus === 'CANCELLED') {
      return sendJSON(res, { error: `Cannot cancel order in ${order.orderStatus} status.` }, 400);
    }
    
    // Restore product stocks
    for (const item of order.items) {
      const prod = db.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock += item.quantity; // Restore
      }
    }
    
    order.orderStatus = 'CANCELLED';
    order.statusHistory.push({
      status: 'CANCELLED',
      time: new Date().toISOString(),
      remark: 'Order cancelled by customer. Product stock restored.'
    });
    
    writeDB(db);
    return sendJSON(res, { message: 'Order cancelled successfully', order });
  }

  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/status') && method === 'PUT') {
    const userPayload = authenticateRequest(req);
    if (!userPayload) return sendJSON(res, { error: 'Unauthorized' }, 401);
    
    const segments = pathname.split('/');
    const orderId = segments[3];
    
    try {
      const { status, remark } = await parseJsonBody(req);
      if (!status) return sendJSON(res, { error: 'Status required' }, 400);
      
      const db = readDB();
      const order = db.orders.find(o => o.id === orderId);
      if (!order) return sendJSON(res, { error: 'Order not found' }, 404);
      
      if (userPayload.role === 'DELIVERY_BOY' && order.deliveryBoyId !== userPayload.userId) {
        return sendJSON(res, { error: 'Access denied.' }, 403);
      }
      if (userPayload.role === 'CUSTOMER') return sendJSON(res, { error: 'Access denied' }, 403);
      
      order.orderStatus = status;
      if (status === 'DELIVERED') order.paymentStatus = 'PAID';
      
      order.statusHistory.push({
        status,
        time: new Date().toISOString(),
        remark: remark || `Shipment marked as ${status}`
      });
      
      writeDB(db);
      return sendJSON(res, { message: 'Shipment updated', order });
    } catch (e) {
      return sendJSON(res, { error: 'Invalid request' }, 400);
    }
  }

  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/assign') && method === 'PUT') {
    const userPayload = authenticateRequest(req);
    if (!userPayload || userPayload.role !== 'ADMIN') return sendJSON(res, { error: 'Unauthorized' }, 403);
    
    const segments = pathname.split('/');
    const orderId = segments[3];
    
    try {
      const { deliveryBoyId } = await parseJsonBody(req);
      if (!deliveryBoyId) return sendJSON(res, { error: 'Delivery Boy ID required' }, 400);
      
      const db = readDB();
      const order = db.orders.find(o => o.id === orderId);
      if (!order) return sendJSON(res, { error: 'Order not found' }, 404);
      
      const deliveryBoy = db.users.find(u => u.id === deliveryBoyId && u.role === 'DELIVERY_BOY');
      if (!deliveryBoy) return sendJSON(res, { error: 'Invalid delivery partner selected' }, 400);
      
      order.deliveryBoyId = deliveryBoyId;
      order.deliveryBoyName = deliveryBoy.name;
      order.statusHistory.push({
        status: order.orderStatus,
        time: new Date().toISOString(),
        remark: `Delivery partner ${deliveryBoy.name} assigned to order.`
      });
      
      writeDB(db);
      return sendJSON(res, { message: 'Agent assigned', order });
    } catch (e) {
      return sendJSON(res, { error: 'Invalid payload' }, 400);
    }
  }

  if (pathname.startsWith('/api/orders/') && method === 'GET') {
    const userPayload = authenticateRequest(req);
    if (!userPayload) return sendJSON(res, { error: 'Unauthorized' }, 401);
    
    const orderId = pathname.substring('/api/orders/'.length);
    const db = readDB();
    const order = db.orders.find(o => o.id === orderId);
    if (!order) return sendJSON(res, { error: 'Order not found' }, 404);
    
    if (userPayload.role === 'CUSTOMER' && order.userId !== userPayload.userId) {
      return sendJSON(res, { error: 'Access denied' }, 403);
    }
    if (userPayload.role === 'DELIVERY_BOY' && order.deliveryBoyId !== userPayload.userId) {
      return sendJSON(res, { error: 'Access denied' }, 403);
    }
    
    return sendJSON(res, order);
  }

  // 6. Admin Panel APIs
  if (pathname === '/api/admin/users' && method === 'GET') {
    const userPayload = authenticateRequest(req);
    if (!userPayload || userPayload.role !== 'ADMIN') return sendJSON(res, { error: 'Unauthorized' }, 403);
    
    const db = readDB();
    const list = db.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone }));
    return sendJSON(res, list);
  }

  // User Role Modification API & Ownership Transfer
  if (pathname.startsWith('/api/admin/users/') && pathname.endsWith('/role') && method === 'PUT') {
    const userPayload = authenticateRequest(req);
    if (!userPayload || userPayload.role !== 'ADMIN') return sendJSON(res, { error: 'Unauthorized' }, 403);
    
    const segments = pathname.split('/');
    const targetUserId = segments[4];
    
    try {
      const { role, isTransfer } = await parseJsonBody(req);
      if (!role) return sendJSON(res, { error: 'Role is required' }, 400);
      if (!['ADMIN', 'CUSTOMER', 'DELIVERY_BOY'].includes(role)) {
        return sendJSON(res, { error: 'Invalid role specification' }, 400);
      }
      
      const db = readDB();
      const targetUser = db.users.find(u => u.id === targetUserId);
      if (!targetUser) return sendJSON(res, { error: 'Target user not found' }, 404);
      
      if (isTransfer) {
        // Complete ownership transfer: promote target to admin, demote current logged-in user to customer
        const currentUser = db.users.find(u => u.id === userPayload.userId);
        if (currentUser) {
          currentUser.role = 'CUSTOMER';
        }
        targetUser.role = 'ADMIN';
        writeDB(db);
        return sendJSON(res, { message: 'Admin rights successfully transferred. Your session is demoted.', demoted: true });
      } else {
        // Simple role modification
        targetUser.role = role;
        writeDB(db);
        return sendJSON(res, { message: `Role of ${targetUser.name} updated to ${role}` });
      }
    } catch (e) {
      return sendJSON(res, { error: 'Invalid update payload' }, 400);
    }
  }

  if (pathname === '/api/admin/reports' && method === 'GET') {
    const userPayload = authenticateRequest(req);
    if (!userPayload || userPayload.role !== 'ADMIN') return sendJSON(res, { error: 'Unauthorized' }, 403);
    
    const db = readDB();
    const orders = db.orders;
    
    const totalOrders = orders.filter(o => o.orderStatus !== 'CANCELLED').length;
    const totalRevenue = orders.reduce((sum, o) => (o.paymentStatus === 'PAID' && o.orderStatus !== 'CANCELLED') ? sum + o.totalAmount : sum, 0);
    const pendingRevenue = orders.reduce((sum, o) => (o.paymentStatus === 'PENDING' && o.orderStatus !== 'CANCELLED') ? sum + o.totalAmount : sum, 0);
    
    let codCount = 0;
    let codRevenue = 0;
    let onlineCount = 0;
    let onlineRevenue = 0;
    
    orders.forEach(o => {
      if (o.orderStatus === 'CANCELLED') return;
      if (o.paymentMethod === 'COD') {
        codCount++;
        codRevenue += o.totalAmount;
      } else {
        onlineCount++;
        onlineRevenue += o.totalAmount;
      }
    });
    
    const categorySales = {};
    const stockReport = db.products.map(p => ({ id: p.id, name: p.name, stock: p.stock, price: p.price }));
    
    orders.forEach(o => {
      if (o.orderStatus === 'CANCELLED') return;
      o.items.forEach(item => {
        const prod = db.products.find(p => p.id === item.productId);
        if (prod) {
          categorySales[prod.category] = (categorySales[prod.category] || 0) + (item.price * item.quantity);
        }
      });
    });
    
    return sendJSON(res, {
      totalOrders,
      totalRevenue,
      pendingRevenue,
      paymentMethodReport: {
        cod: { count: codCount, revenue: codRevenue },
        online: { count: onlineCount, revenue: onlineRevenue }
      },
      categorySales,
      stockReport
    });
  }

  // ----------------------------------------------------
  // STATIC FILE SERVER
  // ----------------------------------------------------
  if (method === 'GET') {
    let filePath = pathname === '/' ? '/index.html' : pathname;
    const ext = path.extname(filePath);
    if (!ext) {
      filePath = '/index.html';
    }
    
    const absoluteFilePath = path.join(__dirname, 'public', filePath);
    fs.stat(absoluteFilePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('File Not Found');
      }
      
      const fileExt = path.extname(absoluteFilePath).toLowerCase();
      const contentType = MIME_TYPES[fileExt] || 'application/octet-stream';
      
      res.writeHead(200, { 'Content-Type': contentType });
      const stream = fs.createReadStream(absoluteFilePath);
      stream.pipe(res);
    });
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Gaya Ji Traders Server running at: http://localhost:${PORT}`);
  console.log(`⚡ Zero-dependency mode activated using standard Node.js libraries.`);
  console.log(`======================================================\n`);
});
