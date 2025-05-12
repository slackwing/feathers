type Node<T> = {
  key: string;
  value: T;
  left: Node<T> | null;
  right: Node<T> | null;
  height: number;
  parent: Node<T> | null;
};

export class MutableSortedTreeMap<T> implements Iterable<[string, T]> {
  private map: Map<string, T>; // TODO(P1): Replace with nodeMap.
  private nodeMap: Map<string, Node<T>>;
  private comparator: (a: T, b: T) => number;
  private root: Node<T> | null;

  constructor(comparator?: (a: T, b: T) => number) {
    this.map = new Map();
    this.nodeMap = new Map();
    this.comparator =
      comparator ??
      ((a: T, b: T) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });
    this.root = null;
  }

  get size(): number {
    return this.map.size;
  }

  public set(key: string, value: T): void {
    if (this.map.has(key)) {
      this.map.set(key, value);
      this._updateValueInTree(key, value);
    } else {
      this.map.set(key, value);
      this.root = this._insertIntoTree(this.root, { key, value });
    }
  }

  private _updateNodeValue(node: Node<T> | null, key: string, value: T): void {
    if (!node) return;

    if (key === node.key) {
      node.value = value;
    } else if (this.comparator(value, node.value) < 0) {
      this._updateNodeValue(node.left, key, value);
    } else {
      this._updateNodeValue(node.right, key, value);
    }
  }

  public get(key: string): T | undefined {
    return this.map.get(key);
  }

  public remove(key: string): boolean {
    if (!this.map.has(key)) {
      return false;
    }
    const value = this.map.get(key)!;
    this.map.delete(key);
    const removed = this._removeNodeOptimized(key);
    if (removed) this.nodeMap.delete(key);
    return removed;
  }

  private _removeNodeOptimized(key: string): boolean {
    if (!this.nodeMap.has(key)) return false;
    const nodeToRemove = this.nodeMap.get(key)!;
    const parent = nodeToRemove.parent;
    if (nodeToRemove.left && nodeToRemove.right) {
      const minRightNode = this._findMin(nodeToRemove.right);
      const minRightNodeParent = minRightNode.parent;

      if (minRightNodeParent === nodeToRemove) {
        nodeToRemove.right = minRightNode.right;
        if (minRightNode.right) {
          minRightNode.right.parent = nodeToRemove;
        }
      } else {
        minRightNodeParent!.left = minRightNode.right;
        if (minRightNode.right) {
          minRightNode.right.parent = minRightNodeParent;
        }
      }

      nodeToRemove.key = minRightNode.key;
      nodeToRemove.value = minRightNode.value;
      this.nodeMap.set(minRightNode.key, nodeToRemove);

      this._updateHeight(nodeToRemove);
    } else {
      if (!parent) {
        if (!nodeToRemove.left && !nodeToRemove.right) {
          this.root = null;
        } else if (!nodeToRemove.left) {
          this.root = nodeToRemove.right;
          nodeToRemove.right!.parent = null;
          this._updateHeight(this.root);
        } else if (!nodeToRemove.right) {
          this.root = nodeToRemove.left;
          nodeToRemove.left!.parent = null;
          this._updateHeight(this.root);
        }
      } else if (parent.left === nodeToRemove) {
        if (!nodeToRemove.left && !nodeToRemove.right) {
          parent.left = null;
        } else if (!nodeToRemove.left) {
          parent.left = nodeToRemove.right;
          nodeToRemove.right!.parent = parent;
        } else if (!nodeToRemove.right) {
          parent.left = nodeToRemove.left;
          nodeToRemove.left!.parent = parent;
        }
        this._updateHeight(parent);
      } else if (parent.right === nodeToRemove) {
        if (!nodeToRemove.left && !nodeToRemove.right) {
          parent.right = null;
        } else if (!nodeToRemove.left) {
          parent.right = nodeToRemove.right;
          nodeToRemove.right!.parent = parent;
        } else if (!nodeToRemove.right) {
          parent.right = nodeToRemove.left;
          nodeToRemove.left!.parent = parent;
        }
        this._updateHeight(parent);
      }
      this.nodeMap.delete(key);
    }
    return true;
  }

  private _updateHeight(node: Node<T> | null): void {
    if (!node) return;
    node.height =
      1 +
      Math.max(
        node.left ? (node.left as Node<T>).height : 0,
        node.right ? (node.right as Node<T>).height : 0
      );

    const balance = this._getBalance(node);
    if (Math.abs(balance) > 1) {
      const newRoot = this._balance(node);
      if (node === this.root) {
        this.root = newRoot;
      }
    }
  }

  private _insertIntoTree(
    node: Node<T> | null,
    { key, value }: { key: string; value: T },
    parent: Node<T> | null = null
  ): Node<T> {
    if (!node) {
      const newNode: Node<T> = { key, value, left: null, right: null, height: 1, parent };
      this.nodeMap.set(key, newNode);
      return newNode;
    }

    let oldHeight = node.height;
    let result: Node<T> = node;

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

  private _findNode(root: Node<T> | null, key: string): Node<T> | null {
    if (!root) return null;
    if (root.key === key) return root;
    const left = this._findNode(root.left, key);
    if (left) return left;
    return this._findNode(root.right, key);
  }

  private _findMin(node: Node<T>): Node<T> {
    while (node.left) {
      node = node.left;
    }
    return node;
  }

  private _balance(node: Node<T>): Node<T> {
    const balance = this._getBalance(node);
    if (balance > 1) {
      const leftBalance = this._getBalance(node.left!);

      if (leftBalance < 0) {
        const leftChild = node.left!;
        const newLeftChild = leftChild.right!;
        const T2 = newLeftChild.left;
        const T3 = newLeftChild.right;

        newLeftChild.parent = node;
        leftChild.parent = newLeftChild;
        if (T2) T2.parent = leftChild;
        if (T3) T3.parent = node;

        this.nodeMap.set(newLeftChild.key, newLeftChild); // TODO(P1): Remove?
        this.nodeMap.set(leftChild.key, leftChild); // TODO(P1): Remove?
        if (T2) this.nodeMap.set(T2.key, T2); // TODO(P1): Remove?
        if (T3) this.nodeMap.set(T3.key, T3); // TODO(P1): Remove?

        newLeftChild.left = leftChild;
        leftChild.right = T2;
        newLeftChild.right = node;
        node.left = T3;

        leftChild.height =
          1 +
          Math.max(
            leftChild.left ? leftChild.left.height : 0,
            leftChild.right ? leftChild.right.height : 0
          );
        newLeftChild.height =
          1 +
          Math.max(
            newLeftChild.left ? newLeftChild.left.height : 0,
            newLeftChild.right ? newLeftChild.right.height : 0
          );

        const oldParent = node.parent;
        const isLeftChild = oldParent && oldParent.left === node;

        newLeftChild.parent = oldParent;
        node.parent = newLeftChild;

        this.nodeMap.set(newLeftChild.key, newLeftChild); // TODO(P1): Remove?
        this.nodeMap.set(node.key, node); // TODO(P1): Remove?

        node.height =
          1 +
          Math.max(
            node.left ? (node.left as Node<T>).height : 0,
            node.right ? (node.right as Node<T>).height : 0
          );
        newLeftChild.height =
          1 +
          Math.max(
            newLeftChild.left ? (newLeftChild.left as Node<T>).height : 0,
            newLeftChild.right ? (newLeftChild.right as Node<T>).height : 0
          );

        if (oldParent) {
          if (isLeftChild) {
            oldParent.left = newLeftChild;
          } else {
            oldParent.right = newLeftChild;
          }
        }

        return newLeftChild;
      } else {
        const oldParent = node.parent;
        const isLeftChild = oldParent && oldParent.left === node;
        const newRoot = this._rotateRight(node);

        if (oldParent) {
          if (isLeftChild) {
            oldParent.left = newRoot;
          } else {
            oldParent.right = newRoot;
          }
        }

        return newRoot;
      }
    } else if (balance < -1) {
      const rightBalance = this._getBalance(node.right!);

      if (rightBalance > 0) {
        const rightChild = node.right!;
        const newRightChild = rightChild.left!;
        const T2 = newRightChild.right;
        const T3 = newRightChild.left;

        newRightChild.parent = node;
        rightChild.parent = newRightChild;
        if (T2) T2.parent = rightChild;
        if (T3) T3.parent = node;

        this.nodeMap.set(newRightChild.key, newRightChild); // TODO(P1): Remove?
        this.nodeMap.set(rightChild.key, rightChild); // TODO(P1): Remove?
        if (T2) this.nodeMap.set(T2.key, T2); // TODO(P1): Remove?
        if (T3) this.nodeMap.set(T3.key, T3); // TODO(P1): Remove?

        newRightChild.right = rightChild;
        rightChild.left = T2;
        newRightChild.left = node;
        node.right = T3;

        rightChild.height =
          1 +
          Math.max(
            rightChild.left ? rightChild.left.height : 0,
            rightChild.right ? rightChild.right.height : 0
          );
        newRightChild.height =
          1 +
          Math.max(
            newRightChild.left ? newRightChild.left.height : 0,
            newRightChild.right ? newRightChild.right.height : 0
          );

        const oldParent = node.parent;
        const isLeftChild = oldParent && oldParent.left === node;

        newRightChild.parent = oldParent;
        node.parent = newRightChild;

        this.nodeMap.set(newRightChild.key, newRightChild); // TODO(P1): Remove?
        this.nodeMap.set(node.key, node); // TODO(P1): Remove?

        node.height =
          1 +
          Math.max(
            node.left ? (node.left as Node<T>).height : 0,
            node.right ? (node.right as Node<T>).height : 0
          );
        newRightChild.height =
          1 +
          Math.max(
            newRightChild.left ? (newRightChild.left as Node<T>).height : 0,
            newRightChild.right ? (newRightChild.right as Node<T>).height : 0
          );

        if (oldParent) {
          if (isLeftChild) {
            oldParent.left = newRightChild;
          } else {
            oldParent.right = newRightChild;
          }
        }

        return newRightChild;
      } else {
        const oldParent = node.parent;
        const isLeftChild = oldParent && oldParent.left === node;
        const newRoot = this._rotateLeft(node);

        if (oldParent) {
          if (isLeftChild) {
            oldParent.left = newRoot;
          } else {
            oldParent.right = newRoot;
          }
        }

        return newRoot;
      }
    }

    return node;
  }

  private _getBalance(node: Node<T>): number {
    return (node.left ? node.left.height : 0) - (node.right ? node.right.height : 0);
  }

  private _getHeight(node: Node<T> | null): number {
    if (!node) return 0;
    return 1 + Math.max(this._getHeight(node.left), this._getHeight(node.right));
  }

  private _rotateRight(y: Node<T>): Node<T> {
    const x = y.left!;
    const T2 = x.right;

    x.parent = y.parent;
    y.parent = x;
    if (T2) T2.parent = y;

    this.nodeMap.set(x.key, x);
    this.nodeMap.set(y.key, y);
    if (T2) this.nodeMap.set(T2.key, T2);

    x.right = y;
    y.left = T2;

    y.height = 1 + Math.max(y.left ? y.left.height : 0, y.right ? y.right.height : 0);
    x.height = 1 + Math.max(x.left ? x.left.height : 0, x.right ? x.right.height : 0);

    return x;
  }

  private _rotateLeft(x: Node<T>): Node<T> {
    const y = x.right!;
    const T2 = y.left;

    y.parent = x.parent;
    x.parent = y;
    if (T2) T2.parent = x;

    this.nodeMap.set(y.key, y);
    this.nodeMap.set(x.key, x);
    if (T2) this.nodeMap.set(T2.key, T2);

    y.left = x;
    x.right = T2;

    x.height = 1 + Math.max(x.left ? x.left.height : 0, x.right ? x.right.height : 0);
    y.height = 1 + Math.max(y.left ? y.left.height : 0, y.right ? y.right.height : 0);

    return y;
  }

  private _updateValueInTree(key: string, value: T): void {
    this.remove(key);
    this.set(key, value);
  }

  private _inorderTraversal(node: Node<T> | null, result: [string, T][] = []): [string, T][] {
    if (node) {
      this._inorderTraversal(node.left, result);
      result.push([node.key, node.value]);
      this._inorderTraversal(node.right, result);
    }
    return result;
  }

  private _printTree(node: Node<T> | null, depth = 0): string {
    if (!node) return '';
    const indent = '  '.repeat(depth);
    const result = [
      `${indent}${node.key} (${node.value})`,
      node.right ? `${indent}  R: ${this._printTree(node.right, depth + 1).trim()}` : '',
      node.left ? `${indent}  L: ${this._printTree(node.left, depth + 1).trim()}` : ''
    ].filter(Boolean).join('\n');
    return depth === 0 ? '\n' + result + '\n' : result;
  }

  [Symbol.iterator](): Iterator<[string, T]> {
    const stack: Node<T>[] = [];
    let current = this.root;

    while (current) {
      stack.push(current);
      current = current.left;
    }

    return {
      next: () => {
        if (stack.length === 0) {
          return { done: true, value: undefined };
        }

        const node = stack.pop()!;
        let current = node.right;

        while (current) {
          stack.push(current);
          current = current.left;
        }

        return { value: [node.key, node.value], done: false };
      },
    };
  }
}
