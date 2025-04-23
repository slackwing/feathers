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
            iterator: 0,
            mapOp: 0,
            treeOp: 0,
            compare: 0,
            heightCalc: 0,
            balanceCheck: 0
        };
    }

    set(key, value) {
        // const start = performance.now();
        if (this.map.has(key)) {
            // const mapStart = performance.now();
            this.map.set(key, value);
            // this.timings.mapOp += performance.now() - mapStart;
            // const treeStart = performance.now();
            this._updateValueInTree(key, value);
            // this.timings.treeOp += performance.now() - treeStart;
        } else {
            // const mapStart = performance.now();
            this.map.set(key, value);
            // this.timings.mapOp += performance.now() - mapStart;
            // const treeStart = performance.now();
            this.root = this._insertIntoTree(this.root, { key, value });
            // this.timings.treeOp += performance.now() - treeStart;
        }
        // this.timings.set += performance.now() - start;
    }

    _updateNodeValue(node, key, value) {
        if (!node) return;
        
        if (key === node.key) {
            node.value = value;
        } else if (this.comparator(value, node.value) < 0) {
            this._updateNodeValue(node.left, key, value);
        } else {
            this._updateNodeValue(node.right, key, value);
        }
    }

    get(key) {
        // const start = performance.now();
        const result = this.map.get(key);
        // this.timings.get += performance.now() - start;
        return result;
    }

    remove(key) {
        // const start = performance.now();
        if (!this.map.has(key)) {
            // this.timings.remove += performance.now() - start;
            return false;
        }
        // const mapStart = performance.now();
        this.map.delete(key);
        // this.timings.mapOp += performance.now() - mapStart;
        // const treeStart = performance.now();
        this.root = this._removeFromTree(this.root, key);
        // this.timings.treeOp += performance.now() - treeStart;
        // this.timings.remove += performance.now() - start;
        return true;
    }

    _insertIntoTree(node, { key, value }) {
        // const start = performance.now();
        if (!node) {
            // this.timings.insert += performance.now() - start;
            return { key, value, left: null, right: null, height: 1 };
        }

        // Cache the comparison result to avoid multiple comparisons
        // const compareStart = performance.now();
        const cmp = this.comparator(value, node.value);
        // this.timings.compare += performance.now() - compareStart;

        let heightChanged = false;
        let oldHeight = node.height;
        let result = node;

        if (cmp < 0) {
            node.left = this._insertIntoTree(node.left, { key, value });
            if (node.left.height > (node.left.left ? node.left.left.height : 0)) {
                heightChanged = true;
            }
        } else {
            node.right = this._insertIntoTree(node.right, { key, value });
            if (node.right.height > (node.right.right ? node.right.right.height : 0)) {
                heightChanged = true;
            }
        }

        // Only update height and balance if necessary
        if (heightChanged) {
            // const heightStart = performance.now();
            node.height = 1 + Math.max(
                node.left ? node.left.height : 0,
                node.right ? node.right.height : 0
            );
            // this.timings.heightCalc += performance.now() - heightStart;

            // Only balance if height actually changed
            if (node.height !== oldHeight) {
                // const balanceStart = performance.now();
                const balance = this._getBalance(node);
                if (Math.abs(balance) > 1) {
                    result = this._balance(node);
                }
                // this.timings.balanceCheck += performance.now() - balanceStart;
            }
        }

        // this.timings.insert += performance.now() - start;
        return result;
    }

    _findNode(root, key) {
        if (!root) return null;
        if (root.key === key) return root;
        const left = this._findNode(root.left, key);
        if (left) return left;
        return this._findNode(root.right, key);
    }

    _removeFromTree(node, key) {
        // const start = performance.now();
        if (!node) {
            // this.timings.removeFromTree += performance.now() - start;
            return null;
        }

        if (key === node.key) {
            if (!node.left) {
                // this.timings.removeFromTree += performance.now() - start;
                return node.right;
            }
            if (!node.right) {
                // this.timings.removeFromTree += performance.now() - start;
                return node.left;
            }

            const minNode = this._findMin(node.right);
            node.key = minNode.key;
            node.value = minNode.value;
            node.right = this._removeFromTree(node.right, minNode.key);
        } else if (key < node.key) {
            node.left = this._removeFromTree(node.left, key);
        } else {
            node.right = this._removeFromTree(node.right, key);
        }

        // Update height and balance
        // const heightStart = performance.now();
        node.height = 1 + Math.max(
            node.left ? node.left.height : 0,
            node.right ? node.right.height : 0
        );
        // this.timings.heightCalc += performance.now() - heightStart;

        // const balanceStart = performance.now();
        const balance = this._getBalance(node);
        if (Math.abs(balance) > 1) {
            node = this._balance(node);
        }
        // this.timings.balanceCheck += performance.now() - balanceStart;

        // this.timings.removeFromTree += performance.now() - start;
        return node;
    }

    _findMin(node) {
        // const start = performance.now();
        while (node.left) {
            node = node.left;
        }
        // this.timings.findMin += performance.now() - start;
        return node;
    }

    _balance(node) {
        // const start = performance.now();
        const balance = this._getBalance(node);
        
        let result;
        if (balance > 1) {
            // Left heavy
            const leftBalance = this._getBalance(node.left);
            if (leftBalance < 0) {
                // Left-Right case - do both rotations at once
                const x = node.left;
                const y = x.right;
                const T2 = y.left;
                const T3 = y.right;
                
                // First rotation
                y.left = x;
                x.right = T2;
                
                // Second rotation
                y.right = node;
                node.left = T3;
                
                // Update heights
                x.height = 1 + Math.max(
                    x.left ? x.left.height : 0,
                    x.right ? x.right.height : 0
                );
                node.height = 1 + Math.max(
                    node.left ? node.left.height : 0,
                    node.right ? node.right.height : 0
                );
                y.height = 1 + Math.max(x.height, node.height);
                
                result = y;
            } else {
                result = this._rotateRight(node);
            }
        } else if (balance < -1) {
            // Right heavy
            const rightBalance = this._getBalance(node.right);
            if (rightBalance > 0) {
                // Right-Left case - do both rotations at once
                const x = node.right;
                const y = x.left;
                const T2 = y.right;
                const T3 = y.left;
                
                // First rotation
                y.right = x;
                x.left = T2;
                
                // Second rotation
                y.left = node;
                node.right = T3;
                
                // Update heights
                x.height = 1 + Math.max(
                    x.left ? x.left.height : 0,
                    x.right ? x.right.height : 0
                );
                node.height = 1 + Math.max(
                    node.left ? node.left.height : 0,
                    node.right ? node.right.height : 0
                );
                y.height = 1 + Math.max(x.height, node.height);
                
                result = y;
            } else {
                result = this._rotateLeft(node);
            }
        } else {
            result = node;
        }
        
        // this.timings.balance += performance.now() - start;
        return result;
    }

    _getBalance(node) {
        // const start = performance.now();
        const result = (node.left ? node.left.height : 0) - (node.right ? node.right.height : 0);
        // this.timings.balanceCheck += performance.now() - start;
        return result;
    }

    _getHeight(node) {
        if (!node) return 0;
        return 1 + Math.max(this._getHeight(node.left), this._getHeight(node.right));
    }

    _rotateRight(y) {
        // const start = performance.now();
        const x = y.left;
        const T2 = x.right;

        x.right = y;
        y.left = T2;

        y.height = 1 + Math.max(
            y.left ? y.left.height : 0,
            y.right ? y.right.height : 0
        );
        x.height = 1 + Math.max(
            x.left ? x.left.height : 0,
            x.right ? x.right.height : 0
        );

        // this.timings.balance += performance.now() - start;
        return x;
    }

    _rotateLeft(x) {
        // const start = performance.now();
        const y = x.right;
        const T2 = y.left;

        y.left = x;
        x.right = T2;

        x.height = 1 + Math.max(
            x.left ? x.left.height : 0,
            x.right ? x.right.height : 0
        );
        y.height = 1 + Math.max(
            y.left ? y.left.height : 0,
            y.right ? y.right.height : 0
        );

        // this.timings.balance += performance.now() - start;
        return y;
    }

    _updateValueInTree(key, value) {
        // const start = performance.now();
        const node = this._findNode(this.root, key);
        if (node) {
            node.value = value;
        }
        // this.timings.updateValue += performance.now() - start;
    }

    [Symbol.iterator]() {
        // const start = performance.now();
        const iterator = this.map[Symbol.iterator]();
        const result = {
            next() {
                const next = iterator.next();
                if (next.done) {
                    return { done: true };
                }
                const [key, value] = next.value;
                return { value: [key, value], done: false };
            }
        };
        // this.timings.iterator += performance.now() - start;
        return result;
    }

    getTimings() {
        return this.timings;
    }

    resetTimings() {
        this.timings = {
            set: 0,
            get: 0,
            remove: 0,
            insert: 0,
            removeFromTree: 0,
            balance: 0,
            iterator: 0,
            mapOp: 0,
            treeOp: 0,
            compare: 0,
            heightCalc: 0,
            balanceCheck: 0
        };
    }
} 