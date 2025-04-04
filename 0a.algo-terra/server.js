const express = require('express');
const WebSocket = require('ws');
const path = require('path');

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
const WS_API_URL = "wss://advanced-trade-ws.coinbase.com";

// Handle client WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected');

    // Connect to Coinbase WebSocket
    const coinbaseWs = new WebSocket(WS_API_URL);
    let messageCount = 0;

    coinbaseWs.on('open', () => {
        console.log('Connected to Coinbase WebSocket');
        
        // Subscribe to BTC-USD level2 channel
        const subscribeMessage = {
            type: "subscribe",
            channel: "level2",
            product_ids: ["BTC-USD"]
        };
        
        coinbaseWs.send(JSON.stringify(subscribeMessage));
    });

    coinbaseWs.on('message', (data) => {
        if (messageCount < 10) {
            const parsedData = JSON.parse(data);
            messageCount++;
            
            // Send message to client
            ws.send(JSON.stringify({
                count: messageCount,
                data: parsedData
            }));

            // Unsubscribe after 10 messages
            if (messageCount === 10) {
                const unsubscribeMessage = {
                    type: "unsubscribe",
                    channel: "level2",
                    product_ids: ["BTC-USD"]
                };
                
                coinbaseWs.send(JSON.stringify(unsubscribeMessage));
                coinbaseWs.close();
            }
        }
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

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        coinbaseWs.close();
    });
}); 