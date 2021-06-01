/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// ----------------------------------------------------------------------

var NOT_APPLICABLE = {};

function debug() {
    // console.log("DATE ENGINE DEBUG", _.toArray(arguments));
}

function check(thing, description) {
    if(!thing) {
        throw new Error("Internal error: " + description);
    }
}

////
//// Computed date representation
////

// Date representation: XDate + map of named input dates + rationale string
// explaining how those inputs combined to create the output. Errors are
// represented as a date with no XDate, and the inputs+rationale explain what
// went wrong.

function makeDate(xdate, inputs, rationale) {
    return {xdate: xdate, inputs: inputs, rationale: rationale};
}

function isValidDate(d) {
    return d && !!(d.xdate);
}

function makeInputDate(xdate, origin) {
    return {xdate: xdate, inputs: {}, rationale: "Given as " + origin};
}

function makeErrorDate(inputs, rationale) {
    return {xdate: null, inputs: inputs, rationale: rationale};
}

function describeDate(d) { // For debugging purposes
    if (d) {
        if (d.xdate) {
            return "date{" + d.xdate.toISOString() + "," + JSON.stringify(d.inputs) + "," + d.rationale + "}";
        } else {
            return "date{ERROR," + JSON.stringify(d.inputs) + "," + d.rationale + "}";
        }
    } else {
        return "null";
    }
}

function describeDuration(d) { // For debugging purposes
    if(d === 0) {
        return "0";
    } else if (_.isNull(d)) {
        return "null";
    } else if (_.isUndefined(d)) {
        return "undefined";
    } else if(d < 1000) {
        return d + "ms";
    } else if (d < 60000) {
        return (d / 1000) + "s";
    } else if (d < 3600000) {
        return (d / 60000) + "m";
    } else if (d < 86400000) {
        return (d / 3600000) + "h";
    } else  {
        return (d / 86400000) + "d";
    }
}

function dateDiff(earlier, later) {
    if (earlier.xdate !== null && later.xdate !== null) {
        return earlier.xdate.diffMilliseconds(later.xdate);
    }
    else {
        throw new Error("Internal error: Cannot compute difference between indeterminate dates: " +
            describeDate(earlier) + "  " +
            describeDate(later));
    }
}

////
//// Activity progress tracking
////

// "schedule" is of the form [[start, stop], ...] where start and stop are computed date names.
function Activity(name, schedule, durationRule, scheduleFromCalendar, shiftEndDates) {
    this.name = name;
    this.intervals = []; // Each is a pair of [start,stop] dates; final interval may have a null stop date if still open.
    this.overrides = []; // Each is a pair of [when,kind,progress] triples - see setProgressFraction / setProgressTime
    this.fractionComplete = null; // Neither, either or both of these may be known and we can only convert freely between the two if a total duration is known
    this.timeElapsed = null; // in milliseconds
    this.duration = null;
    this.schedule = schedule;
    this.durationRule = durationRule;
    this.scheduleFromCalendar = scheduleFromCalendar;
    this.shiftEndDates = shiftEndDates;
    this.transitions = {};
    this.previousGeneratedRules = {};
    this.scheduleSuspended = false;
}

Activity.prototype.addTransition = function(name, flagsToAdd, flagsToRemove, newProgressTime, newProgressFraction) {
    if(newProgressTime && newProgressFraction) {
        throw new Error("You can't specify both newProgressTime and newProgressFraction in the same activity transition (" + name + ")");
    }
    this.transitions[name] = {
        flagsToAdd: flagsToAdd,
        flagsToRemove: flagsToRemove,
        newProgressTime: newProgressTime,
        newProgressFraction: newProgressFraction,
    };
};

Activity.prototype.removeGeneratedRules = function(state) {
    // Remove previously generated rules - NOTE: this mutates the state rather than returning a modified copy.
    for(var ruleName in this.previousGeneratedRules) {
        delete state.dateRules[ruleName];
    }

    this.previousGeneratedRules = {};
};

function generateStandardActivityEndRule(name) {
    return function(S) {
        return S.computeActivityEnd(name);
    };
}

function computeActivityDuration(start, durationRule, state) {
    if(durationRule) {
        let d = evalRule(durationRule, state);
        if(_.isArray(d)) {
            // Special duration thingy
            switch(d[1]) {
            case "days":
                return d[0] * 86400000;
            case "weeks":
                return d[0] * 7 * 86400000;
            case "months":
                // Months vary depending on when you start
                if(isValidDate(start)) {
                    let end = start.xdate.clone().addMonths(d[0]);
                    return start.xdate.diffMilliseconds(end);
                } else {
                    debug("Activity.computeActivityDuration: Durations in months are only possible when the start date is known");
                    return null;
                }
                break; // Redundant, but needed by the linter
            case "terms":
                let calendar = d[2];
                // Terms vary depending on when you start
                if(isValidDate(start)) {
                    let cal = state.calendars[calendar];
                    let end = advanceTerms(cal, start, d[0]);
                    return start.xdate.diffMilliseconds(end.xdate);
                } else {
                    debug("Activity.computeActivityDuration: Durations in terms are only possible when the start date is known");
                    return null;
                }
                break; // Redundant, but needed by the linter
            case "years":
                // Years vary depending on when you start
                if(isValidDate(start)) {
                    let end = start.xdate.clone().addYears(d[0]);
                    return start.xdate.diffMilliseconds(end);
                } else {
                    debug("Activity.computeActivityDuration: Durations in years are only possible when the start date is known");
                    return null;
                }
                break; // Redundant, but needed by the linter
            default:
                throw new Error("Unknown duration type " + d[1]);
            }
        } else {
            // Direct time in milliseconds or NOT_APPLICABLE
            return d;
        }
    } else {
        return null;
    }
}

Activity.prototype.reschedule = function(state) {
    let generatedRules = {};

    // Compute duration and schedule
    if (this.scheduleFromCalendar) {
        let config = this.scheduleFromCalendar;
        let start = evalRule(config.start, state);
        let end = null;
        if (config.end) {
            end = evalRule(config.end, state);
        }
        let duration = computeActivityDuration(start, this.durationRule, state);
        debug("[Activity[" + this.name + "].reschedule]: schedule from calendar (" + JSON.stringify(config) + " start = " + describeDate(start) + " end = " + describeDate(end) + " duration = " + describeDuration(duration));
        let rules;
        if((end !== null) || ((this.timeElapsed === null || this.timeElapsed === 0) && this.intervals.length === 0)) {
            // Not started yet, or using a fixed end date; compute from provided start date and full duration
            debug("[Activity[" + this.name + "].reschedule]: Not started yet (or defined end date), so basing schedule on start date");
            rules = this.computeScheduleFromCalendar(this.name,
                state.calendars[config.calendar],
                config.intervals,
                start,
                end,
                duration,
                duration,
                config.endName);
        } else {
            // We have started already and need to fill a duration, so compute from now and remaining duration
            let progressTime = this.getProgressTime(state.now, state);
            debug("[Activity[" + this.name + "].reschedule]: Computing schedule from now " + describeDate(state.now) + " and duration " + describeDuration(duration) + " minus progress " + describeDuration(progressTime) + " = " + describeDuration(duration-progressTime));
            rules = this.computeScheduleFromCalendar(this.name,
                state.calendars[config.calendar],
                config.intervals,
                state.now,
                null,
                duration,
                duration - progressTime,
                config.endName);
        }
        // Insert rules for the generate date names in the schedule
        generatedRules = _.extend(generatedRules, rules);
    } else if (this.durationRule) {
        let start;
        if (this.schedule && this.schedule.length > 0) {
            start = computeDate(this.schedule[0][0], state);
        }
        let duration = computeActivityDuration(start, this.durationRule, state);
        this.setDuration(duration);
        debug("[Activity[" + this.name + "].reschedule]: evaluated duration to be " + describeDuration(duration));

        // As we have a defined duration, we can automatically create a rule
        // to compute the end date, the name of which can be found in the
        // schedule.

        if (this.schedule && this.schedule.length > 0) {
            let endDateName = _.last(this.schedule)[1];
            debug("[Activity[" + this.name + "].reschedule]: generating rule to compute end date '" + endDateName + "'");
            generatedRules[endDateName] = generateStandardActivityEndRule(this.name);
        }
    }

    // Record generated rules, so we can remove them if we re-schedule
    // (otherwise we get an error about redefining a rule)
    this.previousGeneratedRules = generatedRules;

    // Return generated rules to go into state
    return generatedRules;
};

// Generate a schedule, given a calendar, a list of [start,stop] interval names
// from that calendar during which the activity can happen, a start date, then
// either an end date or a duration. start/end must be date objects, not raw
// XDates. Intervals must be in date order and not overlapping.

