import { MutableSortedTreeMap } from './lib/MutableSortedTreeMap.js';
import { Order, BookType } from './lib/Order.js';
import { OrderPriceTimePriorityTree } from './lib/OrderPriceTimePriorityTree.js';
import { OrderBook } from './lib/OrderBook.js';
import { World } from './lib/World.js';
import { PubSub } from './lib/PubSub.js';
import { L2OrderBook } from './lib/L2OrderBook.js';
import { L2PaperWorld } from './lib/L2PaperWorld.js';
import { OrderBookDisplay } from './lib/OrderBookDisplay.js';
import { BarChartDisplay } from './lib/BarChartDisplay.js';
import { DisplayManager } from './lib/DisplayManager.js';

// Initialize the core components
const l2OrderFeed = new PubSub();
const paperOrderFeed = new PubSub();
const l2OrderBook = new L2OrderBook(l2OrderFeed);
const slowWorld = new L2PaperWorld(l2OrderBook, paperOrderFeed);
const fastWorld = new L2PaperWorld(l2OrderBook, paperOrderFeed);

// Initialize display components
const orderBookDisplay = new OrderBookDisplay(document.getElementById('bids'), document.getElementById('asks'));
const barChartDisplay = new BarChartDisplay(
    document.getElementById('bids-bars'), 
    document.getElementById('asks-bars'),
    document.getElementById('spread-label')
);
const displayManager = new DisplayManager(orderBookDisplay, barChartDisplay);

// Function to process a single message
function processMessage(message) {
    if (message.type === 'l2_data') {
        l2OrderFeed.publish(message.data);
    }
}

// Function to update display
function updateDisplay() {
    displayManager.update(slowWorld);
}

// Read and process the JSON file
fetch('cb.advanced.l2.10s.json')
    .then(response => response.json())
    .then(data => {
        console.log(`Processing ${data.length} messages...`);
        
        // Process each message with a small delay to simulate real-time
        data.forEach((message, index) => {
            setTimeout(() => {
                processMessage({ type: 'l2_data', data: message });
                updateDisplay();
            }, index * 100); // Process one message every 100ms
        });
    })
    .catch(error => {
        console.error('Error loading or processing JSON file:', error);
    }); 