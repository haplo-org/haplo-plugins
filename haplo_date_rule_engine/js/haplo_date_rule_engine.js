/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// ----------------------------------------------------------------------

// COMPUTATIONAL ENGINE

function debug() {
    // console.log("DATE ENGINE DEBUG", _.toArray(arguments));
}

// inputDates[dateName] = [start XDate,end XDate]

// rules[dateName] = ["input"] for a date that can only be provided as an input

// rules[dateName] = ["regular", rule] for a regular computed date range

// rules[dateName] = ["period", base dateName, rule] for a 'work period' computed date range

// A rule is either:

// ["date", dateName]

// ["add"/"subtract", interval unit, interval min, interval max, rule]

// ["if", flagName, yay rule, nay rule]

// ["case", [flagName, rule], ...]

// ["and"/"or", rule, ...]

// flags is a list of flagName strings

// state is an internal state, or "false" if there was none previously.

// state[dateName] = an object containing state particular to that date computation.
// state[dateName].periodStart = [start XDate, end XDate] period start range (deprecated)
// state[dateName].periodEnd = [start XDate, end XDate] projected period end range (deprecated)
// state[dateName].periodLengthLeast = The previous (active) length of the period (shortest version)
// state[dateName].periodLengthMost = The previous (active) length of the period (longest version)
// state[dateName].periodFractionLeast = least fraction (periodLastUpdate as a fraction from midpoint of periodStart to midpoint of periodEnd)
// state[dateName].periodFractionMost = most fraction (periodLastUpdate as a fraction from midpoint of periodStart to midpoint of periodEnd)
// state[dateName].periodLastUpdated = XDate periodTimeUsed last calculated

// outputDates[dateName] = [start XDate,end XDate <,problem string>]

// -- and outputDate is marked with a "problem" if the rules or
// -- inputs contradicted matters, in which case we get a best guess.

function computeDates(now, inputDates, rules, flags, state, suspensions) {
    // Make fresh copies of stuff we will mutate
    var outputDates = _.clone(inputDates);

    if(state) {
        state = _.clone(state);
    } else {
        state = {};
    }

    // Make sure every date is computed computeDate doesn't recompute
    // a date if it's already done, so dates from the inputs will be
    // left alone.  Also, some dates depend on others so cause a
    // recursive call to computeDate which may mean that some dates
    // are already computed by the time we get to them by iterating
    // through the rules, and that's OK.
    _.each(rules, function(rule, dateName) {
        computeDate(now, outputDates, rules, flags, state, suspensions, dateName);
    });
    return {outputDates:outputDates, state:state};
}

// Make the engine available to the test suite
P.computeDates = computeDates;

// +ve if d1 > d2
// -ve if d1 < d2
// Similar to d1 - d2, if they were just numbers
function datediff(d1, d2) {
    return d2.diffMilliseconds(d1);
}

function datemin(d1, d2) {
    if(datediff(d1,d2)<0) {
        return d1;
    } else {
        return d2;
    }
}

function datemax(d1, d2) {
    if(datediff(d1,d2)<0) {
        return d2;
    } else {
        return d1;
    }
}

function datemean(d1, d2) {
    var delta = d1.diffMilliseconds(d2);
    return d1.clone().addMilliseconds(delta/2);
}

function error_date_range(message) {
    return [undefined, undefined, message];
}

function null_date_range() {
    return [undefined, undefined];
}

function make_date_range(earliest, latest, problem) {
    if(datediff(earliest,latest) > 0) {
        latest = earliest;
        problem = "Date had to be guessed, due to a conflict";
    }

    if(problem) {
        return [earliest, latest, problem];
    } else {
        return [earliest, latest];
    }
}

function midpoint(date_range) {
    var earliest = date_range[0];
    var latest = date_range[1];

    return datemean(earliest, latest);
}

// Dates engine carries out floating point arithmetic, and so results need rounding to prevent precision loss
// causing confusing outputs. We are unlikely to need times with more than minute level precision.
function roundToNearestMinute(date) {
    var xdate = new XDate(date);
    var seconds = xdate.getSeconds();
    var minutes = xdate.getMinutes();
    if(seconds > 29) {
        xdate.setMinutes(minutes+1);
    }
    xdate.setSeconds(0);
    xdate.setMilliseconds(0);
    return xdate;
}

