/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

function makeTestDate(ms) {
    return P.internals.makeDate(new XDate(ms), [], "Test input");
}

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
        if (got.xdate) {
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


    var testCalendar =
        [
            I.makeTerm("A", {
                "start": new XDate(0),
                "break_begin": new XDate(10),
                "break_end": new XDate(20),
                "end": new XDate(30),
            }),
            I.makeTerm("B", {
                "start": new XDate(100),
                "break_begin": new XDate(110),
                "break_end": new XDate(120),
                "end": new XDate(130),
            }),
            I.makeTerm("C", {
                "start": new XDate(200),
                "break_begin": new XDate(210),
                "break_end": new XDate(220),
                "end": new XDate(230),
            }),
            I.makeTerm("D", {
                "start": new XDate(300),
                "break_begin": new XDate(310),
                "break_end": new XDate(320),
                "end": new XDate(330),
            })
        ];

    //// Test defined end
    
    var x = new I.Activity("shirking", null);
    var xRules = x.computeScheduleFromCalendar(
        "Test X",
        testCalendar,
        [["start", "break_begin"],
         ["break_end", "end"]],
        makeTestDate(25), // start in middle of second span, to test spans being skipped before start, and straddling start.
        makeTestDate(125), // end in middle of span, to test straddling.
        null); // duration unspecified, as we have an end date
    
    var xSchedule = x.getSchedule({computations: [], dates: {}, dateRules: xRules});

    t.assert(xSchedule.length === 3);
    
    checkDate(xSchedule[0][0], 25); // Remnants of second half-term of term 1
    checkDate(xSchedule[0][1], 30);
    
    checkDate(xSchedule[1][0], 100); // First half of term 2
    checkDate(xSchedule[1][1], 110);
    
    checkDate(xSchedule[2][0], 120); // Part of second half of term 2
    checkDate(xSchedule[2][1], 125);

    //// Test defined duration
    
    var y = new I.Activity("Test Y", null);
    var yRules = y.computeScheduleFromCalendar(
        "Test Y",
        testCalendar,
        [["start", "break_begin"],
         ["break_end", "end"]],
        makeTestDate(15), // start in first break
        null,
        45,
        45); // fixed duration
    
    var ySchedule = y.getSchedule({computations: [], dates: {}, dateRules: yRules, activities:{"Test Y":y}, now: makeTestDate(60)});

    t.assert(ySchedule.length === 5);

    checkDate(ySchedule[0][0], 20); // Second half-term of term 1
    checkDate(ySchedule[0][1], 30);

    checkDate(ySchedule[1][0], 100); // First half-term of term 2
    checkDate(ySchedule[1][1], 110);

    checkDate(ySchedule[2][0], 120); // Second half-term of term 2
    checkDate(ySchedule[2][1], 130);

    checkDate(ySchedule[3][0], 200); // First half-term of term 3
    checkDate(ySchedule[3][1], 210);

    checkDate(ySchedule[4][0], 220); // Second half-term of term 3
    checkDate(ySchedule[4][1], 225); // Don't truncate end any more
    
    //// Test end in a break
    
    var z = new I.Activity("shirking", null);
    var zRules = z.computeScheduleFromCalendar(
        "Test Z",
        testCalendar,
        [["start", "break_begin"],
         ["break_end", "end"]],
        makeTestDate(15), // start in first break
        makeTestDate(35), // end between terms
        null); // no set duration

    var zSchedule = z.getSchedule({computations: [], dates: {}, dateRules: zRules});

    t.assert(zSchedule.length === 1);

    checkDate(zSchedule[0][0], 20); // Second half-term of term 1
    checkDate(zSchedule[0][1], 30);
});
