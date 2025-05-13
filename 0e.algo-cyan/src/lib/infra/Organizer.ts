export interface Organizer<T> {
  reorganize(item: T): void;
}