// Compute a given date from the rules, if it's not already known
// (either by being an input date, or by having been computed already.
function computeDate(now, dates, rules, flags, state, suspensions, dateName) {
    if(dateName === "undefined") {
        dates[dateName] = null_date_range();
        return;
    }
    var rule = rules[dateName];
    if(!rule) {
        dates[dateName] = error_date_range("Date '" + dateName + "' does not have a computation rule");
        return;
    }
    var ruleKind = rule[0];
    if(!(dates[dateName])) {
        debug("Compute date ", dateName);

        // This is to avoid recursive rule loops
        dates[dateName] = error_date_range("The rule for date '" + dateName + "' refers back to itself");

        if(ruleKind === "input") {
            // We expected this to exist as an input, but it's not here.
            // Uhoh!
            dates[dateName] = error_date_range("Missing input date: '" + dateName + "'");
        } else if(ruleKind === "regular") {
            dates[dateName] = computeRegularDate(now, dates, rules, flags, state, suspensions, dateName, rule[1]);
        } else if(ruleKind === "period") {
            dates[dateName] = computePeriodDate(now, dates, rules, flags, state, suspensions, dateName, rule[1], rule[2]);
        } else {
            dates[dateName] = error_date_range("Malformed rule " + JSON.stringify(rule));
        }
    }
}

function add_interval(base_date, direction, unit, min_interval, max_interval, range_size) {
    debug("Add ", direction, unit, min_interval, max_interval, " to ", base_date);

    var earliest = base_date[0].clone();
    var latest = base_date[1].clone();
    var problem = base_date[2];

    switch (range_size) {
        case "min":
            // The intervals added to earliest and latest should be the opposite way around from the default 
            // if we want the smallest possible range, rather than the largest
            var interval_holder = min_interval;
            min_interval = max_interval;
            max_interval = interval_holder;
            break;
        case "requiredMin":
            latest = base_date[0].clone();
            break;
        case "requiredMax":
            earliest = base_date[1].clone();
            break;
        default:
        case "max":
            break;
    }

    if(unit === "years" || unit === "year") {
        if(direction>0) {
            earliest.addYears(min_interval);
            latest.addYears(max_interval);
        } else {
            earliest.addYears(-max_interval);
            latest.addYears(-min_interval);
        }
    } else if(unit === "months" || unit === "month") {
        if(direction>0) {
            earliest.addMonths(min_interval, true);
            latest.addMonths(max_interval, true);
        } else {
            earliest.addMonths(-max_interval, true);
            latest.addMonths(-min_interval, true);
        }
    } else if(unit === "weeks" || unit === "week") {
        if(direction>0) {
            earliest.addWeeks(min_interval);
            latest.addWeeks(max_interval);
        } else {
            earliest.addWeeks(-max_interval);
            latest.addWeeks(-min_interval);
        }
    } else if(unit === "days" || unit === "day") {
        if(direction>0) {
            earliest.addDays(min_interval);
            latest.addDays(max_interval);
        } else {
            earliest.addDays(-max_interval);
            latest.addDays(-min_interval);
        }
    } else {
        problem = "Unknown interval unit " + unit;
    }

    debug("Result is", earliest, latest, problem);

    earliest = roundToNearestMinute(earliest);
    latest = roundToNearestMinute(latest);
    if(range_size === "min" &&
        datediff(earliest, latest) > 0) {
        // If min range is specified, we probably still want the smallest possible range, even if it is negative
        // To avoid failing when making date range, pass earliest and latest into the opposite parameters
        return make_date_range(latest, earliest, problem);
    }

    return make_date_range(earliest, latest, problem);
}

function intersection(i1, i2) {
    var earliest1 = i1[0];
    var latest1 = i1[1];
    var earliest2 = i2[0];
    var latest2 = i2[1];
    var problem = i1[2] || i2[2];

    var earliest = datemax(earliest1,earliest2);
    var latest = datemin(latest1,latest2);

    debug("Intersection", i1, " with ", i2, " -> ", [earliest,latest,problem]);
    return make_date_range(earliest, latest, problem);
}

