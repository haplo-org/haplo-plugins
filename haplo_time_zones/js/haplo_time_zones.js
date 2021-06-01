/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var UNIT_LIMITS = {
    date: { min: 1, max: 31 },
    month: { min: 0, max: 11 },
    hours: { min: 0, max: 23 },
    minutes: { min: 0, max: 59 },
    seconds: { min: 0, max: 59 },
    milliseconds: { min: 0, max: 999 }
};

//--------- Handlers ------------

var isWithinLimits = function(input, min, max, notInclusive) {
    if(notInclusive) {
        return (input > min) && (input < max);
    } else {
        return (input >= min) && (input <= max);
    }
};

var setTimeUnit = function(date, unitType, input, allowOverflow) {
    if(!!allowOverflow || isWithinLimits(input, UNIT_LIMITS[unitType].min, UNIT_LIMITS[unitType].max)) {
        switch(unitType) {
            case "date":
                date.setDate(input);
                break;
            case "month":
                date.setMonth(input);
                break;
            case "hours":
                date.setHours(input);
                break;
            case "minutes":
                date.setMinutes(input);
                break;
            case "seconds":
                date.setSeconds(input);
                break;
            case "milliseconds":
                date.setMilliseconds(input);
                break;
        }
    } else {
        throw new Error("Input for "+unitType+" is not in allowed range: Min: "+UNIT_LIMITS[unitType].min+" Max: "+UNIT_LIMITS[unitType].max);
    }
};

var applyOffset = function(date, hours, minutes, timezone, allowOverflow, getUTCEquivalentDatetime) {
    date = date ? new XDate(date).clone() : new XDate();
    if(!timezone) {
        timezone = O.group(GROUP["std:group:everyone"]).getTimeZone();
    }
    if(_.isNumber(hours)) {
        setTimeUnit(date, "hours", hours, allowOverflow);
    }
    if(_.isNumber(minutes)) {
        setTimeUnit(date, "minutes", minutes, allowOverflow);
    }
    let offset = timezone.getOffset(date.toDate());
    return !!getUTCEquivalentDatetime ? date.addMilliseconds(-offset).toDate() : date.addMilliseconds(offset).toDate();
};

var utcToLocalDatetime = function(date, hours, minutes, timezone, allowOverflow) {
    return applyOffset(date, hours, minutes, timezone, allowOverflow);
};

//named in a significantly different way to avoid confusion
var localToUTCEquivalentDatetime = function(date, hours, minutes, timezone, allowOverflow) {
    return applyOffset(date, hours, minutes, timezone, allowOverflow, true);
};

//-------------------- Services --------------------

//DEPRECATED
P.implementService("haplo:time-zone:get-time-at-local-time", function(date, hour, minutes, timezone) {
    if(!date) { date = new XDate(); } //UTC
    if(!timezone) { timezone = O.group(GROUP["std:group:everyone"]).getTimeZone(); }
    if(_.isNumber(hour)) { date.setHours(hour); }
    if(_.isNumber(minutes)) { date.setMinutes(minutes); }
    return new XDate(date.getTime()+timezone.getOffset(date.toDate())); //UTC+Offset
});

P.implementService("haplo:time-zones:get-local-datetime-from-utc", utcToLocalDatetime);

P.implementService("haplo:time-zones:get-utc-equivalent-from-local-datetime", localToUTCEquivalentDatetime);

P.implementService("haplo:time-zones:get-local-today", function(timezone) {
    return new XDate(utcToLocalDatetime(new Date(), null, null, timezone)).clearTime().toDate();
});

//-------------------- Scheduler --------------------

var haveDiscoveredImplementations;
var discovered = [];
var taskKinds = {};

var Task = function(spec) {
    this.kind = spec.kind+":time-zones-scheduler";
    this.hour = getSchedulerHour(spec.hourOrSchedulerHook, spec.kind);
    this.callRelativeToUTC = !!spec.callRelativeToUTC;
    this.setTaskArgumentsToUTC = !!spec.setTaskArgumentsToUTC;
    this.date = spec.date;
    this.timezone = spec.timezone;
    this.task = spec.task;
};

var getSchedulerHour = function(hourOrSchedulerHook, kind) {
    let SCHEDULER_HOOK_TO_HOUR = {
        "hScheduleDailyEarly": 6,
        "hScheduleDailyLate": 18,
        "hScheduleDailyMidday": 12,
        "hScheduleDailyMidnight": 0,
        "hScheduleHourly": null
    };
    if(_.isString(hourOrSchedulerHook) && _.contains(_.keys(SCHEDULER_HOOK_TO_HOUR), hourOrSchedulerHook)) {
        return SCHEDULER_HOOK_TO_HOUR[hourOrSchedulerHook];
    } else if(_.isNumber(hourOrSchedulerHook) && hourOrSchedulerHook < 24) {
        return hourOrSchedulerHook;
    } else {
        throw new Error("Please define a valid scheduler hook or hour for the hourOrSchedulerHook property. For kind: "+kind+" this must a number (0-23) or one of: "+_.keys(SCHEDULER_HOOK_TO_HOUR).join(", ")+". Note, defining this as 'hScheduleHourly' will set hour to null, for a specific hour please specify this numerically.");
    }
};

