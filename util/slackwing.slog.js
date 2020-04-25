var ___sl = {};
___sl.___Last_init = 'SLAC190035'; // my style of magic strings
function slog_init(event_name, max_logs) {
    ___sl[event_name] = {};
    var sle = ___sl[event_name];
    sle.logs = 0;
    sle.max_logs = max_logs;
    sle.labels_seen = {}; // if same label seen twice, print '---' and reset
    console.log('---sl. init: ' + event_name);
    ___sl.___last_init = event_name; // for convenience; allows event_name optional
}
function slog(label, value) {
    slog_event(___sl.___last_init, label, value);
}
function slog_event(event_name, label, value) {
    var fresh = false;
    if (!(event_name in ___sl)) {
        slog_init(event_name, -1);
        fresh = true;
    }
    var sle = ___sl[event_name];
    if (label in sle.labels_seen) {
        fresh = true;
        sle.labels_seen = {};
        sle.logs++;
    } else {
        sle.labels_seen[label] = true;
    }
    if (sle.logs < sle.max_logs || sle.max_logs == -1) {
        if (fresh)
            console.log('---sl. event: ' + event_name);
        console.log('  ' + label + ' = ' + value.toString(2) + ' (' + value + ')');
    }
}