function union(i1, i2) {
    var earliest1 = i1[0];
    var latest1 = i1[1];
    var earliest2 = i2[0];
    var latest2 = i2[1];
    var problem = i1[2] || i2[2];

    var earliest = datemin(earliest1,earliest2);
    var latest = datemax(latest1,latest2);

    debug("Union", i1, " with ", i2, " -> ", [earliest,latest,problem]);
    return make_date_range(earliest, latest, problem);
}

function computeRegularDate(now, dates, rules, flags, state, suspensions, dateName, body) {
    debug("Compute Regular Date ", body);
    var nodeKind = body[0];

    // The JS linter dislikes local declarations within if arms.
    var unit;
    var min_interval;
    var max_interval;
    var rule;
    var range_size;
    var base_date;
    var flag;
    var yay;
    var nay;
    var result;
    var next;
    var idx;

    if(nodeKind === "date") { // ["date", dateName]
        computeDate(now, dates, rules, flags, state, suspensions, body[1]);
        return dates[body[1]];
    } else if(nodeKind === "add") { // ["add", interval unit, interval min, interval max, rule]
        unit = body[1];
        min_interval = body[2];
        max_interval = body[3];
        rule = body[4];
        range_size = body[5];
        base_date = computeRegularDate(now, dates, rules, flags, state, suspensions, dateName, rule);
        if(!base_date[0]) {
            return error_date_range("Not enough inputs to calculate "+dateName);
        }
        return add_interval(base_date, +1, unit, min_interval, max_interval, range_size);
    } else if(nodeKind === "subtract") { // ["subtract", interval unit, interval min, interval max, rule]
        unit = body[1];
        min_interval = body[2];
        max_interval = body[3];
        rule = body[4];
        range_size = body[5];
        base_date = computeRegularDate(now, dates, rules, flags, state, suspensions, dateName, rule);
        if(!base_date[0]) {
            return error_date_range("Not enough inputs to calculate "+dateName);
        }
        return add_interval(base_date, -1, unit, min_interval, max_interval, range_size);
    } else if(nodeKind === "if") { // ["if", flag, yay rule, nay rule]
        flag = body[1];
        yay = body[2];
        nay = body[3];
        if(flags.indexOf(flag) != -1) {
            return computeRegularDate(now, dates, rules, flags, state, suspensions, dateName, yay);
        } else {
            return computeRegularDate(now, dates, rules, flags, state, suspensions, dateName, nay);
        }
    } else if(nodeKind === "case") { // ["case", [flag, rule], ...]
        var flags_tried = [];
        for(idx = 1; idx < body.length; idx++) {
            flag = body[idx][0];
            yay = body[idx][1];
            if(flag === "ELSE" || flags.indexOf(flag) != -1) {
                return computeRegularDate(now, dates, rules, flags, state, suspensions, dateName, yay);
            }
            flags_tried.push(flag);
        }
        return error_date_range("None of these cases match a flag: " + JSON.stringify(flags_tried) + " (current flags are " + JSON.stringify(flags) + ")");
    } else if(nodeKind === "and") { // ["and", rule, ...]
        result = computeRegularDate(now, dates, rules, flags, state, suspensions, dateName, body[1]); // First rule
        debug("AND input", result);
        for(idx = 2; idx < body.length; idx++) {
            next = computeRegularDate(now, dates, rules, flags, state, suspensions, dateName, body[idx]);
            debug("AND input", next);
            result = intersection(result, next);
        }
        return result;
    } else if(nodeKind === "or") { // ["or", rule, ...]
        result = computeRegularDate(now, dates, rules, flags, state, suspensions, dateName, body[1]); // First rule
        debug("OR input", result);
        for(idx = 2; idx < body.length; idx++) {
            next = computeRegularDate(now, dates, rules, flags, state, suspensions, dateName, body[idx]);
            debug("OR input", next);
            result = union(result, next);
        }
        return result;
    } else {
        return error_date_range("Unknown rule expression type " + body);
    }
}

