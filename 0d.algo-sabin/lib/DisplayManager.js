export class DisplayManager {
    constructor(orderBookDisplay, barChartDisplay) {
        this.orderBookDisplay = orderBookDisplay;
        this.barChartDisplay = barChartDisplay;
    }

    update(world) {
        this.orderBookDisplay.update(world);
        this.barChartDisplay.update(world);
    }
} 