// NOTE: This function will make up date names to put in the schedule - and
// return an object mapping those names to rules to generate those dates.

Activity.prototype.computeScheduleFromCalendar = function(namePrefix, calendar, intervals, start, end, duration, durationLeft, overallEndName) {
    if(end && duration) {
        throw new Error("An activity schedule can't have both an end date and a duration");
    }
    if(!end && (!duration || duration === NOT_APPLICABLE)) {
        return {};
    }

    if(duration) {
        this.setDuration(duration);
    }

    var dateRules = {};

    let that = this;

    let defineDate = function(name, value, isEnd) {
        let fullName = namePrefix + "::" + name;
        if(isEnd && overallEndName) {
            fullName = overallEndName; //We might want to define what the output is called
        }
        if(duration && isEnd && that.shiftEndDates) {
            dateRules[fullName] = function(S) {
                return that.shiftEndDates(S, value);
            };
        } else {
            dateRules[fullName] = value;
        }
        return fullName;
    };

    this.schedule = [];

    var term = findTerm(calendar, start);
    if(term === null) {
        // Schedule not (yet) defined if start date not (yet) defined
        debug("[computeScheduleFromCalendar] Undefined start term, returning: " + JSON.stringify(this.schedule) + " / " + JSON.stringify(dateRules));
        return dateRules;
    }

    var nextTermWillBeLast = function(interval, durationLeftNow) {
        let intervalStart = getTermDate(calendar, term+1, interval[0]);
        let intervalEnd = getTermDate(calendar, term+1, interval[1]);
        if(end) {
            if(dateDiff(end, intervalStart) >= 0) {
                return true;
            }
        } else {
            if(durationLeftNow <= 0) {
                return true;
            }
        }
    };

    // Iterate through the calendar from the term containing the start date
    // onwards, generating schedule spans
    var keepGoing = true;
    while(keepGoing) {
        for(let intervalIdx in intervals) {
            // If we have no duration left to fill, just stop
            if(durationLeft <= 0) {
                keepGoing = false;
                break;
            }

            let interval = intervals[intervalIdx];
            let intervalStart = getTermDate(calendar, term, interval[0]);
            let intervalEnd = getTermDate(calendar, term, interval[1]);
            if (!isValidDate(intervalStart) || !isValidDate(intervalEnd)) {
                this.schedule.push([defineDate("final interval start due to error", intervalStart),
                                    defineDate("final interval end due to error", intervalEnd)]);
                // Abort at this point
                return dateRules;
            }

            debug("[computeScheduleFromCalendar] Considering next term span (" + describeDate(intervalStart) + " -> " + describeDate(intervalEnd) + ") = " + describeDuration(dateDiff(intervalStart, intervalEnd)) + ", duration left = " + describeDuration(durationLeft));
            let startName = calendar[term].name + ":" + interval[0];
            let endName = calendar[term].name + ":" + interval[1];

            // Cases to consider:
            
            // 1) Span is entirely before the start date - skip it
            if(dateDiff(intervalEnd, start) >= 0) {
                continue;
            }

            // 2) Span straddles the start date - truncate it
            if(dateDiff(intervalStart, start) >= 0) {
                intervalStart = start;
                startName = "Activity start";
            }

            // 3) Span is entirely after the end date - skip it and stop iterating
            if(end) {
                if(dateDiff(end, intervalStart) >= 0) {
                    keepGoing = false;
                    break;
                }
            }

            let intervalLength = dateDiff(intervalStart, intervalEnd);

            // 4) Span straddles the end date or length is more than durationLeft - truncate
            if(end) {
                if(dateDiff(end, intervalEnd) >= 0) {
                    intervalEnd = end;
                    endName = "Activity end";
                }
            } else {
                if(durationLeft < intervalLength) {
                    intervalEnd = makeDate(intervalStart.xdate.clone().addMilliseconds(durationLeft),
                                           [intervalEnd],
                                           "Interval truncated to fit remaining duration");
                    endName = "Activity end";
                }
            }

            // 5) Span straddles the start date AND (straddles the end date or
            // length is more than durationLeft) - truncate both ends - tbut
            // this will have been handled already by the overlapping cases
            // above.

            // 6) Other - just add it as-is. Well, in that case none of the
            // triggers above will have happened.

            // Add this entry to the schedule and deduct it from
            // durationLeft if we're using duration tracking.
            debug("[computeScheduleFromCalendar] Generating schedule span", startName, intervalStart, endName, intervalEnd);
            if (duration) {
                durationLeft = durationLeft - intervalLength;
            }

            this.schedule.push([defineDate(startName, intervalStart),
                                defineDate(endName, intervalEnd, nextTermWillBeLast(interval, durationLeft))]);
        }

        // Look at next term
        term = term + 1;
    }
    debug("[computeScheduleFromCalendar] Calculated date rules, returning: " + JSON.stringify(this.schedule) + " / " + JSON.stringify(dateRules));

    return dateRules;
};

Activity.prototype.getInProgressNow = function () {
    if (this.intervals.length !== 0) {
        return _.last(this.intervals)[1] === null;
    } else {
        return false;
    }
};

Activity.prototype.setProgressFraction = function (pf, state) {
    this.fractionComplete = pf;
    if(this.getInProgressNow()) {
        // End current interval and start a new one, to prevent time in the current interval
        // interval being counted twice
        var lastInterval = _.last(this.intervals);
        lastInterval[1] = state.now;
        this.intervals.push([state.now, null]);
    }
    // Being null won't cause a problem as long as the duration isn't specified in months or years
    let start = this.intervals.length > 0 ? this.intervals[0][0] : null; 
    // Default to recalculating in case flags have changed since last time duration was set
    var duration = computeActivityDuration(start, this.durationRule, state) || this.getDuration(state);
    if(duration === NOT_APPLICABLE) { return; }
    if (duration !== null) {
        // We know duration so can compute time elapsed too
        this.timeElapsed = pf * duration;
    } else if (this.timeElapsed !== null) {
        // We know fraction and time so can compute duration
        this.duration = this.timeElapsed / this.fractionComplete;
    }
    this.overrides.push([state.now,"fraction",pf]);
};

Activity.prototype.getProgressFraction = function (now, state) {
    if (this.intervals.length === 0) {
        return this.fractionComplete;
    } else {
        let lastInterval = _.last(this.intervals);
        if (lastInterval[1] === null) {
            // Currently in progress, so add a bit more for up to now
            var extraTime = dateDiff(lastInterval[0],now);
            var duration = this.getDuration(state);
            if (duration === null || duration === NOT_APPLICABLE) {
                // Can't work out a progress fraction in this case :-(
                return null;
            } else {
                return ((this.timeElapsed || 0) + extraTime) / duration;
            }
        } else {
            return this.fractionComplete;
        }
    }
};

Activity.prototype.setProgressTime = function (pt, state) {
    this.timeElapsed = pt;
    if(this.getInProgressNow()) {
        // End current interval and start a new one, to prevent time in the current interval
        // interval being counted twice
        var lastInterval = _.last(this.intervals);
        lastInterval[1] = state.now;
        this.intervals.push([state.now, null]);
    }
    var duration = this.getDuration(state);
    if(duration === NOT_APPLICABLE) { return; }
    if (duration !== null) {
        // We know duration so can compute fraction elapsed too
        this.fractionComplete = pt / duration;
    } else if (this.fractionComplete !== null) {
        // We know fraction and time so can compute duration
        this.duration = this.timeElapsed / this.fractionComplete;
    }
    this.overrides.push([state.now,"time",pt]);
};

Activity.prototype.getProgressTime = function (now, state) {
    debug("[getProgressTime] intervals = " + JSON.stringify(this.intervals) + " / " + describeDuration(this.timeElapsed));
    if (this.intervals.length === 0) {
        return this.timeElapsed;
    } else {
        var lastInterval = _.last(this.intervals);
        if (lastInterval[1] === null) {
            // Currently in progress, so add a bit more for up to now
            var extraTime = dateDiff(lastInterval[0],now);
            debug("[getProgressTime] extra time = "+describeDuration(extraTime));
            if(extraTime > 0){
                return this.timeElapsed + extraTime;
            }
        }
        return this.timeElapsed;
    }
};

Activity.prototype.setDuration = function (d) {
    this.duration = d;
    if(this.duration == NOT_APPLICABLE) { return; }
    if (this.fractionComplete === null && this.timeElapsed !== null) {
        // We can now compute fraction complete
        this.fractionComplete = this.timeElapsed / this.duration;
    } else if (this.fractionComplete !== null && this.timeElapsed === null) {
        // We can now compute time elapsed
        this.timeElapsed = this.fractionComplete * this.duration;
    }
};