function computePeriodDate(now, dates, rules, flags, state, suspensions, dateName, periodOrigin, body) {
    debug("Compute Period Date ", body, " from ", periodOrigin);
    var problem = false;

    // Compute current startpoint
    debug("Compute Period Date startpoint");
    computeDate(now, dates, rules, flags, state, suspensions, periodOrigin);
    problem = dates[periodOrigin][2] || problem;

    // Compute current endpoints

    debug("Compute Period Date endpoint");
    if(!dates[periodOrigin][0]) {
        debug("Period start input not defined");
        return error_date_range("Period start input not defined - "+dateName);
    }
    var periodStart = midpoint(dates[periodOrigin]);
    if(dates[periodOrigin][0].diffDays(dates[periodOrigin][1]) !== 0) {
        problem = "Start date is not definite, so period end is approximate";
    }
    var periodEndRange = computeRegularDate(now, dates, rules, flags, state, suspensions, dateName, body);
    problem = periodEndRange[2] || problem;

    debug("Period is now from ", periodStart, " to ", periodEndRange);

    if(!periodEndRange[0] || !periodEndRange[1]) {
        return null_date_range();
    }

    // Set up state, if none already exists
    if(!state[dateName]) {
        debug("No previous state exists - setting up state");
        state[dateName] = {
            periodLengthLeast: periodStart.diffDays(periodEndRange[0]),
            periodLengthMost: periodStart.diffDays(periodEndRange[1]),
            periodFractionLeast: 0.0,
            periodFractionMost: 0.0,
            periodLastUpdated: periodStart
        };
    }

    var s = state[dateName];

    debug("Duration of period was ", s.periodLengthLeast, "-", s.periodLengthMost, "Fraction used:", s.periodFractionLeast, s.periodFractionMost);

    // This is how much time has elapsed since the last update
    var timeElapsed = s.periodLastUpdated.diffDays(now);
    debug("Time elapsed since last update is ", timeElapsed);

    // Remove any parts of the elapsed period that overlap with a suspension
    _.each(suspensions, (suspension) => {
        var suspendedPeriod = intersection(suspension, [s.periodLastUpdated, now]);
        var difference = suspendedPeriod[0].diffDays(suspendedPeriod[1]);
        if(!suspendedPeriod[2]) {
            timeElapsed = timeElapsed - difference;
        }
    });

    var fractionElapsedLeast = timeElapsed / s.periodLengthLeast;
    var fractionElapsedMost = timeElapsed / s.periodLengthMost;

    debug("Period fraction elapsed since last update = ", fractionElapsedLeast, "-", fractionElapsedMost);

    // Sanity check
    if(fractionElapsedLeast < 0.0) {
        // We are before the start time
        fractionElapsedLeast = 0.0;
    }
    if(fractionElapsedMost < 0.0) {
        // We are before the start time
        fractionElapsedMost = 0.0;
    }

    // Update state with elapsed time
    s.periodFractionLeast = s.periodFractionLeast + fractionElapsedLeast;
    s.periodFractionMost = s.periodFractionMost + fractionElapsedMost;

    var activeElapsedLeast = s.periodLengthLeast * s.periodFractionLeast;
    var activeElapsedMost = s.periodLengthMost * s.periodFractionMost;

    // Sanity check
    if(s.periodFractionLeast < 0.0) {
        // This should never happen, but just in case the state
        // gets corrupted...
        s.periodFractionLeast = 0.0;
    }
    if(s.periodFractionLeast > 1.0) {
        // Completed periods aren't a problem
        s.periodFractionLeast = 1.0;
    }

    if(s.periodFractionMost < 0.0) {
        // This should never happen, but just in case the state
        // gets corrupted...
        s.periodFractionMost = 0.0;
    }
    if(s.periodFractionMost > 1.0) {
        // Completed periods aren't a problem
        s.periodFractionMost = 1.0;
    }

    debug("Current period usage = ", s.periodFractionLeast, "-", s.periodFractionMost);

    // Compute predicted end time based on fraction of CURRENT duration
    var newDurationLeast = periodStart.diffDays(periodEndRange[0]);
    var timeRemainingLeast = newDurationLeast * (1.0 - s.periodFractionLeast);
    var newEndLeast = (timeRemainingLeast>0) ?
        now.clone().addDays(timeRemainingLeast) :
        periodEndRange[0];
    s.periodLengthLeast = activeElapsedLeast + timeRemainingLeast;

    debug("Earliest end: duration = ", newDurationLeast, "(", periodStart, "-", periodEndRange[0], "), time remaining = ", timeRemainingLeast, " new end = ", newEndLeast);

    var newDurationMost = periodStart.diffDays(periodEndRange[1]);
    var timeRemainingMost = newDurationMost * (1.0 - s.periodFractionMost);
    var newEndMost = (timeRemainingMost>0) ?
        now.clone().addDays(timeRemainingMost) :
        periodEndRange[1];
    s.periodLengthMost = activeElapsedMost + timeRemainingMost;

    debug("Latest end: duration = ", newDurationMost, "(", periodStart, "-", periodEndRange[1], "), time remaining = ", timeRemainingMost, " new end = ", newEndMost);

    // Changes to the periods can, in some cases, cause the least and
    // most to get swapped around (eg, test case "period 3 (double
    // period)" which doubles the period once the minimum period has
    // already expired, so ensure the order now

    var temp1 = datemin(newEndLeast, newEndMost);
    newEndMost = datemax(newEndLeast, newEndMost);
    newEndLeast = temp1;

    newEndLeast = roundToNearestMinute(newEndLeast);
    newEndMost = roundToNearestMinute(newEndMost);

    _.each(suspensions, (suspension) => {
        //Length of time from start of suspension to end
        var suspensionLength = suspension[0].diffDays(suspension[1]);
        //If suspension ends after now
        if(now.diffDays(suspension[1]) > 0) {
            // if suspension starts before now
            if(now.diffDays(suspension[0]) < 0) {
                // suspensions length is from now to the end of suspension
                suspensionLength = now.diffDays(suspension[1]);
            }
            debug("Adding suspension with length", suspensionLength, "days. Starts:", suspension[0], "Ends:", suspension[0]);
            // if most recently calculated end least is after (or the same day as) the start of the suspension
            if(newEndLeast.diffDays(suspension[0]) <= 0) {
                newEndLeast.addDays(suspensionLength);
            }
            // if most recently calculated end most is after (or the same day as) the start of the suspension
            if(newEndMost.diffDays(suspension[0]) <= 0) {
                newEndMost.addDays(suspensionLength);
            }
        }
    });

    var newEnd;
    if(problem) {
        newEnd = [newEndLeast,newEndMost,problem];
    } else {
        newEnd = [newEndLeast,newEndMost];
    }

    debug("Period new endpoint = ", newEnd);

    // Update state with metadata
    s.periodLastUpdated = now;

    return newEnd;
}

