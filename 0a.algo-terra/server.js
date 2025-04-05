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

// Coinbase Advanced Trade WebSocket configuration
const WS_API_URL = "wss://advanced-trade-ws.coinbase.com";

// Handle client WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected');

    // Connect to Coinbase WebSocket
    const coinbaseWs = new WebSocket(WS_API_URL);
    let messageCount = 0;
    let heartbeatInterval;

    coinbaseWs.on('open', () => {
        console.log('Connected to Coinbase WebSocket');
        
        // Subscribe to heartbeats channel
        const heartbeatMessage = {
            type: "subscribe",
            channel: "heartbeats"
        };
        coinbaseWs.send(JSON.stringify(heartbeatMessage));
        
        // Subscribe to BTC-USD level2 channel
        const subscribeMessage = {
            type: "subscribe",
            channel: "level2",
            product_ids: ["BTC-USD"]
        };
        coinbaseWs.send(JSON.stringify(subscribeMessage));
    });

    coinbaseWs.on('message', (data) => {
        const parsedData = JSON.parse(data);
        
        // Handle heartbeat messages
        if (parsedData.channel === 'heartbeats') {
            console.log('Heartbeat received:', parsedData.events[0].heartbeat_counter);
            return;
        }

        // Handle level2 messages
        if (parsedData.channel === 'l2_data' && messageCount < 10) {
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
                clearInterval(heartbeatInterval);
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
        clearInterval(heartbeatInterval);
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(heartbeatInterval);
        coinbaseWs.close();
    });
}); 