Activity.prototype.getDuration = function (state) {
    if (this.duration) {
        return this.duration;
    } else if (!this.schedule || this.schedule.length === 0) {
        return null; // No schedule or empty schedule => no duration as opposed to 0 duration.
    } else {
        // PERFORMANCE NOTE: We might compute this several times against the
        // same state, wasting time. We *could* put a duration cache (in* the
        // state as long as it's reset whenever anything changes, eg on every
        // iteration through the log loop in computeDates.

        // Compute duration from schedule and state, or return null if any dates
        // in the schedule are undefined.
        var failed = false;
        var totalDuration = 0;

        this.schedule.forEach(function(x) {
            if (failed) {
                return null;
            }
            var x0 = computeDate(x[0], state);
            if (!isValidDate(x0)) {
                failed = true;
            } else {
                var x1 = computeDate(x[1], state);
                if (!isValidDate(x1)) {
                    failed = true;
                } else {
                    totalDuration += dateDiff(x0, x1);
                }
            }
        });

        if (failed) {
            return null;
        } else {
            return totalDuration;
        }
    }
};

Activity.prototype.addProgressTime = function (pt, state) {
    let duration = this.getDuration(state);
    if(duration === NOT_APPLICABLE) { return; }
    // A few cases to consider.
    // T = current progress time known
    // F = current progress fraction known
    // D = duration known
    //    ) No progress so far - so set progress time to pt
    if (this.timeElapsed === null && this.fractionComplete === null && duration === null) {
        this.setProgressTime(pt, state);
    }
    //   D) No progress so far - set progress time to pt and fraction can be computed
    else if (this.timeElapsed === null && this.fractionComplete === null && duration !== null) {
        this.setProgressTime(pt, state);
    }
    //  F ) Fractional progress but no duration - we cannot reconcile! Error!
    else if (this.timeElapsed === null && this.fractionComplete !== null && duration === null) {
        throw new Error("Activity " + this.name + " had a progress fraction but no duration, and we tried to add progress time to it - these cannot be reconciled.");
    }
    //  FD) Fraction and duration known so we will have computed T - this case is impossible
    // T  ) Time progress but no duration - add pt to time
    else if (this.timeElapsed !== null && this.fractionComplete === null && duration === null) {
        this.setProgressTime(pt + this.timeElapsed, state);
    }
    // T D) Time and duration known so we will have computed F - this case is impossible
    // TF ) Time and fraction known - we will have computed D - this case is impossible
    // TFD) Everything known - add pt to time and recompute f
    else if (this.timeElapsed !== null && this.fractionComplete !== null && duration !== null) {
        this.setProgressTime(pt + this.timeElapsed, state);
    }
    // All impossible cases flow here
    else {
        throw new Error("Internal error: Activity " + this.name + " was in an inconsistent state (" + this.timeElapsed + "," + this.fractionComplete + "," + duration + ")");
    }
};

Activity.prototype.start = function (when, state) {

    check(!this.getInProgressNow(), "We can't start an activity (" + this.name + ") that's already in progress at "+when.xdate.toString());
    debug("Start activity "+this.name+" at "+when.xdate.toString());

    this.intervals.push([when, null]);
};

Activity.prototype.stop = function (when, state) {
    check(this.getInProgressNow(), "We can't stop an activity (" + this.name + ") that's not in progress at"+when.xdate.toString());
    debug("Stop activity "+this.name+" at "+when.xdate.toString());

    var lastInterval = _.last(this.intervals);
    lastInterval[1] = when;
    this.addProgressTime(dateDiff(lastInterval[0],when), state);
};

// Given a known duration and a schedule, try to work out the date at which the
// duration will have elapsed, accounting for stops and starts. If any date in
// the scheduled is undefined, barf and return an undefined date.
Activity.prototype.computeEnd = function(state) {
    var name = this.name;
    var now = state.now;
    var duration = this.duration; // Don't call getDuration(), we can only work if there's a specified duration
    if (duration === null || duration === NOT_APPLICABLE) {
        return makeErrorDate([], "Cannot compute the end of activity " + name + " without a defined duration");
    }
    var progress = this.getProgressTime(now, state);
    var intervals = this.intervals;
    debug("[computeEnd] "+name+" initial timeleft = " + describeDuration(duration) + " - " + describeDuration(progress)+" at "+JSON.stringify(now));
    var timeLeft = duration - progress;
    var schedule = this.schedule;

    var future = false; // Flag set when we pass "now" in the schedule
    var result = null;

    if(!schedule) {
        return makeErrorDate([], "Cannot compute the end of activity " + name + " as it does not have a schedule");
    }
    
    // Iterate through the schedule to find where we are now, then subtract time
    // thereafter.

    // We MUST start from getProgressTime() and find "now" in the schedule and
    // then compute forwards rather than counting time in the schedule, as the
    // schedule may not have been followed - there could have been a manual
    // override of progressTime/progressFraction, or this activity could have
    // been introduced by a ruleset change and its initial progress computed
    // from progress through previous activities.
    schedule.forEach(function(entry, index) {
        if (result) {
            // Drop out if we've already got a result
            return;
        }

        debug("[computeEnd] timeLeft = " + describeDuration(timeLeft) + ", entry = " + JSON.stringify(entry));

        let intervalStart = computeDate(entry[0], state);

        if (!isValidDate(intervalStart)) {
            return makeErrorDate([intervalStart], "Cannot compute the end date of an activity " + name + " when a start date is undefined");
        }

        if (index === schedule.length - 1) {
            // This is the last entry in the schedule, so we just compute the
            // end date from the time left; the end date in the schedule will
            // probably just return a recursion error if we try to compute it as
            // it's probably defined by calling this very function!

            debug("[computeEnd] final schedule entry, finishing here");

            if (dateDiff(intervalStart, now) > 0) {
                if(intervals.length > 0) {
                    if(!_.last(intervals)[1]) {
                        // Start of interval is in the past, so take timeLeft from now
                        // as we've already accounted for elapsed time in the interval
                        let finishDate = now.xdate.clone().addMilliseconds(timeLeft);
                        result = makeDate(finishDate, [now], "Computed end of activity " + name + " from time left and current time");
                    } else  {
                        result = _.last(intervals)[1];
                        future = true;
                    }
                }
            } else {
                // Start of interval is in the future, so just compute based on the start date
                let finishDate = intervalStart.xdate.clone().addMilliseconds(timeLeft);
                result = makeDate(finishDate, [intervalStart], "Computed end of activity " + name + " from time left and scheduled start of final interval of work");
            }
        } else {

            let intervalEnd = computeDate(entry[1], state);

            if (!isValidDate(intervalEnd)) {
                return makeErrorDate([intervalEnd], "Cannot compute end date of a activity " + name + " when an end date is undefined");
            }

            if (!future) {
                if (dateDiff(intervalEnd, now) >= 0) {
                    // Whole interval is in the past, continue
                } else if (dateDiff(intervalStart, now) > 0) {
                    // Start of interval is in the past, end isn't, so we are in the
                    // middle of an interval: need to subtract out time remaining.
                    timeLeft -= dateDiff(now, intervalEnd);
                    // And we're now in the future!
                    future = true;
                } else {
                    // Whole interval is in the future, subtract its length
                    timeLeft -= dateDiff(intervalStart, intervalEnd);
                    // And we're now in the future
                    future = true;
                }
            } else {
                // Whole interval is in the future, subtract its length
                timeLeft -= dateDiff(intervalStart, intervalEnd);
            }

            if (timeLeft <= 0) {
                // Run out of time before the end of the schedule? Stop now!
                let finishDate = intervalEnd.xdate.clone().addMilliseconds(timeLeft);
                result = makeDate(finishDate, [intervalStart, intervalEnd], "Computed end of activity " + name + "  - the schedule was longer than the duration so we cut it short");
            }
        }
    });

    if(this.shiftEndDates) {
        result = evalRule(this.shiftEndDates, state, result);
    }

    return result;
};