// ----------------------------------------------------------------------

// PLUGIN SERVICE INTERFACE WRAPPER

var ruleSets = {};

// Input language:

// <date name>
// {add/subtract: <duration>, to/from: <rule>}
// {if: <flag>, then: <rule>, else: <rule>}
// {case: [{<flag>: <rule>}, ...]}
// {and/or: [<rule>, ...]}

// Output language is as per rule definition in comments for
// calculateDates function above.

function compileRule(rule) {
    if(typeof rule === "string") {
        return ["date", rule];
    } else if(typeof rule === "object") {
        if(rule.add && rule.to) {
            return ["add", rule.add[0], rule.add[1], rule.add[2], compileRule(rule.to), rule.range_size || null];
        }
        else if(rule.subtract && rule.from) {
            return ["subtract", rule.subtract[0], rule.subtract[1], rule.subtract[2], compileRule(rule.from), rule.range_size || null];
        }
        else if(rule["if"] && rule.then && rule["else"]) {
            return ["if", rule["if"], compileRule(rule["then"]), compileRule(rule["else"])];
        }
        else if(rule["case"]) {
            return ["case"].concat(_.map(rule["case"], function(val) {
                // {<flag>: <rule>} -> [<flag>, <rule>]
                var flag = _.keys(val)[0];
                var rule = val[flag];
                return [flag, compileRule(rule)];
            }));
        } else if(rule.and) {
            return ["and"].concat(_.map(rule.and, compileRule));
        } else if(rule.or) {
            return ["or"].concat(_.map(rule.or, compileRule));
        } else {
            throw new Error("Unknown date rule form " + rule);
        }
    } else {
        throw new Error("Unknown date rule form " + rule);
    }
}

