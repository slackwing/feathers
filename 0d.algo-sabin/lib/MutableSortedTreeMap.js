export class MutableSortedTreeMap {
    constructor(comparator) {
        this.map = new Map(); // For O(1) lookups
        this.nodeMap = new Map(); // For O(1) node access
        this.comparator = comparator;
        this.root = null;
        this.size = 0; // Track size explicitly
    }

    set(key, value) {
        if (this.map.has(key)) {
            this.map.set(key, value);
            this._updateValueInTree(key, value);
        } else {
            this.map.set(key, value);
            const node = this._insertIntoTree(this.root, { key, value });
            this.root = node;
            this.nodeMap.set(key, node);
            this.size++; // Increment size when adding a new key
        }
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
        return this.map.get(key);
    }

    remove(key) {
        if (!this.map.has(key)) {
            return false;
        }
        const value = this.map.get(key);
        this.map.delete(key);
        this.nodeMap.delete(key);
        this.root = this._removeNode(this.root, key, value);
        this.size--; // Decrement size when removing a key
        return true;
    }

    _removeNode(node, key, value) {
        if (!node) return null;

        const cmp = key === node.key ? 0 : this.comparator(value, node.value);
        
        if (cmp < 0) {
            node.left = this._removeNode(node.left, key, value);
        } else if (cmp > 0) {
            node.right = this._removeNode(node.right, key, value);
        } else {
            // Node to delete found
            if (!node.left) return node.right;
            if (!node.right) return node.left;

            // Node has two children
            const minNode = this._findMin(node.right);
            node.key = minNode.key;
            node.value = minNode.value;
            node.right = this._removeNode(node.right, minNode.key, minNode.value);
        }

        // Update height and rebalance
        node.height = 1 + Math.max(
            node.left ? node.left.height : 0,
            node.right ? node.right.height : 0
        );

        const balance = this._getBalance(node);
        if (Math.abs(balance) > 1) {
            return this._balance(node);
        }

        return node;
    }

    _insertIntoTree(node, { key, value }, parent = null) {
        if (!node) {
            return { key, value, left: null, right: null, height: 1, parent };
        }

        // Cache the comparison result to avoid multiple comparisons
        const cmp = key === node.key ? 0 : this.comparator(value, node.value);

        let heightChanged = false;
        let oldHeight = node.height;
        let result = node;

        if (cmp < 0) {
            node.left = this._insertIntoTree(node.left, { key, value }, node);
            if (node.left.height > (node.left.left ? node.left.left.height : 0)) {
                heightChanged = true;
            }
        } else {
            node.right = this._insertIntoTree(node.right, { key, value }, node);
            if (node.right.height > (node.right.right ? node.right.right.height : 0)) {
                heightChanged = true;
            }
        }

        // Only update height and balance if necessary
        if (heightChanged) {
            node.height = 1 + Math.max(
                node.left ? node.left.height : 0,
                node.right ? node.right.height : 0
            );

            // Only balance if height actually changed
            if (node.height !== oldHeight) {
                const balance = this._getBalance(node);
                if (Math.abs(balance) > 1) {
                    result = this._balance(node);
                }
            }
        }

        return result;
    }

    _findNode(root, key) {
        if (!root) return null;
        if (root.key === key) return root;
        const left = this._findNode(root.left, key);
        if (left) return left;
        return this._findNode(root.right, key);
    }

    _findMin(node) {
        while (node.left) {
            node = node.left;
        }
        return node;
    }

    _balance(node) {
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
                
                // Update parent pointers
                y.parent = node.parent;
                x.parent = y;
                node.parent = y;
                if (T2) T2.parent = x;
                if (T3) T3.parent = node;
                
                // Update nodeMap
                this.nodeMap.set(y.key, y);
                this.nodeMap.set(x.key, x);
                this.nodeMap.set(node.key, node);
                if (T2) this.nodeMap.set(T2.key, T2);
                if (T3) this.nodeMap.set(T3.key, T3);
                
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
                
                // Update parent pointers
                y.parent = node.parent;
                x.parent = y;
                node.parent = y;
                if (T2) T2.parent = x;
                if (T3) T3.parent = node;
                
                // Update nodeMap
                this.nodeMap.set(y.key, y);
                this.nodeMap.set(x.key, x);
                this.nodeMap.set(node.key, node);
                if (T2) this.nodeMap.set(T2.key, T2);
                if (T3) this.nodeMap.set(T3.key, T3);
                
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
        
        return result;
    }

    _getBalance(node) {
        return (node.left ? node.left.height : 0) - (node.right ? node.right.height : 0);
    }

    _getHeight(node) {
        if (!node) return 0;
        return 1 + Math.max(this._getHeight(node.left), this._getHeight(node.right));
    }

    _rotateRight(y) {
        const x = y.left;
        const T2 = x.right;

        // Update parent pointers
        x.parent = y.parent;
        y.parent = x;
        if (T2) T2.parent = y;

        // Update nodeMap
        this.nodeMap.set(x.key, x);
        this.nodeMap.set(y.key, y);
        if (T2) this.nodeMap.set(T2.key, T2);

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

        return x;
    }

    _rotateLeft(x) {
        const y = x.right;
        const T2 = y.left;

        // Update parent pointers
        y.parent = x.parent;
        x.parent = y;
        if (T2) T2.parent = x;

        // Update nodeMap
        this.nodeMap.set(y.key, y);
        this.nodeMap.set(x.key, x);
        if (T2) this.nodeMap.set(T2.key, T2);

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

        return y;
    }

    _updateValueInTree(key, value) {
        // Remove and reinsert to maintain order
        this.remove(key);
        this.set(key, value);
    }

    _inorderTraversal(node, result = []) {
        if (node) {
            this._inorderTraversal(node.left, result);
            result.push([node.key, node.value]);
            this._inorderTraversal(node.right, result);
        }
        return result;
    }

    [Symbol.iterator]() {
        const values = this._inorderTraversal(this.root);
        let index = 0;
        
        return {
            next() {
                if (index >= values.length) {
                    return { done: true };
                }
                return { value: values[index++], done: false };
            }
        };
    }
} 