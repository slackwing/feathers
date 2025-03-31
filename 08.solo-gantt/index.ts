// plan
// 1. text-based gantt generation
// 2. no databse, hardcode tasks

class Project {

    private _tasks: Array<Task> = [];

    constructor(
        private _name: String,
    ) {}

    addTask(t: Task) {
        this._tasks.push(t);
    }
}

class Task {

    private _dependencies: Array<Task> = [];
    private _project: Project;

    constructor(
        private _name: String,
        private _points: number,
    ) {}

    dependsOn(t: Task) {
        this._dependencies.push(t);
    }
}

let t = new Task(1);
let u = new Task(2);
t.dependsOn(u);

let p1 = new Project("guitar (40oz))");

p1.addTask(new Task("get a metronome", 1));
p1.addTask(new Task("correct intro", 1));
p1.addTask(new Task("correct verse 1", 1));
p1.addTask(new Task("learn verse 2", 1));
p1.addTask(new Task("learn interlude (tapping)", 2));
p1.addTask(new Task("practice interlude (tapping)", 1));
p1.addTask(new Task("practice interlude (tapping)", 1));
p1.addTask(new Task("practice interlude (tapping)", 1));
p1.addTask(new Task("chorus sweep @100bpm 8x perfect", 2));
p1.addTask(new Task("chorus sweep @105bpm 8x perfect", 2));
p1.addTask(new Task("chorus sweep @110bpm 8x perfect", 2));
p1.addTask(new Task("chorus sweep @115bpm 8x perfect", 2));
p1.addTask(new Task("chorus sweep @120bpm 8x perfect", 2));
p1.addTask(new Task("chorus sweep @125bpm 8x perfect", 2));
p1.addTask(new Task("chorus sweep @130bpm 8x perfect", 2));
p1.addTask(new Task("chorus sweep @135bpm 8x perfect", 2));
p1.addTask(new Task("chorus sweep @140bpm 8x perfect", 2));
p1.addTask(new Task("chorus alt pick @100bpm 8x perfect", 3));
p1.addTask(new Task("chorus alt pick @105bpm 8x perfect", 3));
p1.addTask(new Task("chorus alt pick @110bpm 8x perfect", 3));
p1.addTask(new Task("chorus alt pick @115bpm 8x perfect", 3));
p1.addTask(new Task("chorus alt pick @120bpm 8x perfect", 3));
p1.addTask(new Task("chorus alt pick @125bpm 8x perfect", 3));
p1.addTask(new Task("chorus alt pick @130bpm 8x perfect", 3));
p1.addTask(new Task("chorus alt pick @135bpm 8x perfect", 3));
p1.addTask(new Task("chorus alt pick @140bpm 8x perfect", 3));