function getRuleset(setName) {
    if(ruleSets[setName]) {
        return ruleSets[setName];
    }

    var rs = false;
    function ensureValid(name) {
        if(!rs) {
            rs = {};
        }
        if(name === "undefined") {
            throw new Error("undefined is a keyword, and cannot be used as a date name");
        }
        if(rs[name]) {
            throw new Error("Date engine rule " + name + " is defined more than once in " + setName);
        }
    }

    var builder = {
        // Rule builders

        input: function(name) {
            ensureValid(name);
            rs[name] = ["input"];
            debug(setName, "bound", name, "as an input");
        },

        dateRule: function(name, rule) {
            ensureValid(name);
            rs[name] = ["regular", compileRule(rule)];
            debug(setName, "bound", name, "to regular rule", rs[name][1]);
            rs[name+":previous"] = ["input"];
            debug(setName, "bound", name+":previous", "as an input");
        },

        periodEndRule: function(name, startDate, rule) {
            ensureValid(name);
            rs[name] = ["period", startDate, compileRule(rule)];
            debug(setName, "bound", name, "to period rule", rs[name][1], "from", startDate);
        },

        // Period constructors

        years: function(min, max) {
            if(min>max) {
                throw new Error("Minimum year count must be no more than the the maximum in R.years(" + min + "," + max + ")");
            }
            return ["years", min, max];
        },

        months: function(min, max) {
            if(min>max) {
                throw new Error("Minimum month count must be no more than the the maximum in R.months(" + min + "," + max + ")");
            }
            return ["months", min, max];
        },

        weeks: function(min, max) {
            if(min>max) {
                throw new Error("Minimum week count must be no more than the the maximum in R.week(" + min + "," + max + ")");
            }
            return ["weeks", min, max];
        },

        days: function(min, max) {
            if(min>max) {
                throw new Error("Minimum day count must be no more than the the maximum in R.days(" + min + "," + max + ")");
            }
            return ["days", min, max];
        }
    };

    [
        "haplo:date_rule_engine:get_rules",
        "haplo:date_rule_engine:get_rules:"+setName
    ].forEach(function(name) {
        if(O.serviceImplemented(name)) {
            O.service(name, builder, setName);
        }
    });

    if(rs) {
        ruleSets[setName] = rs;
        return rs;
    } else {
        throw new Error("No plugin responded to a request to provide date computation rules for '" + setName + "'");
    }
}

var computeDatesForRuleset = function(inputDates, rulesetName, flags, state, suspensions) {
    debug("Input dates: ", inputDates);
    var rules = getRuleset(rulesetName);
    var now = new XDate();

    if(inputDates["$$$TEST_OVERRIDE_CURRENT_DATE$$$"]) {
        now = inputDates["$$$TEST_OVERRIDE_CURRENT_DATE$$$"];
    }
    // Ensures dates passed in are XDates
    var massagedInputDates = {};
    _.each(inputDates, function(dates, name) {
        massagedInputDates[name] = [];
        for(var i = 0; i < dates.length; i++) {
            massagedInputDates[name][i] = (dates[i] ? new XDate(dates[i]) : undefined);
        }
    });

    //Clean up the suspensions
    suspensions = _.chain(suspensions).
                    map((s) => [new XDate(s[0]), new XDate(s[1])]).
                    map((s) => s[0].diffDays(s[1]) < 0 ? [s[1], s[0]] : s).
                    sortBy((s) => s[0]).
                    value();

    var groupedSuspensions = [];
    for(var i = 0; i < suspensions.length; i++) {
        var suspension = suspensions[i];
        if(groupedSuspensions.length > 0) {
            var latestSuspension = groupedSuspensions[groupedSuspensions.length - 1];
            if(latestSuspension[1].diffDays(suspension[0]) <= 0) {
                var newSuspensionPeriod = union(latestSuspension, suspension);
                groupedSuspensions.pop();
                suspension = newSuspensionPeriod;
            }
        }
        groupedSuspensions.push(suspension);
    }

    return computeDates(now, massagedInputDates, rules, flags, state, groupedSuspensions);
};

