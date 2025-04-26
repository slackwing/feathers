export class MutableSortedTreeMap {
    constructor(comparator) {
        this.map = new Map(); // For O(1) lookups
        this.nodeMap = new Map(); // For O(1) node access
        this.comparator = comparator;
        this.root = null;
    }

    get size() {
        return this.map.size;
    }

    set(key, value) {
        if (this.map.has(key)) {
            this.map.set(key, value);
            this._updateValueInTree(key, value);
        } else {
            this.map.set(key, value);
            this.root = this._insertIntoTree(this.root, { key, value });
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
        const removed = this._removeNodeOptimized(key);
        if (removed) this.nodeMap.delete(key);
        return removed;
    }

    _removeNodeOptimized(key) {
        if (!this.nodeMap.has(key)) return false;
        const nodeToRemove = this.nodeMap.get(key);
        const parent = nodeToRemove.parent;
        if (nodeToRemove.left && nodeToRemove.right) {
            // If the node has 2 children, we're going to keep this node
            // and move a different node's value into it. So we don't
            // need to update its parent's pointer.
            const minRightNode = this._findMin(nodeToRemove.right);
            const minRightNodeParent = minRightNode.parent;
            
            // Special case: minRightNode is the right child of nodeToRemove
            if (minRightNodeParent === nodeToRemove) {
                nodeToRemove.right = minRightNode.right;
                if (minRightNode.right) {
                    minRightNode.right.parent = nodeToRemove;
                }
            } else {
                minRightNodeParent.left = minRightNode.right;
                if (minRightNode.right) {
                    minRightNode.right.parent = minRightNodeParent;
                }
            }
            
            nodeToRemove.key = minRightNode.key;
            nodeToRemove.value = minRightNode.value;
            this.nodeMap.set(minRightNode.key, nodeToRemove);
            
            // Update height
            this._updateHeight(nodeToRemove);
        } else {
            if (!parent) {
                if (!nodeToRemove.left && !nodeToRemove.right) {
                    this.root = null;
                } else if (!nodeToRemove.left) {
                    this.root = nodeToRemove.right;
                    nodeToRemove.right.parent = null;
                    this._updateHeight(this.root);
                } else if (!nodeToRemove.right) {
                    this.root = nodeToRemove.left;
                    nodeToRemove.left.parent = null;
                    this._updateHeight(this.root);
                }
            } else if (parent.left === nodeToRemove) {
                if (!nodeToRemove.left && !nodeToRemove.right) {
                    parent.left = null;
                } else if (!nodeToRemove.left) {
                    parent.left = nodeToRemove.right;
                    nodeToRemove.right.parent = parent;
                } else if (!nodeToRemove.right) {
                    parent.left = nodeToRemove.left;
                    nodeToRemove.left.parent = parent;
                }
                this._updateHeight(parent);
            } else if (parent.right === nodeToRemove) {
                if (!nodeToRemove.left && !nodeToRemove.right) {
                    parent.right = null;
                } else if (!nodeToRemove.left) {
                    parent.right = nodeToRemove.right;
                    nodeToRemove.right.parent = parent;
                } else if (!nodeToRemove.right) {
                    parent.right = nodeToRemove.left;
                    nodeToRemove.left.parent = parent;
                }
                this._updateHeight(parent);
            }
            this.nodeMap.delete(key);
        }
        return true;
    }

    _updateHeight(node) {
        if (!node) return;
        node.height = 1 + Math.max(
            node.left ? node.left.height : 0,
            node.right ? node.right.height : 0
        );
        
        // Check balance and rebalance if needed
        const balance = this._getBalance(node);
        if (Math.abs(balance) > 1) {
            // Use _balance instead of _rebalanceAfterRemoval
            const newRoot = this._balance(node);
            
            // Update root if necessary
            if (node === this.root) {
                this.root = newRoot;
            }
        }
    }

    _insertIntoTree(node, { key, value }, parent = null) {
        if (!node) {
            const newNode = { key, value, left: null, right: null, height: 1, parent };
            this.nodeMap.set(key, newNode);
            return newNode;
        }

        let oldHeight = node.height;
        let result = node;

        if (node.key === key ? 0 : this.comparator(value, node.value) < 0) {
            const oldLeftHeight = node.left ? node.left.height : 0;
            node.left = this._insertIntoTree(node.left, { key, value }, node);
            if (node.left.height > oldLeftHeight) {
                node.height = 1 + Math.max(node.left.height, node.right ? node.right.height : 0);
                const balance = this._getBalance(node);
                if (Math.abs(balance) > 1) {
                    result = this._balance(node);
                }
            }
        } else {
            const oldRightHeight = node.right ? node.right.height : 0;
            node.right = this._insertIntoTree(node.right, { key, value }, node);
            if (node.right.height > oldRightHeight) {
                node.height = 1 + Math.max(node.left ? node.left.height : 0, node.right.height);
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