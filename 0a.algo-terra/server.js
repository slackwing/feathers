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
    let isSubscribed = false;

    coinbaseWs.on('open', () => {
        console.log('Connected to Coinbase WebSocket');
        
        // Subscribe to heartbeats first
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
        isSubscribed = true;
    });

    coinbaseWs.on('message', (data) => {
        try {
            const parsedData = JSON.parse(data);
            
            // // Only log l2_data messages
            // if (parsedData.channel === 'l2_data') {
            //     const event = parsedData.events[0];
            //     console.log(`L2 ${event.type}:`, 
            //         event.type === 'snapshot' 
            //             ? `Initial snapshot with ${event.updates.length} orders` 
            //             : `Update with ${event.updates.length} changes`
            //     );
            // }
            
            // Forward message to client
            ws.send(JSON.stringify({
                type: parsedData.channel,
                data: parsedData
            }));
        } catch (error) {
            console.error('Error processing message:', error);
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
        isSubscribed = false;
    });

    // Handle client messages (for stop command)
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.command === 'stop' && isSubscribed) {
            // Unsubscribe from both channels
            const unsubscribeMessage = {
                type: "unsubscribe",
                channel: "level2",
                product_ids: ["BTC-USD"]
            };
            coinbaseWs.send(JSON.stringify(unsubscribeMessage));

            const unsubscribeHeartbeat = {
                type: "unsubscribe",
                channel: "heartbeats"
            };
            coinbaseWs.send(JSON.stringify(unsubscribeHeartbeat));
            
            isSubscribed = false;
            coinbaseWs.close();
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        if (isSubscribed) {
            coinbaseWs.close();
        }
    });
}); 