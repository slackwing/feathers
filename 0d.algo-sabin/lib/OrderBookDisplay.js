export class OrderBookDisplay {
    constructor(bidsContainer, asksContainer) {
        this.bidsContainer = bidsContainer;
        this.asksContainer = asksContainer;
    }

    update(world) {
        let bidsHtml = '';
        let asksHtml = '';
        let count = 0;
    
        for (const order of world.book.bids) {
            if (count >= 100) break;
            const isPaperOrder = order.book_type === 'PAPER';
            bidsHtml += `
            <div class="order-row">
                <span class="price">$${order.price.toFixed(2)}</span>
                <span class="quantity">
                    ${isPaperOrder ? `<span style="color: #28a745">${order.quantity.toFixed(8)}</span>` : order.quantity.toFixed(8)}
                </span>
            </div>`;
            count++;
        }
        
        count = 0;
        for (const order of world.book.asks) {
            if (count >= 100) break;
            const isPaperOrder = order.book_type === 'PAPER';
            asksHtml += `
            <div class="order-row">
                <span class="price">$${order.price.toFixed(2)}</span>
                <span class="quantity">
                    ${isPaperOrder ? `<span style="color: #dc3545">${order.quantity.toFixed(8)}</span>` : order.quantity.toFixed(8)}
                </span>
            </div>`;
            count++;
        }
        
        this.bidsContainer.innerHTML = bidsHtml;
        this.asksContainer.innerHTML = asksHtml;
    }
} 