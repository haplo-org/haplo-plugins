/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

t.test(function() {
    // Extract test points
    var I = P.internals;

    ////
    //// Test activity progress and ruleset changes, using fixed-duration activities
    ////

    var x = I.computeDates(
        [
            {type: "ruleset",
             when: new XDate(0),
             addActivities: {
                 "thinking": {
                     duration: 1000,
                     initialProgressFraction: 0.1, // 100ms of work
                     schedule: [["start", "stop-thinking"]]
                 },
                 "doing": {
                     duration: function(S) {
                         return 2000;
                     },
                     schedule: [["start", "break_for_easter"],
                                ["return_from_easter", "stop-doing"]]
                 }
             },
             removeActivities: [],
             dates: {
                 "start": function(S) {
                     // Supposed to start at time 5, but we'll override that before it happens
                     return S.makeDate(5);
                 }
                 // stop-thinking and stop-doing get auto-defined
             },
             calendars: {},
             inputs: ["start","break_for_easter","return_from_easter"]
            },
            {type: "setDate", // Override default date before it happens: we start thinking and doing late
             when: new XDate(0),
             date: new XDate(10), // thinking and doing now start here
             name: "start"
            },
            {type: "setDate", // Will have done 20ms of work on doing by then, due to unscheduled stop from 20-30
             when: new XDate(0),
             date: new XDate(40), // doing stops here
             name: "break_for_easter"
            },
            {type: "setDate", // doing restarts at time 50
             when: new XDate(0),
             date: new XDate(50),
             name: "return_from_easter"
            },
            {type: "unscheduledStop", // Done 10ms of work on thinking and doing
             when: new XDate(20) // No activity specified, stops them all
            },
            {type: "unscheduledStart",
             when: new XDate(30),
             except: ["thinking"] // Start doing, but not thinking
            },
            {type: "flags",
             when: new XDate(50),
             flags: ["bonusTime"],
            },
            {type: "ruleset",
             when: new XDate(100), // Done 10ms of thinking plus 100ms of initial progress on thinking plus 70ms of doing
             addActivities: {
                 "combined": {
                     duration: 3000,
                     initialProgressTime: function(S) {
                         var thinking = S.getActivityProgressTime("thinking");
                         var doing = S.getActivityProgressTime("doing");
                         console.log("Combined initial progress: " + thinking + " + " + doing + " + bonus");
                         return thinking + doing +
                             (S.hasFlag("bonusTime")?100:0); // 100+170+10 = 280ms of work done on new "combined" activity
                     },
                     schedule: [["start_combined", "break_begin"],
                                ["break_end", "stop_combined"]]
                 }
             },
             removeActivities: ["thinking", "doing"],
             inputs: ["start_combined"],
             dates: {
                 "break_begin": function(S) {
                     return S.makeDate(1500);
                 },
                 "break_end": function(S) {
                     return S.makeDate(1600);
                 },
                 /* This is automatically generated as we have a fixed duration on the activity that references this as its final date
                    "stop_combined": function(S) {
                    return S.computeActivityEnd("combined");
                    },
                 */
                 "date_arithmetic_test_1": function(S) {
                     return S.addDays(S.makeDate(0), 2);
                 },
                 "date_arithmetic_test_2": function(S) {
                     var d = S.makeDate(0);
                     d = S.addDays(d, 2);
                     d = S.addWeeks(d, 3);
                     d = S.addMonths(d, 4);
                     d = S.addYears(d, 5);
                     d = S.addYears(d, -5);
                     d = S.addMonths(d, -4);
                     d = S.addWeeks(d, -3);
                     d = S.addDays(d, -2);
                     return d;
                 },
                 "calendar_test_1": function(S) {
                     t.assert(S.getTermName("terms", 0) === "Spring 1970");
                     t.assert(S.getTermDate("terms", 0, "furtling_day").xdate.
                              diffMilliseconds(new XDate("1970-04-04T00:00:00Z")) === 0);
                     t.assert(S.findTermForDate("terms", S.makeDate("1970-06-01T00:00:00Z")) === 1);
                     t.assert(S.findTermDateBefore("terms", S.makeDate("1970-06-01T00:00:00Z"), "furtling_day").xdate.
                              diffMilliseconds(new XDate("1970-05-30T00:00:00Z")) === 0);
                     t.assert(S.findTermDateAfter("terms", S.makeDate("1970-06-01T00:00:00Z"), "furtling_day").xdate.
                              diffMilliseconds(new XDate("1970-10-01T00:00:00Z")) === 0);
                     // This value is checked as an output date below
                     return S.advanceTerms("terms", S.makeDate("1970-02-01T00:00:00Z"), 2);
                 }
             },
             calendars: {
                 "terms": [
                     I.makeTerm("Spring 1970", {
                         "start": new XDate("1970-01-01T00:00:00Z"),
                         "furtling_day": new XDate("1970-04-04T00:00:00Z"),
                         "end": new XDate("1970-05-01T00:00:00Z"),
                     }),
                     I.makeTerm("Summer 1970", {
                         "start": new XDate("1970-05-07T00:00:00Z"),
                         "furtling_day": new XDate("1970-05-30T00:00:00Z"),
                         "end": new XDate("1970-06-30T00:00:00Z"),
                     }),
                     I.makeTerm("Autumn 1970", {
                         "start": new XDate("1970-09-01T00:00:00Z"),
                         "furtling_day": new XDate("1970-10-01T00:00:00Z"),
                         "end": new XDate("1970-12-20T00:00:00Z"),
                     })
                 ],
             }
            },
            {type: "setDate",
             when: new XDate(100),
             name: "start_combined",
            },
        ],
        new XDate(1000),
        function(state, item) {
            var when = item.when;
            console.log("TEST DEBUG AT " + when.getMilliseconds());
            for(let ruleName in state.dateRules) {
                console.log("TEST DEBUG RULE " + ruleName);
            }
            for(let activity in state.activities) {
                let a = state.activities[activity];
                console.log("TEST DEBUG ACTIVITY " + activity + ": " + a.getProgressTime(I.makeDate(when, [], "event timestap"), state) + " " + a.getInProgressNow() + " history:" + JSON.stringify(a.intervals) + " schedule:" + JSON.stringify(a.schedule));
            }
            console.log("TEST DEBUG: Now applying " + JSON.stringify(item));
        }
    );

    console.log("RESULT: ", JSON.stringify(x, null, 2));

    t.assert(x.activities.combined.progressTime === 1180); // 280ms of work done before combining activities, as computed above, plus 900ms time passed from start at 100 until time 1000
    t.assert(x.dates.break_begin.xdate.diffMilliseconds(new XDate(1500)) === 0);

    // "combined" had 280ms/3000ms of work done at time 100
    // So 2720ms left to do then; we're now at time 1000, 900ms later, so 1820ms to do
    // 100ms break scheduled at 1500ms
    // So finish around 2920ms
    t.assert(x.activities.combined.schedule[1][1].xdate.diffMilliseconds(new XDate(2920)) === 0);

    // Check date arithmetic
    t.assert(x.dates.date_arithmetic_test_1.xdate.diffMilliseconds(new XDate("1970-01-03T00:00:00.000Z")) === 0);
    t.assert(x.dates.date_arithmetic_test_2.xdate.diffMilliseconds(new XDate("1970-01-01T00:00:00.000Z")) === 0);
    t.assert(x.dates.calendar_test_1.xdate.diffMilliseconds(new XDate("1970-12-20T00:00:00.000Z")) === 0); // End of term 2

    ////
    //// Test computing durations of activities with no set duration, but a fully defined schedule
    ////

    var y = I.computeDates([
        {type: "ruleset",
         when: new XDate(0),
         addActivities: {
             "shirking": {
                 schedule: [["start", "break-begin"],
                            ["break-end", "end"]]
             }
         },
         removeActivities: [],
         inputs: ["registration"],
         dates: {
             "start": function(S) {
                 return S.findTermDateAfter("terms", S.getDate("registration"), "start");
             },
             // We get a 1-week break starting on Furtling Day
             "break-begin": function(S) {
                 return S.findTermDateAfter("terms", S.getDate("start"), "furtling_day");
             },
             "break-end": function(S) {
                 return S.addWeeks(S.getDate("break-begin"), 1);
             },
             "end": function(S) {
                 return S.findTermDateAfter("terms", S.getDate("start"), "end");
             }
         },
         calendars: {
             "terms": [
                 I.makeTerm("Spring 1970", {
                     "start": new XDate("1970-01-01T00:00:00Z"),
                     "furtling_day": new XDate("1970-04-04T00:00:00Z"),
                     "end": new XDate("1970-05-01T00:00:00Z"),
                 }),
                 I.makeTerm("Summer 1970", {
                     "start": new XDate("1970-05-07T00:00:00Z"),
                     "furtling_day": new XDate("1970-05-30T00:00:00Z"),
                     "end": new XDate("1970-06-30T00:00:00Z"),
                 }),
                 I.makeTerm("Autumn 1970", {
                     "start": new XDate("1970-09-01T00:00:00Z"),
                     "furtling_day": new XDate("1970-10-01T00:00:00Z"),
                     "end": new XDate("1970-12-20T00:00:00Z"),
                 })
             ],
         }
        },
        {
            type: "setDate",
            when: new XDate(0),
            name: "registration"
        },
    ], new XDate(1000));

    console.log("RESULT: ", JSON.stringify(y, null, 2));

    // End date minus start date minus one week's break
    t.assert(y.activities.shirking.duration === new XDate("1970-01-01T00:00:00Z").
             diffMilliseconds( new XDate("1970-05-01T00:00:00Z")) - 7*86400*1000);

    ////
    //// Test activity transitions
    ////

    var rules =
        {type: "ruleset",
         when: new XDate(0),
         addActivities: {
             "shirking": {
                 scheduleFromCalendar: {
                     calendar: "terms",
                     intervals: [["start", "end"]],
                     start: function(S) {
                         var registration = S.getDate("registration");
                         var tda = S.findTermDateAfter("terms", registration, "start");
                         return tda;
                     }
                 },
                 duration: function(S) {
                     // 10 (full time) or 20 (part time) days
                     return 86400000 * (S.hasFlag("FT") ? 10 : 20);
                 },
                 transitions: {
                     "helvetica scenario": {
                         // See: https://www.youtube.com/watch?v=RpZ3zYNJ2Tg
                         flagsToAdd: ["FT"],
                         flagsToRemove: ["calcium"],
                         newProgressTime: function(S, args) {
                             // Switch from half time to full time; two half
                             // time days = 1 full time day
                             var previousProgressTime = S.getActivityProgressTime("shirking");
                             t.assert(args.thanksAnts === "thants"); // Check that arbitrary args can be passed through OK
                             console.log("The queen atom has escaped: " + (previousProgressTime / 86400000) + " days elapsed part time, " + (previousProgressTime / (86400000*2)) + " full time equivalent days");
                             return previousProgressTime / 2;
                         }
                     }
                 }
             }
         },
         removeActivities: [],
         inputs: ["registration"],
         dates: {},
         calendars: {
             "terms": [
                 I.makeTerm("Spring 1970", {
                     "start": new XDate("1970-01-01T00:00:00Z"),
                     "end": new XDate("1970-05-01T00:00:00Z"),
                 }),
                 I.makeTerm("Summer 1970", {
                     "start": new XDate("1970-05-07T00:00:00Z"),
                     "end": new XDate("1970-06-30T00:00:00Z"),
                 }),
                 I.makeTerm("Autumn 1970", {
                     "start": new XDate("1970-09-01T00:00:00Z"),
                     "end": new XDate("1970-12-20T00:00:00Z"),
                 })
             ],
         }
        };

    var registration = {
        type: "setDate",
        when: new XDate("1970-04-01T00:00:00Z"),
        name: "registration"
    };

    var calcium = {
        type: "addFlags",
        when: new XDate("1970-04-01T00:00:00Z"),
        flags: ["calcium"],
    };

    var helvetica = {
        type: "activityTransition",
        when: new XDate("1970-05-09T00:00:00Z"),
        activity: "shirking",
        transition: "helvetica scenario",
        thanksAnts: "thants",
    };

    // On the 1st, we have defined the ruleset, set the registration date and
    // set the calcium flag, so the schedule should be updated.
    var z1 = I.computeDates([rules, registration, calcium], new XDate("1970-04-01T00:00:00Z"));
    console.log("RESULT on the 1st: ", JSON.stringify(z1, null, 2));
    t.assert(JSON.stringify(z1.flags) == JSON.stringify(["calcium"]));
    t.assert(z1.activities.shirking.schedule[0][0].xdate.diffMilliseconds(new XDate("1970-05-07T00:00:00.000Z")) === 0);
    t.assert(z1.activities.shirking.schedule[0][1].xdate.diffMilliseconds(new XDate("1970-05-27T00:00:00.000Z")) === 0);

    // On the 8th of March, we've actually started the day before (thereby testing that scheduled start is working)
    var z3 = I.computeDates([rules, registration, calcium], new XDate("1970-05-08T00:00:00Z"));
    console.log("RESULT on the 8th of March: ", JSON.stringify(z3, null, 2));
    t.assert(z3.activities.shirking.intervals[0][0].xdate.diffMilliseconds(new XDate("1970-05-07T00:00:00.000Z")) === 0);

    // On the 9th of March, we've switched to full time; schedule should be updated, but taking account of the day we've already done in part time mode
    var z4 = I.computeDates([rules, registration, calcium, helvetica], new XDate("1970-05-09T00:00:00Z"));
    console.log("RESULT on the 9th of March: ", JSON.stringify(z4, null, 2));
    t.assert(JSON.stringify(z4.flags) == JSON.stringify(["FT"]));
    // Recorded interval should not have changed
    t.assert(z4.activities.shirking.intervals[0][0].xdate.diffMilliseconds(new XDate("1970-05-07T00:00:00.000Z")) === 0);
    // But a day had passed, which is now recorded as an Override as of the 9th
    t.assert(z4.activities.shirking.overrides[0][0].xdate.diffMilliseconds(new XDate("1970-05-09T00:00:00.000Z")) === 0);
    t.assert(z4.activities.shirking.overrides[0][1] === "time");
    t.assert(z4.activities.shirking.overrides[0][2] === 86400000); // 1 day FT-equivalent had passed
    // Schedule now runs from this point in time onwards
    t.assert(z4.activities.shirking.schedule[0][0].xdate.diffMilliseconds(new XDate("1970-05-09T00:00:00.000Z")) === 0);
    // We have done two days part time, then switched to full time, so that should count as one day done out of ten, nine more to go, end should be 05-18
    t.assert(z4.activities.shirking.schedule[0][1].xdate.diffMilliseconds(new XDate("1970-05-18T00:00:00.000Z")) === 0);
});
