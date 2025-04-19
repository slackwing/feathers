export class MutableSortedTreeMap {
    constructor(comparator) {
        this.map = new Map(); // For O(1) lookups
        this.comparator = comparator;
        this.root = null;
    }

    set(key, value) {
        const oldValue = this.map.get(key);
        if (oldValue !== undefined) {
            this.root = this._removeFromTree(this.root, { key, value: oldValue });
        }
        this.map.set(key, value);
        this.root = this._insertIntoTree(this.root, { key, value });
    }

    get(key) {
        return this.map.get(key);
    }

    remove(key) {
        const value = this.map.get(key);
        if (value !== undefined) {
            this.map.delete(key);
            this.root = this._removeFromTree(this.root, { key, value });
        }
    }

    _insertIntoTree(node, { key, value }) {
        if (!node) {
            return { key, value, left: null, right: null };
        }

        if (this.comparator(value, node.value) < 0) {
            node.left = this._insertIntoTree(node.left, { key, value });
        } else {
            node.right = this._insertIntoTree(node.right, { key, value });
        }

        return this._balance(node);
    }

    _removeFromTree(node, { key, value }) {
        if (!node) return null;

        if (key === node.key) {
            if (!node.left) return node.right;
            if (!node.right) return node.left;

            const successor = this._findMin(node.right);
            node.key = successor.key;
            node.value = successor.value;
            node.right = this._removeFromTree(node.right, successor);
        } else if (this.comparator(value, node.value) < 0) {
            node.left = this._removeFromTree(node.left, { key, value });
        } else {
            node.right = this._removeFromTree(node.right, { key, value });
        }

        return this._balance(node);
    }

    _findMin(node) {
        while (node.left) node = node.left;
        return node;
    }

    _balance(node) {
        const balance = this._getBalance(node);
        
        if (balance > 1) {
            if (this._getBalance(node.left) < 0) {
                node.left = this._rotateLeft(node.left);
            }
            return this._rotateRight(node);
        }
        
        if (balance < -1) {
            if (this._getBalance(node.right) > 0) {
                node.right = this._rotateRight(node.right);
            }
            return this._rotateLeft(node);
        }
        
        return node;
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

    *[Symbol.iterator]() {
        function* inorder(node) {
            if (node) {
                yield* inorder(node.left);
                yield [node.key, node.value];
                yield* inorder(node.right);
            }
        }
        yield* inorder(this.root);
    }
} 