var cloneDate = function(date, clearTime) {
    return clearTime ? new XDate(date).clone().clearTime() : new XDate(date).clone();
};

var filterTasks = function(schedulerCalledAt) {
    return _.filter(discovered, (d) => {
        let date;
        if(d.hour === null) { return true; } //call every hour
        if(_.isNumber(d.hour)) {
            if(!d.callRelativeToUTC) {
                if(d.date) {
                    date = localToUTCEquivalentDatetime(cloneDate(d.date, true).setHours(d.hour));
                } else {
                    date = localToUTCEquivalentDatetime(null, d.hour);
                }
            } else {
                //this?
                // if(d.date) {
                    // date = utcToLocalDatetime(cloneDate(d.date, true), d.hour);
                // } else {
                //     date = utcToLocalDatetime(null, d.hour);
                // }
                //or this?
                date = new XDate();
            }
            let isSameHour = schedulerCalledAt.getHours() === date.getHours();
            let isSameDate = d.date ? (cloneDate(date, true).diffDays(cloneDate(schedulerCalledAt, true)) === 0) : true;
            return isSameDate && isSameHour;
        }
    });
};

var filteredTasks = function(data) {
    let schedulerCalledAt = new XDate(data.year, data.month, data.dayOfMonth, data.hour);
    return filterTasks(schedulerCalledAt);
};

P.ensureDiscoveredImplementations = function() {
    if(haveDiscoveredImplementations) { return; }
    try {
        O.serviceMaybe("haplo:time-zone:discover-scheduled-tasks", {
            scheduled(delegate) {
                let task = new Task(delegate);
                discovered.push(task);
                taskKinds[delegate.kind] = task;
            }
        });
        haveDiscoveredImplementations = true;
    } catch (e) {
        console.log("Error: ", e);
    }
};

P.backgroundCallback("run_scheduled_tasks", function(data) {
    P.ensureDiscoveredImplementations();
    let tasksToPerform = filteredTasks(data);
    if(tasksToPerform.length) {
        _.each(tasksToPerform, (t) => {
            try {
                if(t.setTaskArgumentsToUTC) {
                    t.task(data.response, data.year, data.month, data.dayOfMonth, data.hour, data.dayOfWeek);
                } else {
                    let date = utcToLocalDatetime(new XDate(data.year, data.month, data.dayOfMonth, data.hour));
                    t.task(data.response, date.getYear(), date.getMonth(), date.getDate(), date.getHours(), date.getDay());
                }
            } catch (e) {
                console.log("Error attempting task for "+t.kind+": ", e);
            }
        });
    }
});

P.hook("hScheduleHourly", function(response, year, month, dayOfMonth, hour, dayOfWeek) {
    O.background.run("haplo_time_zones:run_scheduled_tasks", {
        response: response,
        year: year,
        month: month, 
        dayOfMonth: dayOfMonth, 
        hour: hour, 
        dayOfWeek: dayOfWeek
    });
});

var TestScheduled = P.form("test-scheduled-actions", "form/test-scheduled-actions.json");

//TODO extend with kind?
if(O.currentUser.isSuperUser) {
    P.respond("GET,POST", "/do/haplo-time-zones/test-scheduled", [
        {parameter:"date", as:"string", optional:true},
        {parameter:"hour", as:"string", optional:true},
        {parameter:"utc", as:"string", optional:true}
    ], function(E, date, hour, utc) {
        if(E.request.method === "POST") {
            let dayOfWeek = new Date(date).getDay();
            let dateParts = date.split('-');
            dateParts = _.map(dateParts, d => parseInt(d, 10));
            if(utc === "t") {
                P.hScheduleHourly({}, dateParts[0], dateParts[1]-1, dateParts[2], (hour || 0), dayOfWeek);
                console.log("Test scheduled actions hook called for "+ new XDate(dateParts[0], dateParts[1]-1, dateParts[2], (hour || 0))+" UTC.");
            } else {
                date = localToUTCEquivalentDatetime(new XDate(dateParts[0], dateParts[1]-1, dateParts[2], (hour || 0)));
                P.hScheduleHourly({}, date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getDay());
                console.log("Test scheduled actions hook called at "+ new XDate(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours())+" UTC.");
            }
            return E.response.redirect("/");
        }
        E.render({
            form: TestScheduled.instance({})
        });
    });
}
