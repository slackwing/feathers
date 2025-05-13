import { Organizer } from "./Organizer";

export class SelfOrganizing<T, U extends Organizer<T>> {
  private organizers: Set<U> = new Set();

  public addOrganizer(organizer: U): void {
    this.organizers.add(organizer);
  }

  protected selfOrganize(t: T): void {
    for (const organizer of this.organizers) {
      organizer.reorganize(t);
    }
  }
}