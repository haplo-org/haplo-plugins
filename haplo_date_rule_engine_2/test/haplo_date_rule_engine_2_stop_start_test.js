/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

function checkDate(got, expected) {
    if (expected) {
        if (got.xdate) {
            if (got.xdate.getTime() === new XDate(expected).getTime()) {
                t.assert(true);
            } else {
                console.log("Expected " + expected + ", got " + got.xdate.getTime() + " / " + got.rationale);
                t.assert(false);
            }
        } else {
            console.log("Expected " + expected + ", got error " + JSON.stringify(got));
            t.assert(false);
        }
    } else {
        if (got && got.xdate) {
            console.log("Expected invalid date, got " + JSON.stringify(got));
            t.assert(false);
        } else {
            t.assert(true);
        }
    }
}

t.test(function() {
    // Extract test points
    var I = P.internals;

    ////
    //// Test activity progress and ruleset changes, using fixed-duration activities
    ////

    var x = I.computeDates([
        {type: "ruleset",
         when: new XDate(0),
         addActivities: {
             "thinking": {
                 duration: 1000,
                 schedule: [["start-thinking", "stop-thinking"]]
             },
             "doing": {
                 duration: 1000,
                 schedule: [["start-doing", "stop-doing"]]
             }
         },
         removeActivities: [],
         dates: {
         },
         calendars: {},
         inputs: ["start-thinking","start-doing"]
        },
        {type: "setDate", // Start doing
         when: new XDate(10),
         name: "start-doing"
        },
        {type: "unscheduledStop", // Done 10ms of work
         when: new XDate(20) // No activity specified, stops them all (just doing was active)
        },
        {type: "setDate", // Start thinking
         when: new XDate(30),
         name: "start-thinking"
        },
        {type: "unscheduledStart",
         when: new XDate(40) // Start doing, but not thinking as it's already started
        },
        {type: "unscheduledStop",
         when: new XDate(50) // Stop both
        },
        {type: "unscheduledStart",
         when: new XDate(60) // Start both
        },
        {type: "unscheduledStop",
         when: new XDate(70), // Stop thinking
         activity: "thinking"
        },
        {type: "unscheduledStop",
         when: new XDate(80) // Stop doing
        },
        {type: "unscheduledStart",
         when: new XDate(90), // Start thinking
         activity: "thinking"
        },
        {type: "unscheduledStart",
         when: new XDate(100), // Start doing
         except: ["thinking"]
        },
        {type: "unscheduledStop",
         when: new XDate(110), // Stop doing
         except: ["thinking"]
        },

    ], new XDate(1000));

    var thinkingIntervals = x.activities.thinking.intervals;
    console.log("THINKING: ", JSON.stringify(thinkingIntervals, null, 2));
    t.assert(thinkingIntervals.length === 3);
    checkDate(thinkingIntervals[0][0], 30);
    checkDate(thinkingIntervals[0][1], 50);
    checkDate(thinkingIntervals[1][0], 60);
    checkDate(thinkingIntervals[1][1], 70);
    checkDate(thinkingIntervals[2][0], 90);
    checkDate(thinkingIntervals[2][1], null);

    var doingIntervals = x.activities.doing.intervals;
    console.log("DOING: ", JSON.stringify(doingIntervals, null, 2));
    t.assert(doingIntervals.length === 4);
    checkDate(doingIntervals[0][0], 10);
    checkDate(doingIntervals[0][1], 20);
    checkDate(doingIntervals[1][0], 40);
    checkDate(doingIntervals[1][1], 50);
    checkDate(doingIntervals[2][0], 60);
    checkDate(doingIntervals[2][1], 80);
    checkDate(doingIntervals[3][0], 100);
    checkDate(doingIntervals[3][1], 110);
});
