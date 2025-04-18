const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

const WS_API_URL = "wss://advanced-trade-ws.coinbase.com";
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
    console.log(`Node.js server connected to user WebSocket client (e.g. browser).`);

    // Connect to Coinbase WebSocket
    const coinbaseWs = new WebSocket(WS_API_URL);
    let isSubscribed = false;

    coinbaseWs.on('open', () => {

        console.log(`Node.js server connected to Websocket client at ${WS_API_URL}.`);
        
        console.log('Subscribing to "heartbeats" channel...');
        const heartbeatMessage = {
            type: "subscribe",
            channel: "heartbeats"
        };
        coinbaseWs.send(JSON.stringify(heartbeatMessage));

        console.log('Subscribing to BTC-USD "level2" channel...');
        const subscribeMessage = {
            type: "subscribe",
            channel: "level2",
            product_ids: ["BTC-USD"]
        };
        coinbaseWs.send(JSON.stringify(subscribeMessage));

        console.log('Subscribing to BTC-USD "market_trades" channel...');
        const marketTradesMessage = {
            type: "subscribe",
            channel: "market_trades",
            product_ids: ["BTC-USD"]
        };
        coinbaseWs.send(JSON.stringify(marketTradesMessage));

        isSubscribed = true;
    });

    coinbaseWs.on('message', (data) => {
        try {
            const parsedData = JSON.parse(data);
            ws.send(JSON.stringify({
                type: parsedData.channel,
                data: parsedData
            }));
        } catch (error) {
            console.error('Failed to parse message received:', error);
        }
    });

    coinbaseWs.on('error', (error) => {
        console.error(`WebSocket error from ${WS_API_URL}:`, error);
        ws.send(JSON.stringify({
            error: 'WebSocket error',
            details: error.message
        }));
    });

    coinbaseWs.on('close', () => {
        console.log(`WebSocket connection to ${WS_API_URL} closed.`);
        isSubscribed = false;
    });

    // Messages from the user client (e.g. browser).
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.command === 'stop' && isSubscribed) {

            const unsubscribeMessage = {
                type: "unsubscribe",
                channel: "level2",
                product_ids: ["BTC-USD"]
            };
            coinbaseWs.send(JSON.stringify(unsubscribeMessage));

            const unsubscribeMarketTrades = {
                type: "unsubscribe",
                channel: "market_trades",
                product_ids: ["BTC-USD"]
            };
            coinbaseWs.send(JSON.stringify(unsubscribeMarketTrades));

            const unsubscribeHeartbeat = {
                type: "unsubscribe",
                channel: "heartbeats"
            };
            coinbaseWs.send(JSON.stringify(unsubscribeHeartbeat));
            
            isSubscribed = false;
            coinbaseWs.close();
        }
    });

    ws.on('close', () => {
        console.log('User WebSocket client disconnected.');
        if (isSubscribed) {
            coinbaseWs.close();
        }
    });
}); 