import { MutableSortedTreeMap } from '../lib/MutableSortedTreeMap.js';
import { Order, BookType } from '../lib/Order.js';
import { OrderPriceTimePriorityTree } from '../lib/OrderPriceTimePriorityTree.js';
import { OrderBook } from '../lib/OrderBook.js';
import { World } from '../lib/World.js';
import { PubSub } from '../lib/PubSub.js';
import { L2OrderBook } from '../lib/L2OrderBook.js';
import { L2PaperWorld } from '../lib/L2PaperWorld.js';
import { OrderBookDisplay } from '../lib/OrderBookDisplay.js';
import { BarChartDisplay } from '../lib/BarChartDisplay.js';
import { DisplayManager } from '../lib/DisplayManager.js';
import { readFileSync } from 'fs';

// Initialize the core components
const l2OrderFeed = new PubSub();
const paperOrderFeed = new PubSub();
const l2OrderBook = new L2OrderBook(l2OrderFeed);
const slowWorld = new L2PaperWorld(l2OrderBook, paperOrderFeed);
const fastWorld = new L2PaperWorld(l2OrderBook, paperOrderFeed);

// Function to process a single message
function processMessage(message) {
    if (message.type === 'l2_data') {
        const event = message.data;
        if (event.events && event.events[0] && event.events[0].updates) {
            event.events[0].updates.forEach(update => {
                const order = new Order('limit',
                    "L2" + (update.side === 'bid' ? 'B' : 'S') + "-" + update.price_level,
                    update.side === 'bid' ? 'B' : 'S',
                    parseFloat(update.price_level),
                    parseFloat(update.new_quantity),
                    update.timestamp || event.timestamp,
                    BookType.L2
                );
                l2OrderFeed.publish(order);
            });
        }
    }
}

function outputCsv(message) {
    // Get first bid and ask
    const firstBid = l2OrderBook.bids[Symbol.iterator]().next().value;
    const firstAsk = l2OrderBook.asks[Symbol.iterator]().next().value;
    
    // Skip to 10th bid and ask
    let tenthBid = null;
    let tenthAsk = null;
    
    const bidsIterator = l2OrderBook.bids[Symbol.iterator]();
    const asksIterator = l2OrderBook.asks[Symbol.iterator]();
    
    // Skip first 9 bids and asks
    for (let i = 0; i < 9; i++) {
        bidsIterator.next();
        asksIterator.next();
    }
    
    // Get 10th bid and ask
    tenthBid = bidsIterator.next().value;
    tenthAsk = asksIterator.next().value;
    
    const csvLine = `${message.sequence_num},` +
        `${firstBid?.price || 0},` +
        `${firstBid?.quantity || 0},` +
        `${firstAsk?.price || 0},` +
        `${firstAsk?.quantity || 0},` +
        `${tenthBid?.price || 0},` +
        `${tenthBid?.quantity || 0},` +
        `${tenthAsk?.price || 0},` +
        `${tenthAsk?.quantity || 0},` +
        `${l2OrderBook.bids.orders.size},` +
        `${l2OrderBook.asks.orders.size}`;
    
    console.log(csvLine);
}

// Read and process the JSON file
try {
    const data = JSON.parse(readFileSync('./test/cb.advanced.l2.10s.json', 'utf8'));
    console.log(`Processing ${data.length} messages...`);
    
    // Process all messages immediately without delay
    data.forEach(message => {
        processMessage({ type: 'l2_data', data: message });
        outputCsv(message);
    });
} catch (error) {
    console.error('Error loading or processing JSON file:', error);
} 