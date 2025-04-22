export class MutableSortedTreeMap {
    constructor(comparator) {
        this.map = new Map(); // For O(1) lookups
        this.comparator = comparator;
        this.root = null;
        this.size = 0; // Track size explicitly
        this.timings = {
            set: 0,
            get: 0,
            remove: 0,
            insert: 0,
            removeFromTree: 0,
            balance: 0,
            iterator: 0
        };
    }

    set(key, value) {
        const start = performance.now();
        const oldValue = this.map.get(key);
        if (oldValue !== undefined) {
            this.root = this._removeFromTree(this.root, { key, value: oldValue });
        } else {
            this.size++; // Increment size only for new entries
        }
        this.map.set(key, value);
        this.root = this._insertIntoTree(this.root, { key, value });
        this.timings.set += performance.now() - start;
    }

    get(key) {
        const start = performance.now();
        const result = this.map.get(key);
        this.timings.get += performance.now() - start;
        return result;
    }

    remove(key) {
        const start = performance.now();
        const value = this.map.get(key);
        if (value !== undefined) {
            this.map.delete(key);
            this.root = this._removeFromTree(this.root, { key, value });
            this.size--; // Decrement size when removing
        }
        this.timings.remove += performance.now() - start;
    }

    _insertIntoTree(node, { key, value }) {
        const start = performance.now();
        if (!node) {
            this.timings.insert += performance.now() - start;
            return { key, value, left: null, right: null };
        }

        if (this.comparator(value, node.value) < 0) {
            node.left = this._insertIntoTree(node.left, { key, value });
        } else {
            node.right = this._insertIntoTree(node.right, { key, value });
        }

        const result = this._balance(node);
        this.timings.insert += performance.now() - start;
        return result;
    }

    _removeFromTree(node, { key, value }) {
        const start = performance.now();
        if (!node) {
            this.timings.removeFromTree += performance.now() - start;
            return null;
        }

        if (key === node.key) {
            if (!node.left) {
                this.timings.removeFromTree += performance.now() - start;
                return node.right;
            }
            if (!node.right) {
                this.timings.removeFromTree += performance.now() - start;
                return node.left;
            }

            const successor = this._findMin(node.right);
            node.key = successor.key;
            node.value = successor.value;
            node.right = this._removeFromTree(node.right, successor);
        } else if (this.comparator(value, node.value) < 0) {
            node.left = this._removeFromTree(node.left, { key, value });
        } else {
            node.right = this._removeFromTree(node.right, { key, value });
        }

        const result = this._balance(node);
        this.timings.removeFromTree += performance.now() - start;
        return result;
    }

    _findMin(node) {
        while (node.left) node = node.left;
        return node;
    }

    _balance(node) {
        const start = performance.now();
        const balance = this._getBalance(node);
        
        let result;
        if (balance > 1) {
            if (this._getBalance(node.left) < 0) {
                node.left = this._rotateLeft(node.left);
            }
            result = this._rotateRight(node);
        } else if (balance < -1) {
            if (this._getBalance(node.right) > 0) {
                node.right = this._rotateRight(node.right);
            }
            result = this._rotateLeft(node);
        } else {
            result = node;
        }
        
        this.timings.balance += performance.now() - start;
        return result;
    }

    _getBalance(node) {
        return this._getHeight(node.left) - this._getHeight(node.right);
    }

    _getHeight(node) {
        if (!node) return 0;
        return 1 + Math.max(this._getHeight(node.left), this._getHeight(node.right));
    }

    _rotateRight(y) {
        const x = y.left;
        const T2 = x.right;
        x.right = y;
        y.left = T2;
        return x;
    }

    _rotateLeft(x) {
        const y = x.right;
        const T2 = y.left;
        y.left = x;
        x.right = T2;
        return y;
    }

    [Symbol.iterator]() {
        const start = performance.now();
        const result = [];
        if (!this.root) {
            this.timings.iterator += performance.now() - start;
            return result[Symbol.iterator]();
        }
        
        // Use a dynamic array for the stack
        const stack = [];
        let current = this.root;
        
        // Traverse to the leftmost node
        while (current) {
            stack.push(current);
            current = current.left;
        }
        
        // Process nodes in-order
        while (stack.length > 0) {
            current = stack.pop();
            if (current && current.key && current.value) {
                result.push([current.key, current.value]);
            }
            
            // Process right subtree
            current = current.right;
            while (current) {
                stack.push(current);
                current = current.left;
            }
        }
        
        this.timings.iterator += performance.now() - start;
        return result[Symbol.iterator]();
    }

    getTimings() {
        return this.timings;
    }
} 