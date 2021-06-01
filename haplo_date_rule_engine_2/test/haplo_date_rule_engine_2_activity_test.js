/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

function makeTestDate(ms) {
    return P.internals.makeDate(new XDate(ms), [], "Test input");
}

t.test(function() {
    // Extract test points
    var I = P.internals;

    var state = {};

    // Test different orders of setXXX methods. Pick 2 of the 3 then check that
    // the third value is computed OK. 3P2 = 3!/(3-2)! = 6 permutations to test:
    {
        let x = new I.Activity();

        x.setDuration(100);
        x.setProgressFraction(0.5, state);
        t.assert(x.getProgressTime(makeTestDate(0), state) === 50);
    }
    {
        let x = new I.Activity();

        x.setProgressFraction(0.5, state);
        x.setDuration(100);
        t.assert(x.getProgressTime(makeTestDate(0), state) === 50);
    }
    {
        let x = new I.Activity();

        x.setProgressTime(50, state);
        x.setDuration(100);
        t.assert(x.getProgressFraction(makeTestDate(0), state) === 0.5);
    }
    {
        let x = new I.Activity();

        x.setDuration(100);
        x.setProgressTime(50, state);
        t.assert(x.getProgressFraction(makeTestDate(0), state) === 0.5);
    }
    {
        let x = new I.Activity();

        x.setProgressFraction(0.5, state);
        x.setProgressTime(50, state);
        t.assert(x.getDuration() === 100);
    }
    {
        let x = new I.Activity();

        x.setProgressTime(50, state);
        x.setProgressFraction(0.5, state);
        t.assert(x.getDuration() === 100);
    }

    // Test accumulating time with a set duration
    var a = new I.Activity();

    t.assert(a.getInProgressNow() === false);

    a.setDuration(200);

    a.start(I.makeDate(new XDate(0)), state);
    t.assert(a.getInProgressNow() === true);

    t.assert(a.getProgressTime(makeTestDate(50), state) === 50);

    a.stop(I.makeDate(new XDate(100)), state);
    t.assert(a.getInProgressNow() === false);
    t.assert(a.getProgressTime(makeTestDate(100), state) === 100);

    a.start(I.makeDate(new XDate(200)), state);
    t.assert(a.getInProgressNow() === true);

    t.assert(a.getProgressTime(makeTestDate(250), state) === 150);

    a.stop(I.makeDate(new XDate(300)), state);
    t.assert(a.getInProgressNow() === false);
    t.assert(a.getProgressTime(makeTestDate(300), state) === 200);

    // Test accumulating time with a set initial elapsed time
    var b = new I.Activity();

    b.setProgressTime(100, state);

    t.assert(b.getInProgressNow() === false);
    b.start(I.makeDate(new XDate(0)), state);
    t.assert(b.getInProgressNow() === true);

    t.assert(b.getProgressTime(makeTestDate(50), state) === 150);

    b.stop(I.makeDate(new XDate(100)), state);
    t.assert(b.getInProgressNow() === false);
    t.assert(b.getProgressTime(makeTestDate(100), state) === 200);

    t.assert(b.getProgressTime(makeTestDate(150), state) === 200);

    b.start(I.makeDate(new XDate(200)), state);
    t.assert(b.getInProgressNow() === true);

    t.assert(b.getProgressTime(makeTestDate(250), state) === 250);

    b.stop(I.makeDate(new XDate(300)), state);
    t.assert(b.getInProgressNow() === false);
    t.assert(b.getProgressTime(makeTestDate(300), state) === 300);

    // Test accumulating time with a set initial progress and duration
    var c = new I.Activity();

    c.setProgressTime(100, state);
    c.setDuration(300);
    t.assert(c.getProgressFraction(makeTestDate(0), state) === 100/300);

    t.assert(c.getInProgressNow() === false);
    c.start(I.makeDate(new XDate(0)), state);
    t.assert(c.getInProgressNow() === true);

    t.assert(c.getProgressTime(makeTestDate(50), state) === 150);
    t.assert(c.getProgressFraction(makeTestDate(50), state) === 150/300);

    c.stop(I.makeDate(new XDate(100)), state);
    t.assert(c.getInProgressNow() === false);
    t.assert(c.getProgressTime(makeTestDate(100), state) === 200);
    t.assert(c.getProgressFraction(makeTestDate(100), state) === 200/300);

    c.start(I.makeDate(new XDate(200)), state);
    t.assert(c.getInProgressNow() === true);

    t.assert(c.getProgressTime(makeTestDate(250), state) === 250);
    t.assert(c.getProgressFraction(makeTestDate(250), state) === 250/300);

    c.stop(I.makeDate(new XDate(300)), state);
    t.assert(c.getInProgressNow() === false);
    t.assert(c.getProgressTime(makeTestDate(300), state) === 300);
    t.assert(c.getProgressFraction(makeTestDate(300), state) === 1.0);

    // Test accumulating time with a set initial fraction and duration
    var d = new I.Activity();

    d.setProgressFraction(100/300, state);
    d.setDuration(300);
    t.assert(d.getProgressTime(makeTestDate(0), state) === 100);

    t.assert(d.getInProgressNow() === false);
    d.start(I.makeDate(new XDate(0)), state);
    t.assert(d.getInProgressNow() === true);

    t.assert(d.getProgressTime(makeTestDate(50), state) === 150);
    t.assert(d.getProgressFraction(makeTestDate(50), state) === 150/300);

    d.stop(I.makeDate(new XDate(100)), state);
    t.assert(d.getInProgressNow() === false);
    t.assert(d.getProgressTime(makeTestDate(100), state) === 200);
    t.assert(d.getProgressFraction(makeTestDate(100), state) === 200/300);

    d.start(I.makeDate(new XDate(200)), state);
    t.assert(d.getInProgressNow() === true);

    t.assert(d.getProgressTime(makeTestDate(250), state) === 250);
    t.assert(d.getProgressFraction(makeTestDate(250), state) === 250/300);

    d.stop(I.makeDate(new XDate(300)), state);
    t.assert(d.getInProgressNow() === false);
    t.assert(d.getProgressTime(makeTestDate(300), state) === 300);
    t.assert(d.getProgressFraction(makeTestDate(300), state) === 1.0);

    // Test schedule sanity checking

    var e = new I.Activity("test", [["A","C"],["B","E"],["D","E"],["F","E"]]);
    var schedule = e.getSchedule({
        computations: [],
        dates:{
            "A": makeTestDate("1970-01-01T00:00:00Z"),
            "B": makeTestDate("1970-01-02T00:00:00Z"),
            "C": makeTestDate("1970-01-03T00:00:00Z"),
            "D": makeTestDate("1970-01-04T00:00:00Z"),
            "E": makeTestDate("1970-01-05T00:00:00Z"),
            "F": makeTestDate("1970-01-06T00:00:00Z"),
        }});
    console.log("Schedule: " + JSON.stringify(schedule, null, 2));
    // A-C is fine
    t.assert(schedule[0][0].xdate.getDate() == 1);
    t.assert(schedule[0][1].xdate.getDate() == 3);
    // B-D overlaps A-C, so rejected on those grounds
    t.assert(schedule[1][0].xdate === null);
    t.assert(schedule[1][0].inputs.length === 3); // Overlaps get 3 inputs: original start/end and end of previous
    // D-E is fine, as we check against the last VALID span - A-C - for overlaps
    t.assert(schedule[2][0].xdate.getDate() == 4);
    t.assert(schedule[2][1].xdate.getDate() == 5);
    // F-E is invalid, due to ending before it started
    t.assert(schedule[3][0].xdate === null);
    t.assert(schedule[3][0].inputs.length === 2); // Time-reversed spans get 2 inputs: original start/end

    // Test nice units for duration rules
    var f = new I.Activity("test", [["A","B"]], function(S) {
        return S.durationInDays(1);
    });
    f.reschedule({
        computations: [],
        dates:{
            "A": makeTestDate("1970-01-01T00:00:00Z"),
            "B": makeTestDate("1970-01-02T00:00:00Z"),
        }});
    t.assert(f.getDuration() === 86400000); // 1 day

    var g = new I.Activity("test", [["A","B"]], function(S) {
        return S.durationInWeeks(1);
    });
    g.reschedule({
        computations: [],
        dates:{
            "A": makeTestDate("1970-01-01T00:00:00Z"),
            "B": makeTestDate("1970-01-02T00:00:00Z"),
        }});
    t.assert(g.getDuration() === 7*86400000); // 1 week

    var h = new I.Activity("test", [["A","B"]], function(S) {
        return S.durationInMonths(1);
    });
    h.reschedule({
        computations: [],
        dates:{
            "A": makeTestDate("1970-01-01T00:00:00Z"),
            "B": makeTestDate("1970-01-02T00:00:00Z"),
        }});
    t.assert(h.getDuration() === 31*86400000); // 31 days in January

    var i = new I.Activity("test", [["A","B"]], function(S) {
        return S.durationInYears(1);
    });
    i.reschedule({
        computations: [],
        dates:{
            "A": makeTestDate("1970-01-01T00:00:00Z"),
            "B": makeTestDate("1970-01-02T00:00:00Z"),
        }});
    t.assert(i.getDuration() === 365*86400000); // 365 days in 1970

    var j = new I.Activity("test", null, function(S) {
        return S.durationInYears(1);
    });
    j.reschedule({
        computations: [],
        dates:{
        }});
    t.assert(j.getDuration() === null);
});
