export class PubSub {
    constructor() {
      this.subscribers = new Set();
    }
  
    subscribe(callback) {
      this.subscribers.add(callback);
      return () => this.subscribers.delete(callback); // return unsubscribe fn
    }
  
    publish(data) {
      for (const callback of this.subscribers) {
        callback(data);
      }
    }
  }