Activity.prototype.getSchedule = function (state) {
    if(!this.schedule) {
        return [];
    }
    var schedule = this.schedule.map(function (entry) {
        return [computeDate(entry[0], state), computeDate(entry[1], state)];
    });

    // Sanity check schedule, as various parts of the code assume schedule spans
    // increase with time and don't overlap

    var previousEnd = null;
    
    _.each(schedule, function(span) {
        // 0) Leave already-invalid spans as they are
        if(isValidDate(span[0]) && isValidDate(span[1])) {
            let start = span[0];
            let end = span[1];
            if(dateDiff(start, end) < 0) {
                // 1) Remove schedule spans that end before they start
                span[0] = makeErrorDate([start,end], "Scheduled activity interval removed as the end was before the start");
                span[1] = makeErrorDate([start,end], "Scheduled activity interval removed as the end was before the start");
            } else if(previousEnd !== null && dateDiff(previousEnd, span[0]) < 0) {
                // 2) Remove schedule spans that start before the previous one ended
                span[0] = makeErrorDate([start,end,previousEnd], "Scheduled activity interval removed as it starts before the previous span ended");
                span[1] = makeErrorDate([start,end,previousEnd], "Scheduled activity interval removed as it starts before the previous span ended");
            } else {
                // Only update previousEnd if we didn't reject the span
                previousEnd = end;
            }
        }
    });

    return schedule;
};

// Find scheduled actions in a time span. This gets called for every iteration
// of the computeDates loop, which is annoying, but any iteration through the
// loop could potentially change something that affects the schedule of any
// action, so fixing that would require a cache that is cleverly
// part-invalidated when something changes. So let's save that for when this
// causes problems by being too slow!

Activity.prototype.findActions = function(state, startDate, stopDate) {
    // The interval of interest runs from ON OR AFTER startDate to BEFORE
    // stopDate, to meet the needs of computeDates in using this to find actions
    // since the last event date.

    if (this.scheduleSuspended) {
        // The schedule is suspended, no actions please.
        return [];
    }

    var schedule = this.getSchedule(state);
    var actions = [];
    for(var index in schedule) {
        let interval = schedule[index];

        // Add interval start if it's in the search range
        if(isValidDate(interval[0])) {
            if(dateDiff(interval[0], startDate) <= 0 &&
               dateDiff(stopDate, interval[0]) < 0) {
                actions.push({
                    type: "start",
                    date: interval[0],
                    activity: this
                });
            }
        }

        // Add interval end if it's in the search range
        if(isValidDate(interval[1])) {
            if(dateDiff(interval[1], startDate) < 0 &&
               dateDiff(stopDate, interval[1]) <= 0) {
                actions.push({
                    type: "stop",
                    date: interval[1],
                    activity: this
                });
            }

            // Abort early if we've passed the stop date
            if(dateDiff(stopDate, interval[1]) > 0) {
                return actions;
            }
        }
    }
    return actions;
};

Activity.prototype.suspend = function() {
    this.scheduleSuspended = true;
};

Activity.prototype.resume = function() {
    this.scheduleSuspended = false;
};

function findActivityActions(state, startDate, stopDate) {
    var actions = [];
    for(var activityName in state.activities) {
        let activity = state.activities[activityName];
        let foundActions = activity.findActions(state, startDate, stopDate);
        actions = actions.concat(foundActions);
    }
    return actions;
}


////
//// Term calendars
////

/*
 Create a term. technicalStart is the "technical" start time used to assign dates to terms; if null, the earliest anchor will be
 used. anchors is a map from date anchor names in the term to their actual
 dates. All terms in the same calendar should have the same anchor names. Terms
 must not overlap - the latest date in a term must be before the technical start
 of the next term.

 Date arguments are XDates rather than the internal date representation.
*/

function makeTerm(name, anchors, technicalStart) {
    if (!technicalStart) {
        // Find earliest anchor as technical start
        for(var anchorName in anchors) {
            let date = anchors[anchorName];
            if (!technicalStart) {
                technicalStart = date;
            } else {
                if (technicalStart.diffMilliseconds(date) < 0) {
                    technicalStart = date;
                }
            }
        }
    }
    return {
        name: name,
        technicalStart: technicalStart,
        anchors: anchors
    };
}

function getTermDate(calendar, term, anchor) {
    var t = calendar[term];
    if(!t) {
        return makeErrorDate([], "No term index " + term + " found in this calendar (valid term indices are 0-" + (calendar.length - 1) + ")");
    }
    var d = t.anchors[anchor];
    if (!d) {
        return makeErrorDate([], "No date " + anchor + " found in term " + t.name);
    }
    return makeDate(d, [], anchor + " in term " + t.name);
}

// From now on we work with date objects rather than raw XDates

// A calendar is an array of terms, in ascending date order.

// Return the index of the term this date is in, based on technicalStart
// dates. As we don't have a technicalEnd, dates after the last term are always
// in the last term. Dates before the first term get put in term"null".

function findTerm(calendar, date) {
    if (!isValidDate(date)) {
        return null;
    }
    if (calendar.length === 0) {
        // Empty calendar, no terms
        return null;
    }

    for(var term in calendar) {
        let delta = date.xdate.diffMilliseconds(calendar[term].technicalStart);
        // Does this term start AFTER the date? (If it starts ON the date that doesn't count)
        if (delta > 0) {
            // If so, the date's in last term.
            if (term > 0) {
                return term-1;
            } else {
                // But this was the first term, so the date is in no term.
                return null;
            }
        }
    }

    // Not even the final term started after this date, so it's in the final term.
    return calendar.length - 1;
}

// Eg, "Find the nearest term start before (or equal to) this date in the calendar - returns a date object
function findTermDateBefore(calendar, date, anchor, calName) {
    if (!isValidDate(date)) {
        return date;
    }

    var term = findTerm(calendar, date);
    if (term === null) {
        return makeErrorDate([date], "Provided date was before the start of the calendar");
    }

    var delta = calendar[term].anchors[anchor].diffMilliseconds(date.xdate);

    var calNameSuffix = calName?(" in " + calName):"";

    // The instance of the anchor before the date will either be in this term
    // or, if not, the previous one - if it's not the first.
    if(delta >= 0) {
        return makeDate(calendar[term].anchors[anchor], [date], "Latest " + anchor + " before or on this date" + calNameSuffix);
    } else {
        if (term > 0) {
            return makeDate(calendar[term-1].anchors[anchor], [date], "Latest " + anchor + " before or on this date" + calNameSuffix);
        } else {
            return makeErrorDate([date], "Provided date was before the first instance of " + anchor + calNameSuffix);
         }
    }
}

// Eg, "Find the nearest term end after (or equal to) this date in the calendar
function findTermDateAfter(calendar, date, anchor, calName) {
    if (!isValidDate(date)) {
        return date;
    }

    var calNameSuffix = calName?(" in " + calName):"";

    var term = findTerm(calendar, date);
    if (term === null) {
        // Before first term but there's at least one term? Just return date in first term!
        if (calendar.length > 0) {
            return makeDate(calendar[0].anchors[anchor], [date], "Next " + anchor + " after or on this date" + calNameSuffix);
        } else {
            return makeErrorDate([date], "No terms defined" + calNameSuffix);
        }
    }

    let delta = calendar[term].anchors[anchor].diffMilliseconds(date.xdate);

    // The instance of the anchor after the date will either be in this term
    // or, if not, the next one - if it's not the last.
    if(delta <= 0) {
        return makeDate(calendar[term].anchors[anchor], [date], "Next " + anchor + " after or on this date" + calNameSuffix);
    } else {
        if (term < calendar.length-1) {
            return makeDate(calendar[term+1].anchors[anchor], [date], "Next " + anchor + " after or on this date" + calNameSuffix);
        } else {
            return makeErrorDate([date], "Provided date was after the last instance of " + anchor + calNameSuffix);
        }
    }
}

// Given a date, return the end of term N terms after that date (with 0 being
// the term the date is in). If endAnchor is not specified, it defaults to
// "end". Useful to work out a date that is N terms in the future.
function advanceTerms(calendar, date, N, endAnchor, calName) {
    endAnchor = endAnchor || "end";

    var term = findTerm(calendar, date);
    if (term === null) {
        return makeErrorDate([date], "The date is before the start of the calendar");
    }

    var targetTerm = term + N;

    var calNameSuffix = calName?(" in " + calName):"";

    if (targetTerm < calendar.length) {
        return makeDate(calendar[targetTerm].anchors[endAnchor], [date], endAnchor + " of term " + N + " terms after this date" + calNameSuffix);
    } else {
        return makeErrorDate([date], "There is no term " + targetTerm + " (it goes up to " + (calendar.length-1) + ")" + calNameSuffix);
    }
}


////
//// Repeating date representation
////

function makeSimpleInterval(ms) {
    return function(t) {
        return t.addMilliseconds(ms);
    };
}

function makeMonthsInterval(m) {
    return function(t) {
        return t.addMonths(m);
    };
}

function makeYearsInterval(y) {
    return function(t) {
        return t.addYears(y);
    };
}