var getOutputDates = function(inputDates, inputState, rulesetName, object, flags, existingState, suspensions) {
    var result = computeDatesForRuleset(inputDates, rulesetName, flags, inputState, suspensions);
    if(existingState) {
        existingState.state = result.state;
        existingState.save();
    } else {
        P.db.state.create({
            rulesetName: rulesetName,
            object: object,
            state: result.state
        }).save();
    }
    return result.outputDates;
};

//Update dates claculates the new dates, and saves the new state. Compute dates calculates the new dates, but leaves the state untouched.

P.implementService("haplo:date_rule_engine:update_dates", function(inputDates, rulesetName, flags, suspensions, object) {
    var state = {};
    var stateQuery = P.db.state.select().where("object", "=", object).where("rulesetName", "=", rulesetName);
    if(stateQuery.length) {
        state = deserialiseState(stateQuery[0].state);
    }
    return getOutputDates(inputDates, state, rulesetName, object, flags, stateQuery[0], suspensions);
});

P.implementService("haplo:date_rule_engine:compute_dates", function(inputDates, rulesetName, flags, suspensions, object) {
    var state = {};
    var stateQuery = P.db.state.select().where("object", "=", object).where("rulesetName", "=", rulesetName);
    if(stateQuery.length) {
        state = deserialiseState(stateQuery[0].state);
    }
    return computeDatesForRuleset(inputDates, rulesetName, flags, state, suspensions).outputDates;
});

// Use WITH CAUTION to correct calculations for periodEndRules
// Ignores previous state for this calculation. This allows data to be corrected, but
// also wipes previous state information (which may not be desired)
P.implementService("haplo:date_rule_engine:update_dates_ignoring_previous_state", function(inputDates, rulesetName, flags, suspensions, object) {
    var stateQuery = P.db.state.select().where("object", "=", object).where("rulesetName", "=", rulesetName);
    return getOutputDates(inputDates, {}, rulesetName, object, flags, stateQuery[0], suspensions);
});

P.implementService("haplo:date_rule_engine:compute_dates_ignoring_previous_state", function(inputDates, rulesetName, flags, suspensions, object) {
    return computeDatesForRuleset(inputDates, rulesetName, flags, {}, suspensions).outputDates;
});

// ----------------------------------------------------------------------
// state[dateName] = an object containing state particular to that date computation.
// state[dateName].periodStart = [start XDate, end XDate] period start range
// state[dateName].periodEnd = [start XDate, end XDate] projected period end range
// state[dateName].periodFractionLeast = least fraction (periodLastUpdate as a fraction from midpoint of periodStart to midpoint of periodEnd)
// state[dateName].periodFractionMost = most fraction (periodLastUpdate as a fraction from midpoint of periodStart to midpoint of periodEnd)
// state[dateName].periodLastUpdated = XDate periodTimeUsed last calculated

var deserialiseState = function(serialised) {
    var deserialised = {};
    _.each(serialised, function(s, dateName) {
        deserialised[dateName] = {};
        _.each(s, function(value, key) {
            switch(key) {
                case "periodFractionLeast":
                case "periodFractionMost":
                case "periodLengthLeast":
                case "periodLengthMost":
                    deserialised[dateName][key] = value;
                    break;
                case "periodStart":
                case "periodLastUpdated":
                    deserialised[dateName][key] = new XDate(value);
                    break;
                case "periodEnd":
                    deserialised[dateName][key] = [new XDate(value[0]), new XDate(value[1])];
                    break;
                default:
                    throw new Error("Unexpected key in state object: "+key);
            }
        });
        if(!deserialised[dateName].periodLengthLeast && "periodStart" in deserialised[dateName] && "periodEnd" in deserialised[dateName]) {
            if(!("periodLengthLeast" in deserialised[dateName])) {
                deserialised[dateName].periodLengthLeast = deserialised[dateName].periodStart.diffDays(deserialised[dateName].periodEnd[0]);
            }
            if(!("periodLengthMost" in deserialised[dateName])) {
                deserialised[dateName].periodLengthMost = deserialised[dateName].periodStart.diffDays(deserialised[dateName].periodEnd[1]);
            }
        }
    });
    debug("Deserialised state: ",deserialised);
    return deserialised;
};

P.db.table("state", {
    rulesetName: {type: "text"},
    object: {type: "ref"},
    state: {type: "json"}
});
