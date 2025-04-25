import { Order, BookType } from './Order.js';

export class WebSocketHandler {
    constructor(l2OrderFeed, paperOrderFeed, onStatusUpdate) {
        this.l2OrderFeed = l2OrderFeed;
        this.paperOrderFeed = paperOrderFeed;
        this.onStatusUpdate = onStatusUpdate;
        this.messageCounter = 0;
    }

    handleMessage(event) {
        const message = JSON.parse(event.data);
        
        if (message.type === 'l2_data') {
            const event = message.data.events[0];

            // Handle snapshots and update equivalently.
            event.updates.forEach(update => {
                const price = parseFloat(update.price_level);
                const quantity = parseFloat(update.new_quantity);
                const side = update.side === 'bid' ? 'B' : 'S';
                const priceStr = price.toLocaleString('fullwide', {useGrouping: false});
                const id = "L2" + side + "-" + priceStr;

                const order = new Order('limit', id, side, price, quantity, update.timestamp, BookType.L2);
                this.l2OrderFeed.publish(order);
            });
        }
    }

    handleOpen() {
        this.onStatusUpdate('Connected.', '#d4edda');
    }

    handleClose() {
        this.onStatusUpdate('Disconnected.', '#f8d7da');
    }

    handleError(error) {
        this.onStatusUpdate('Error: ' + error.message, '#f8d7da');
    }
} 