function isExcluded(date, exclusions) {
    // date is an XDate, exclusions is an array of 3-element [startDate,
    // endDate, kind] arrays of XDates, representing periods in which the date
    // is excluded. startDate is excluded, endDate is not (it's a semi-open
    // interval) The exclusion array is returned.

    for(var idx in exclusions) {
        var start = exclusions[idx][0];
        var end = exclusions[idx][1];

        if (start.diffMilliseconds(date) >= 0 &&
            date.diffMilliseconds(end) > 0) {
            // In interval, excluded so return exclusion kind!
            return exclusions[idx];
        }
    }

    return false;
}

function RepeatingDate(start, interval, intervalKind, end, exclusions, broken, rationale) {
    this.start = start;
    this.repeating = true;
    switch(intervalKind) {
    case 'days':
        this.advance = makeSimpleInterval(interval * 86400000);
        break;
    case 'weeks':
        this.advance = makeSimpleInterval(interval * 7 * 86400000);
        break;
    case 'months':
        this.advance = makeMonthsInterval(interval);
        break;
    case 'years':
        this.advance = makeYearsInterval(interval);
        break;
    default:
        throw new Error("Unknown repeating date interval kind: " + intervalKind);
    }
    this.end = end;
    this.exclusions = exclusions;
    this.broken = broken;
    this.rationale = rationale;

    this.mappers = [];
}

function makeRepeatingDate(start, interval, intervalKind, end, rationale) {
    return new RepeatingDate(start, interval, intervalKind, end, [], false, rationale);
}

function makeBrokenRepeatingDate(brokenDate, rationale) {
    return new RepeatingDate(brokenDate, null, null, null, [], true, rationale);
}

function mapResult(index, mappers, date) {
    for(var mapperIndex in mappers) {
        date = mappers[mapperIndex](index, date);
    }
    return date;
}

RepeatingDate.prototype.isValid = function() {
    return (!this.broken);
};

RepeatingDate.prototype.getRationale = function() {
    return this.rationale;
};

RepeatingDate.prototype.getDate = function(index) {
    if (this.broken) {
        return mapResult(originalIndex, this.mappers, makeErrorDate([this.start], this.rationale));
    }
    var originalIndex = index;
    if (!isValidDate(this.start)) {
        return mapResult(originalIndex, this.mappers, makeErrorDate([this.start], "Cannot compute repeating date without valid start date"));
    }
    if (this.end) {
        if (!isValidDate(this.end)) {
            return mapResult(originalIndex, this.mappers, makeErrorDate([this.start, this.end], "Cannot compute repeating date without valid end date"));
        }
    }

    var result = this.start.xdate.clone();
    while(1) {
        if (this.end) {
            if (result.diffMilliseconds(this.end.xdate) <= 0) {
                return mapResult(originalIndex, this.mappers, makeErrorDate([this.start, result, this.end], "Occurrence " + (originalIndex-index) + " of " + this.rationale + " is beyond the end date"));
            }
        }
        let exclusion = isExcluded(result, this.exclusions);
        if (exclusion) {
            if (index === 0) {
                // This is the instance we seek
                while(exclusion) {
                    let start = exclusion[0];
                    let end = exclusion[1];
                    let kind = exclusion[2];
                    switch (kind) {
                    case "dayBefore":
                        result = start.clone();
                        result.addDays(-1);
                        break;
                    case "dayAfter":
                        // No need to add a day as exclusions are semi-open intervals so the end date IS the "day after"
                        result = end.clone();
                        break;
                    default:
                        // Date is excluded, jump ahead and try again
                        this.advance(result);
                        break;
                    }

                    // Try again to see if there's another, later, exclusion still in effect
                    exclusion = isExcluded(result, this.exclusions);
                }
            } else {
                // If this is a dayBefore / dayAfter exclusion, then it consumes
                // ONE index for that "moved" date, but no more - multiple
                // excluded dates after that (even if hitting a different
                // exclusion in the list) are all replaced by that single
                // instance.
                switch(exclusion[2]) {
                case "dayBefore":
                    index--;
                    break;
                case "dayAfter":
                    index--;
                    break;
                default:
                    break;
                }

                while(exclusion) {
                    // Date is excluded, jump ahead
                    this.advance(result);

                    // Try again to see if it's still excluded
                    exclusion = isExcluded(result, this.exclusions);
                }
            }
        } else {
            if (index === 0) {
                // We found the desired one
                return mapResult(originalIndex, this.mappers, makeDate(result, [this.start], "Occurrence " + originalIndex + " of " + this.rationale));
            } else {
                // This isn't the one we want, count one ahead
                this.advance(result);
                index--;
            }
        }
    }
};

RepeatingDate.prototype.map = function(callback) {
    var result = _.clone(this);
    result.mappers.push(callback);
    return result;
};

function filterDates(repeatingDate, inclusions, exclusionKind, name) {
    // Convert a sorted, non-overlapping, list of VALID dates to a list of
    // EXCLUDED dates and return a repeatingDate that is bound by them.  We may
    // need to adjust the start/end dates, too.


    // Be careful with types here - repeating date start and ends are date
    // objects, as are the inclusions list, but the exclusion list is raw
    // XDates.
    var result = _.clone(repeatingDate);

    if (inclusions.length === 0) {
        // No dates are included
        return makeBrokenRepeatingDate(null, "There are no occurrences of this date that fall within " + name);
    }
    var firstIncludedDate = inclusions[0][0];
    var lastIncludedDate = _.last(inclusions)[1];

    var origStart = _.clone(result.start);
    var startMoved = false;

    // Move start date to after first included date
    while(result.start.xdate.diffMilliseconds(firstIncludedDate.xdate) > 0) {
        result.advance(result.start.xdate);
        startMoved = true;
    }
    if (startMoved) {
        // Fix up end date with proper metadata
        result.start = makeDate(result.start.xdate, [origStart], "Moved start date forward to within included period of " + name);
    }

    if(result.end) {
        // Existing end date, move backwards if necessary
        if(lastIncludedDate.xdate.diffMilliseconds(result.end.xdate) > 0) {
            result.end = makeDate(lastIncludedDate.xdate, [result.end, lastIncludedDate], "Moved end date back to within included period of " + name);
        }
    } else {
        // No existing end date, so just set it
        result.end = makeDate(lastIncludedDate.xdate, [lastIncludedDate], "Set end date to end of included period of " + name);
    }

    var exclusions = [];
    // Convert list of inclusions into exclusions, by taking inclusions[N][1] .. inclusions[N+1][0]
    for(var idx = 0; idx < inclusions.length - 1; idx++) {
        /*
        debug("filterDates: Excluding gap between inclusions " +
              inclusions[idx][0].xdate.toString() + "-" + inclusions[idx][1].xdate.toString() +
              " and " +
              inclusions[idx+1][0].xdate.toString() + "-" + inclusions[idx+1][1].xdate.toString());
*/
        exclusions.push([inclusions[idx][1].xdate, inclusions[idx+1][0].xdate, exclusionKind]);
    }

    // It's important that the new exclusions are added to the END of the
    // exclusions list, as multiple dayBefore/dayAfter/skip exclusions may
    // interact in ways that depend on their ordering.
    result.exclusions = result.exclusions.concat(exclusions);

    result.rationale = result.rationale + " (limited to within " + name + ")";

    return result;
}

RepeatingDate.prototype.fitWithinActivity = function(state, activity, name, exclusionKind) {
    var activityInclusions = [];
    var schedule = activity.getSchedule(state);

    for(var index in schedule) {
        // Check schedule is all defined dates
        if (!isValidDate(schedule[index][0])) {
            return makeBrokenRepeatingDate(schedule[index][0], "Cannot compute repeating date that fits in an activity with an unspecified schedule");
        }
        if (!isValidDate(schedule[index][1])) {
            return makeBrokenRepeatingDate(schedule[index][1], "Cannot compute repeating date that fits in an activity with an unspecified schedule");
        }

        // Add schedule to inclusions
        activityInclusions.push(schedule[index]);
    }

    return filterDates(this, activityInclusions, exclusionKind, "activity '" + name + "'");
};

RepeatingDate.prototype.fitWithinCalendar = function(calendar, name, spans, exclusionKind) {
    var inclusions = [];
    for(var index in calendar) {
        var term = calendar[index];

        for(var spanIndex in spans) {
            var span = spans[spanIndex];
            var start = term.anchors[span[0]];
            var end = term.anchors[span[1]];
            if (!start) {
                throw new Error("Anchor " + span[0] + " not found in term " + index + " of " + name);
            }
            if (!end) {
                throw new Error("Anchor " + span[1] + " not found in term " + index + " of " + name);
            }

            inclusions.push([
                makeDate(start, [], span[0] + " in term " + term.name + " of " + name),
                makeDate(end, [], span[1] + " in term " + term.name + " of " + name),
            ]);
        }
    }
    return filterDates(this, inclusions, exclusionKind, "calendar '" + name + "'");
};

