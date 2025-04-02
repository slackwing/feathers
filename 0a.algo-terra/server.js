const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// WebSocket server for client connections
const wss = new WebSocket.Server({ server });

// Coinbase WebSocket configuration
const WS_API_URL = "wss://ws-feed.exchange.coinbase.com";

// API credentials
const API_KEY = "979bddb5-2d31-42c6-b8a9-97656a0b5fac";
const API_SECRET = "HbouB/Lt9n1DmPtauENuDI7KywaE2LAgeoXkOqgF5J70Jl5l1kmzssI3OWZFc03H+DLFHSyKrkAPYtt4X+uz9Q==";
const API_PASSPHRASE = ""; // You'll need to provide this

// Function to generate signature
function generateSignature(timestamp, method, requestPath, body) {
    const message = timestamp + method + requestPath + body;
    const key = Buffer.from(API_SECRET, 'base64');
    const hmac = crypto.createHmac('sha256', key);
    return hmac.update(message).digest('base64');
}

// Order book data structures
class OrderBook {
    constructor() {
        this.bids = new Map(); // price -> size
        this.asks = new Map(); // price -> size
    }

    // For Level2 updates
    updateLevel2(changes) {
        for (const [side, price, size] of changes) {
            const priceMap = side === 'buy' ? this.bids : this.asks;
            if (parseFloat(size) === 0) {
                priceMap.delete(price);
            } else {
                priceMap.set(price, size);
            }
        }
    }

    // For Level3 updates
    updateLevel3(type, orderId, side, price, size) {
        const priceMap = side === 'buy' ? this.bids : this.asks;
        
        switch (type) {
            case 'open':
                priceMap.set(price, size);
                break;
            case 'done':
                priceMap.delete(price);
                break;
            case 'change':
                if (priceMap.has(price)) {
                    priceMap.set(price, size);
                }
                break;
        }
    }

    // Get sorted order book
    getOrderBook() {
        const sortedBids = Array.from(this.bids.entries())
            .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
        const sortedAsks = Array.from(this.asks.entries())
            .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
        
        return {
            bids: sortedBids,
            asks: sortedAsks
        };
    }
}

// Handle client WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected');

    // Create order books
    const level2Book = new OrderBook();
    const level3Book = new OrderBook();

    // Connect to Coinbase WebSocket
    const coinbaseWs = new WebSocket(WS_API_URL);
    let isSubscribed = true;
    let messageCount = 0;
    const MAX_MESSAGES = 50;

    // Queue for Level 3 messages
    let level3MessageQueue = [];
    let isLevel3BookInitialized = false;

    coinbaseWs.on('open', () => {
        console.log('Connected to Coinbase WebSocket');
        
        const timestamp = Math.floor(Date.now() / 1000); // in seconds
        const method = "GET";
        const requestPath = "/users/self/verify";
        const body = ""; // No body for GET request
        
        // create the prehash string by concatenating required parts
        const message = timestamp + method + requestPath + body;
        
        // decode the base64 secret
        const key = Buffer.from(API_SECRET, "base64");
        
        // create a sha256 hmac with the secret
        const hmac = crypto.createHmac("sha256", key);
        
        // sign the required message with the hmac and base64 encode the result
        const signature = hmac.update(message).digest("base64");
        
        // Subscribe to both Level2 and Level3 channels
        const subscribeMessage = {
            type: "subscribe",
            product_ids: ["BTC-USD"],
            channels: [
                "level2",
                "level3"
            ],
            signature: signature,
            key: API_KEY,
            passphrase: API_PASSPHRASE,
            timestamp: timestamp
        };
        
        console.log('Sending subscription message:', JSON.stringify(subscribeMessage, null, 2));
        coinbaseWs.send(JSON.stringify(subscribeMessage));

        // TODO: Make REST call to get order book snapshot
        // For now, we'll just mark as initialized
        isLevel3BookInitialized = true;
        console.log('Level 3 book initialized (stubbed)');
    });

    coinbaseWs.on('message', (data) => {
        if (!isSubscribed) return;

        const parsedData = JSON.parse(data);
        console.log('Received message type:', parsedData.type);
        console.log('Message details:', JSON.stringify(parsedData, null, 2));
        
        if (messageCount < MAX_MESSAGES) {
            messageCount++;
            ws.send(JSON.stringify({
                type: 'debug_message',
                level: parsedData.channel || 'unknown',
                message: parsedData
            }));
        }

        // Handle Level 2 messages
        if (parsedData.channel === 'level2') {
            console.log('Received Level 2 message:', parsedData.type);
            if (parsedData.type === 'l2update') {
                console.log('Processing Level2 update with changes:', parsedData.changes);
                level2Book.updateLevel2(parsedData.changes);
                console.log('Level2 book updated. Current size:', level2Book.bids.size, 'bids and', level2Book.asks.size, 'asks');
            }
        }
        // Handle Level 3 messages
        else if (parsedData.channel === 'level3') {
            if (!isLevel3BookInitialized) {
                // Queue the message if we haven't initialized the book yet
                level3MessageQueue.push(parsedData);
                console.log('Queued Level 3 message:', parsedData.type);
            } else {
                // Process the message directly if book is initialized
                if (parsedData.type === 'open' || parsedData.type === 'done' || parsedData.type === 'change') {
                    console.log(`Processing Level3 ${parsedData.type}`);
                    level3Book.updateLevel3(
                        parsedData.type,
                        parsedData.order_id,
                        parsedData.side,
                        parsedData.price,
                        parsedData.remaining_size || parsedData.new_size
                    );
                }
            }
        }

        // Send updated order books to client
        ws.send(JSON.stringify({
            type: 'orderbook_update',
            level2: level2Book.getOrderBook(),
            level3: level3Book.getOrderBook()
        }));
    });

    coinbaseWs.on('error', (error) => {
        console.error('Coinbase WebSocket error:', error);
        ws.send(JSON.stringify({
            error: 'WebSocket error',
            details: error.message
        }));
    });

    coinbaseWs.on('close', () => {
        console.log('Coinbase WebSocket connection closed');
    });

    // Handle client messages (e.g., stop button)
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'stop') {
            isSubscribed = false;
            const unsubscribeMessage = {
                type: "unsubscribe",
                channels: ["level2", "level3"]
            };
            coinbaseWs.send(JSON.stringify(unsubscribeMessage));
            coinbaseWs.close();
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        isSubscribed = false;
        coinbaseWs.close();
    });
}); 