////
//// Ruleset interpretation
////

// Evaluate a Rule - rules are functions given access to the state through an
// interface. The return value of the rule is returned.

// This is also where we pass the callback object passed to rule functions - all
// date computation tool functions are exposed to rulesets here!

function describeDelta(n) {
    if (n >= 0) {
        return "Added " + n;
    } else {
        return "Subtracted " + (-n);
    }
}

function evalRule(rule, state, extraArgs) {
    if (typeof rule === "function") {
        // Provide, as argument to the rule function, an object awash with
        // access to read information from the state (read-only, mind!)
        let S = {
            // Date arithmetic
            makeDate: function(x, rationale, inputs) {
                // Note that argument order is different than for the internal
                // makeDate function, purely so that we can be nice to the user
                // about making inputs "more optional" than rationale.
                return makeDate(new XDate(x), inputs || [], rationale || "Hardcoded in ruleset");
            },
            addDays: function(date, x) {
                if (x === 0) {
                    return date;
                }
                if (isValidDate(date)) {
                    var dateClone = new XDate(date.xdate);
                    dateClone.addDays(x);
                    return makeDate(dateClone, [date], describeDelta(x) + " day(s)");
                } else {
                    return date;
                }
            },
            addWeeks: function(date, x) {
                if (x === 0) {
                    return date;
                }
                if (isValidDate(date)) {
                    var dateClone = new XDate(date.xdate);
                    dateClone.addWeeks(x);
                    return makeDate(dateClone, [date], describeDelta(x) + " week(s)");
                } else {
                    return date;
                }
            },
            addMonths: function(date, x) {
                if (x === 0) {
                    return date;
                }
                if (isValidDate(date)) {
                    var dateClone = new XDate(date.xdate);
                    dateClone.addMonths(x);
                    return makeDate(dateClone, [date], describeDelta(x) + " month(s)");
                } else {
                    return date;
                }
            },
            addYears: function(date, x) {
                if (x === 0) {
                    return date;
                }
                if (isValidDate(date)) {
                    var dateClone = new XDate(date.xdate);
                    dateClone.addYears(x);
                    return makeDate(dateClone, [date], describeDelta(x) + " year(s)");
                } else {
                    return date;
                }
            },

            // Duration constructors; see computeActivityDuration for where these are processed
            durationInDays: function(x) {
                return [x, "days"];
            },
            durationInWeeks: function(x) {
                return [x, "weeks"];
            },
            durationInMonths: function(x) {
                return [x, "months"];
            },
            durationInYears: function(x) {
                return [x, "years"];
            },
            durationInTerms: function(x, calendar) {
                return [x, "terms", calendar];
            },
            durationNotApplicable: function() {
                return NOT_APPLICABLE;
            },

            // Calendar tools
            getTermName: function(calendar, term) {
                var cal = state.calendars[calendar];
                if (!cal) {
                    throw new Error("[getTermName] called with unknown calendar " + calendar);
                }
                var t = cal[term];
                if (!t) {
                    return makeErrorDate([], "Calendar " + calendar + " does not have term " + term + " (0-" + (cal.length - 1) + " would work)");
                }
                return t.name;
            },
            getTermDate: function(calendar, term, anchor) {
                var cal = state.calendars[calendar];
                if (!cal) {
                    throw new Error("[getTermDate] called with unknown calendar " + calendar);
                }
                return getTermDate(cal, term, anchor);
            },
            findTermForDate: function(calendar, date) {
                var cal = state.calendars[calendar];
                if (!cal) {
                    throw new Error("[findTermForDate] called with unknown calendar " + calendar);
                }
                return findTerm(cal, date);
            },
            findTermDateBefore: function(calendar, date, anchor) {
                var cal = state.calendars[calendar];
                if (!cal) {
                    throw new Error("[findTermDateBefore] called with unknown calendar " + calendar);
                }
                return findTermDateBefore(cal, date, anchor, calendar);
            },
            findTermDateAfter: function(calendar, date, anchor) {
                var cal = state.calendars[calendar];
                if (!cal) {
                    throw new Error("[findTermDateAfter] called with unknown calendar " + calendar);
                }
                return findTermDateAfter(cal, date, anchor, calendar);
            },
            advanceTerms: function(calendar, date, N, endAnchor) {
                var cal = state.calendars[calendar];
                if (!cal) {
                    throw new Error("[advanceTerms] called with unknown calendar " + calendar);
                }
                return advanceTerms(cal, date, N, endAnchor, calendar);
            },

            // Activities
            getActivityProgressTime: function(activity) {
                return state.activities[activity].getProgressTime(state.now, state);
            },
            getActivityProgressFraction: function(activity) {
                return state.activities[activity] ? state.activities[activity].getProgressFraction(state.now, state) : 0;
            },
            computeActivityEnd: function(activity) {
                return state.activities[activity].computeEnd(state);
            },

            // Repeating dates
            makeRepeatingDate: function(start, interval, intervalKind, end, rationale) {
                return makeRepeatingDate(start, interval, intervalKind, end, rationale || "Hardcoded in ruleset");
            },
            isRepeatingDateValid: function(rd) {
                return rd.isValid();
            },
            getRepeatingDateRationale: function(rd) {
                return rd.getRationale();
            },
            getRepeatingDateOccurence: function(rd, index) {
                return rd.getDate(index);
            },
            mapRepeatingDate: function(rd, mapper) {
                return rd.map(mapper);
            },
            fitRepeatingDateWithinActivity: function(rd, activity, exclusionKind) {
                if (activity in state.activities) {
                    return rd.fitWithinActivity(state, state.activities[activity], activity, exclusionKind);
                } else {
                    throw new Error("fitRepeatingDateWithinActivity: Unknown activity " + activity);
                }
            },

            fitRepeatingDateWithinCalendar: function(rd, calendar, spans, exclusionKind) {
                if (calendar in state.calendars) {
                    return rd.fitWithinCalendar(state.calendars[calendar], calendar, spans, exclusionKind);
                } else {
                    throw new Error("fitRepeatingDateWithinCalendar: Unknown calendar " + calendar);
                }
            },

            // Computed dates
            getDate: function(name) {
                return computeDate(name, state);
            },

            hasFlag: function(flag) {
                return state.flags.indexOf(flag) != -1;
            }
        };

        return rule.apply(
            rule, // Have yourself as "this"
            [S].concat(extraArgs));
    } else {
        // Return literals as-is, as a shorthand for the K combinator
        return rule;
    }
}

// Computed dates

function computeDate(name, state) {
    // Automatically detect recursive loops!
    if (state.computations.indexOf(name) != -1) {
        return makeErrorDate("Infinite loop of date rules detected: " + state.computations.join(" -> ") + " -> " + name);
    }
    state.computations.push(name);

    // Possible performance improvement: cache computeDate() calls for a given
    // name, but we'll need to invalidate the cache after performing any process*
    // call in computeDates, as they may change inputs to dates.

    var result = null;
    if (state.dates[name]) {
        // Already specified
        result = state.dates[name];
    } else if (state.dateRules[name]) {
        // Compute it from a rule
        result = evalRule(state.dateRules[name], state);
    } else {
        // Dunno then, sorry
        result = makeErrorDate("Reference to undefined date/rule " + name);
    }

    state.computations.pop();

    return result;
}

// Log event processors

function processRuleset(state, item) {
    // Keep the old state for evaluating rules that need access to it
    var oldState = state;

    state = _.clone(state);

    // Install latest rules and calendar
    state.dateRules = _.clone(item.dates);
    state.calendars = item.calendars || {};
    state.inputs = item.inputs || [];

    // Add new activities, computing initial progress
    var newActivities = item.addActivities || {};
    var activitiesToInsert = {};
    var generatedRules = {};
    for (var name in newActivities) {
        let newActivity = newActivities[name];

        // IDEA: Check all dates mentioned in newActivity.schedule (if present)
        // are either rules or inputs in this ruleset, to avoid errors later?
        activitiesToInsert[name] = new Activity(name, newActivity.schedule, newActivity.duration, newActivity.scheduleFromCalendar, newActivity.shiftEndDates);

        if(newActivity.transitions) {
            for(let transitionName in newActivity.transitions) {
                let transition = newActivity.transitions[transitionName];
                activitiesToInsert[name].addTransition(transitionName,transition.flagsToAdd || [],transition.flagsToRemove || [], transition.newProgressTime, transition.newProgressFraction);
            }
        }

        // Compute new progress before rescheduling, as generated schedule can depend on progress so far

        // Initial progress is computed in the OLD state
        if (newActivity.initialProgressFraction) {
            let ip = evalRule(newActivity.initialProgressFraction, oldState);
            activitiesToInsert[name].setProgressFraction(ip, state);
        } else if (newActivity.initialProgressTime) {
            let ip = evalRule(newActivity.initialProgressTime, oldState);
            activitiesToInsert[name].setProgressTime(ip, state);
        }

        // Calculate initial schedule, probably mostly empty
        generatedRules = _.extend(generatedRules, activitiesToInsert[name].reschedule(state));
    }

    // Actually insert the activities - this isn't done in the loop above in
    // order to keep the state passed to rules in a consistent form, without a
    // random smattering of new activities present.
    for (name in activitiesToInsert) {
        state.activities[name] = activitiesToInsert[name];
    }

    // Remove old activities
    var oldActivities = item.removeActivities || [];
    oldActivities.forEach(function (name, index) {
        delete state.activities[name];
    });

    if(generatedRules.size !== 0) {
        _.forEach(generatedRules, function(rule, name) {
            let existing = state.dateRules[name];
            if (existing !== undefined) {
                throw new Error("Contradiction: The rule " + name + " has been explicitly defined as " +
                    JSON.stringify(existing) + ", but it is implicitly defined as well");
            }
            state.dateRules[name] = rule;
        });
    }

    return state;
}

function processFlags(state, item) {
    state = _.clone(state);
    state.flags = item.flags;
    return state;
}

function processAddFlags(state, item) {
    state = _.clone(state);
    state.flags = _.union(state.flags, item.flags);
    return state;
}

function processRemoveFlags(state, item) {
    state = _.clone(state);
    state.flags = _.difference(state.flags, item.flags);
    return state;
}

function processActivityTransition(state, item) {
    var originalState = state;
    
    state = _.clone(state);
    var activity = state.activities[item.activity];
    if(!activity) {
        throw new Error("Cannot perform transition on unknown activity " + item.activity);
    }
    var transition = activity.transitions[item.transition];
    if (!transition) {
        throw new Error("Cannot perform unknown transition " + item.transition + " on activity " + item.activity);
    }

    if(transition.flagsToRemove) {
        state.flags = _.difference(state.flags, transition.flagsToRemove);
    }

    if(transition.flagsToAdd) {
        state.flags = _.union(state.flags, transition.flagsToAdd);
    }

    activity.removeGeneratedRules(state);

    // Compute new progress before rescheduling, as generated schedule can depend on progress so far

    // Compute progress time in the original state, as when handling the equivalent in processRuleset
    if (transition.newProgressTime) {
        let newTime = evalRule(transition.newProgressTime, originalState, [item]);
        activity.setProgressTime(newTime, state);
    } else if (transition.newProgressFraction) {
        let newTime = evalRule(transition.newProgressFraction, originalState, [item]);
        activity.setProgressFraction(newTime, state);
    }

    var generatedRules = activity.reschedule(state);

    // Insert generated rules into state
    if(generatedRules.size !== 0) {
        _.forEach(generatedRules, function(rule, name) {
            let existing = state.dateRules[name];
            if (existing !== undefined) {
                throw new Error("Contradiction: The rule " + name + " has been explicitly defined as " +
                    JSON.stringify(existing) + ", but it is implicitly defined as well");
            }
            state.dateRules[name] = rule;
        });
    }

    return state;
}

function processForceProgress(state, item) {
    if (item.progressFraction) {
        state.activities[item.activity].setProgressFraction(item.progressFraction);
    }
    else if (item.progressTime) {
        state.activities[item.activity].setProgressTime(item.progressTime);
    }
    return state;
}

function processUnscheduledStart(state, item) {
    state = _.clone(state);
    let when = item.when;
    if(item.activity) {
        state.activities[item.activity].start(
            makeDate(when, [], "Recorded unscheduled start of activity " + item.activity),
            state
        );
        state.activities[item.activity].resume();
        rescheduleActivity(state, state.activities[item.activity]);
    } else {
        for(let activityName in state.activities) {
            if(!(item.except && item.except.indexOf(activityName) !== -1)) {
                let activity = state.activities[activityName];
                let activityInProgress = activity.getInProgressNow();
                let activityFinished = activity.getProgressFraction(state.now, state) >= 1;
                let activityUnstarted = activity.getProgressFraction(state.now) <= 0;
                if (!activityInProgress && !activityFinished && !activityUnstarted) {
                    activity.start(
                        makeDate(when, [], "Recorded unscheduled start of activity " + activityName),
                        state
                    );
                    activity.resume();
                    rescheduleActivity(state, activity);
                }
            }
        }
    }
    return state;
}

function processUnscheduledStop(state, item) {
    let when = item.when;
    if(item.activity) {
        state.activities[item.activity].stop(
            makeDate(when, [], "Recorded unscheduled stop of activity " + item.activity),
            state
        );
        state.activities[item.activity].suspend();
    } else {
        for(let activityName in state.activities) {
            if(!(item.except && item.except.indexOf(activityName) !== -1)) {
                let activity = state.activities[activityName];
                let activityFinished = activity.getProgressFraction(state.now, state) >= 1;
                if (activity.getInProgressNow() && !activityFinished) {
                    activity.stop(
                        makeDate(when, [], "Recorded unscheduled stop of activity " + activityName),
                        state
                    );
                    activity.suspend();
                }
            }
        }
    }
    return state;
}

function processSetDate(state, item) {
    if (state.inputs.indexOf(item.name) === -1 && !state.dateRules[item.name]) {
        return state; // Not an input or rule, so ignore it
    }

    state.dates[item.name] = makeDate(
        item.date || item.when,
        [],
        "Recorded date of " + item.name + " as of " + item.when.toDateString());
    return state;
}

// Core engine

function describeEvent(logEvent) {
    // Return a short string describing a log item, for use when describing the
    // origin of the date of that item.
    switch(logEvent.type) {
    case "ruleset":
        return "ruleset change";
    case "addFlags":
    case "removeFlags":
    case "flags":
        return "flags change";
    case "forceProgress":
        return "activity progress override";
    case "unscheduledStart":
        return "unscheduled activity start";
    case "unscheduledStop":
        return "unscheduled activity stop";
    case "activityTransition":
        return "activity transition";
    case "setDate":
        return "date override";
    case "sentinel":
        return "end of log";
    default:
        throw new Error("unknown log event " + logEvent.type);
    }
}

// THIS MUTATES THE STATE
function rescheduleActivity(state, activity) {
    activity.removeGeneratedRules(state);

    var generatedRules = activity.reschedule(state);

    // Insert generated rules into state
    if(generatedRules.size !== 0) {
        _.forEach(generatedRules, function(rule, name) {
            let existing = state.dateRules[name];
            if (existing !== undefined) {
                throw "Contradiction: The rule " + name + " has been explicitly defined as " +
                    JSON.stringify(existing) + ", but it is implicitly defined as well";
            }
            state.dateRules[name] = rule;
        });
    }
}

function rescheduleUnstartedActivities(state) {
    // Find all activities that haven't been started yet, and recompute their
    // schedules. This is fine (it's only dangerous to mess with the schedule of
    // a started activity, as we don't know what to do about progress so far
    // without human guidance - that's what the transition mechanism is for),
    // and it means that unstarted "future" activities will always have an
    // update-to-date (draft?) schedule.
    var newState;
    _.each(state.activities, function (activity, activityName) {
        if(!newState) {
            newState = _.clone(state);
        }
        if(activity.intervals.length === 0) {
            activity.removeGeneratedRules(newState);
            rescheduleActivity(newState, activity);
        }
    });
    if(newState) {
        return newState;
    } else {
        return state;
    }
}

function computeDates(log, now, extraDebugCallback) {
    var state = {activities: {}, // Current activities
                 dates: {}, // Know dates set by setDate
                 flags: [], // List of active flags
                 dateRules:{}, // Date computation rules
                 inputs: [], // List of dates expected to be set as inputs
                 calendars: {}, // Defined calendars
                 now: null, // Current point in time
                 computations: []}; // Stack of in-progress date rule computations, used to detect loops

    var dateNow = makeInputDate(now, "current timestamp");

    // Previous value of "now", used to look for scheduled activity start/stops in the interval since the previous event.
    var prevDate = null;

    log = _.clone(log);
    log.push({type: "sentinel",
              when: now.clone().addDays(1),
             });

    log.forEach(function (item, index) {
        if(extraDebugCallback) {
            extraDebugCallback(state, item);
        }

        let logWhen = makeInputDate(item.when, "recorded time of " + describeEvent(item));

        // Process scheduled activity starts/stops from prevDate to the nearest
        // of logWhen and dateNow. But if prevDate isn't set we don't need to do
        // anything, as there'll never BE any scheduled activities before the
        // first event in the log.

        if (prevDate) {
            let activityActions = null;
            if(dateDiff(logWhen, dateNow) < 0) {
                activityActions = findActivityActions(state, prevDate, dateNow);
            } else {
                activityActions = findActivityActions(state, prevDate, logWhen);
            }
            for(let actionIndex in activityActions) {
                let action = activityActions[actionIndex];
                debug("computeDates: Scheduled action at " + describeDate(action.date) + ": " + JSON.stringify(action));
                // We need to check if it's already in progress or not, as
                // unscheduled starts/stops may put the activity in a state that
                // the schedule wasn't expecting.
                if(action.type === "start" && !action.activity.getInProgressNow()) {
                    action.activity.start(action.date, state);
                }
                else if(action.type === "stop" && action.activity.getInProgressNow()) {
                    action.activity.stop(action.date, state);
                }
            }
        }
        prevDate = logWhen;

        // Stop if the next event is in the future

        if (item.type === "sentinel") {
            debug("computeDates: End of log reached, stopping processing");
            return;
        }

        // Advance the clock of history
        state.now = logWhen;

        debug("computeDates: Processing event " + JSON.stringify(item));

        switch(item.type) {
        case "ruleset":
            state = processRuleset(state, item);
            break;
        case "flags":
            state = processFlags(state, item);
            state = rescheduleUnstartedActivities(state);
            break;
        case "addFlags":
            state = processAddFlags(state, item);
            state = rescheduleUnstartedActivities(state);
            break;
        case "removeFlags":
            state = processRemoveFlags(state, item);
            state = rescheduleUnstartedActivities(state);
            break;
        case "activityTransition":
            state = processActivityTransition(state, item);
            break;
        case "forceProgress":
            state = processForceProgress(state, item);
            break;
        case "unscheduledStart":
            state = processUnscheduledStart(state, item);
            break;
        case "unscheduledStop":
            state = processUnscheduledStop(state, item);
            break;
        case "setDate":
            state = processSetDate(state, item);
            state = rescheduleUnstartedActivities(state);
            break;
        default:
            throw new Error("Unknown log item type " + item.type);
        }
    });

    // Compute return value:

    // Viewpoint is "now"
    state.now = dateNow;

    // Work out all dates
    var finalDates = {};
    for(var name in state.dates) {
        finalDates[name] = state.dates[name];
    }
    for(name in state.dateRules) {
        finalDates[name] = computeDate(name, state);
    }

    // Work out final state of all activities
    var finalActivities = {};

    for(name in state.activities) {
        let activity = state.activities[name];
        finalActivities[name] = {
            duration: activity.getDuration(state),
            progressFraction: activity.getProgressFraction(state.now, state),
            progressTime: activity.getProgressTime(state.now, state),
            inProgressNow: activity.getInProgressNow(),
            intervals: activity.intervals,
            overrides: activity.overrides,
            schedule: activity.getSchedule(state)
        };
    }

    return {
        activities: finalActivities,
        flags: state.flags,
        dates: finalDates
    };
}

////
//// Fancy wrapper that's easy for the system to use
////

// computeDates wants a single unified history, but in practice, the history of
// an individual case is a mixture of events unique to them (flags, starts,
// stops, dates, manual progress sets, etc) and events that apply to the
// organisation as a whole (ruleset changes), which come from two different
// sources. THerefore, we need to merge them while preserving date order.

function mergeHistories() {
    // An array of [index, array] pairs for the inputs
    var inputs = _.toArray(arguments).map(function(a) {
        return [0, a];
    });

    // inputs array accessors
    var notEmpty = function(idx) {
        return inputs[idx][0] < inputs[idx][1].length;
    };

    var peekNext = function(idx) {
        return inputs[idx][1][inputs[idx][0]];
    };

    var moveToNext = function(idx) {
        inputs[idx][0]++;
    };

    // a is earlier than b ?
    var logBefore = function(a, b) {
        var aWhen = a.when;
        var bWhen = b.when;
        return aWhen.diffMilliseconds(bWhen) > 0;
    };

    var result = [];

    while(true) {
        let earliest = null;
        let earliestIdx = null;

        // Find next log entry in all inputs
        for(let idx in inputs) {
            if (notEmpty(idx)) {
                if(earliest === null) {
                    // Nab the first
                    earliest = peekNext(idx);
                    earliestIdx = idx;
                } else {
                    // Compare with the earliest so far
                    let next = peekNext(idx);
                    if(logBefore(next, earliest)) {
                        earliest = next;
                        earliestIdx = idx;
                    }
                }
            }
        }

        if (!earliest) {
            // All inputs are empty, we're done
            return result;
        } else {
            // Take the earliest
            result.push(earliest);
            moveToNext(earliestIdx);
        }
        // Back around the while loop to find the next element
    }
    // We never get here, it's an infinite loop with an return-from-function case inside it
}

// A ruleHistory is a log of ruleset changes. We make callers provide them to us
// by them registering a service called haplo:date_rule_engine_2:get_rules_history or
// haplo:date_rule_engine_2:get_rules_history:<SETNAME>.


function getRuleHistory(setName, objectRef) {
    var log = [];
    var lastTimestamp = null;

    // Functions exposed for ruleset building
    var builder = {
        // Stuff that actually makes stuff
        changeRules: function(when, body) {
            if (lastTimestamp !== null && lastTimestamp.diffMilliseconds(when) <= 0) {
                throw new Error("Ruleset changes must be defined in ascending time order");
            }
            lastTimestamp = when;

            var rs = {type: "ruleset",
                      when: when,
                      addActivities: {},
                      removeActivities: [],
                      inputs: [],
                      dates: {},
                      calendars: {}
                     };
            body({
                // Utilities
                makeTerm: makeTerm,

                // Ruleset builders
                addActivity: function(name, config) {
                    rs.addActivities[name] = config;
                },
                removeActivity: function(name) {
                    rs.removeActivities.push(name);
                },
                defineDateRule: function(name, rule) {
                    rs.dates[name] = rule;
                },
                defineCalendar: function(name, terms) {
                    rs.calendars[name] = terms;
                },
                defineInput: function(name) {
                    rs.inputs.push(name);
                }
            });
            log.push(rs);
        },
    };

    [
        "haplo:date_rule_engine_2:get_rules_history",
        "haplo:date_rule_engine_2:get_rules_history:"+setName
    ].forEach(function(name) {
        if(O.serviceImplemented(name)) {
            O.service(name, builder, setName, objectRef);
        }
    });

    if(log.length > 0) {
        return log;
    } else {
        throw new Error("No plugin responded to a request to provide date computation rules for '" + setName + "'");
    }
}

// The top-level plugin entry point

P.implementService("haplo:date_rule_engine_2:compute_dates", function(rulesHistorySetName, log, now, objectRef) {
    // Obtain ruleset history
    var rulesetHistory = getRuleHistory(rulesHistorySetName, objectRef);

    // Merge with object history to get a final history
    var mergedHistory = mergeHistories(rulesetHistory, log);

    // Sanity check it's ordered, as the consequences of a mistake will be weird and subtle
    var previousWhen = null;
    for(var idx in log) {
        let thisWhen = log[idx].when;
        if (previousWhen === null) {
            previousWhen = thisWhen;
        } else {
            // Difference === 0 is fine for simultaneous events, it just can't go back in time.
            if (previousWhen.diffMilliseconds(thisWhen) < 0) {
                throw new Error("Date computation input history is not ordered! First out-of-order log entry found: " + JSON.stringify(log[idx]));
            } else {
                previousWhen = thisWhen;
            }
        }
    }

    // Actually do it
    var result = computeDates(mergedHistory, now);

    return result;
});

////
//// Expose stuff for the test suite to get at
////

P.internals = {
    makeDate: makeDate,
    makeErrorDate: makeErrorDate,
    dateDiff: dateDiff,

    Activity: Activity,

    makeTerm: makeTerm,
    findTerm: findTerm,
    findTermDateBefore: findTermDateBefore,
    findTermDateAfter: findTermDateAfter,
    advanceTerms: advanceTerms,

    isExcluded: isExcluded,
    RepeatingDate: RepeatingDate,
    makeRepeatingDate: makeRepeatingDate,
    filterDates: filterDates,

    computeDates: computeDates,

    mergeHistories: mergeHistories,
    getRuleHistory: getRuleHistory,
};
