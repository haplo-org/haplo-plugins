/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

function makeTestDate(x) {
    return P.internals.makeDate(new XDate(x), [], "Test input");
}

t.test(function() {
    // Extract test points
    var I = P.internals;

    ////
    //// Test date exclusions
    ////

    var testExcludes = [
        [new XDate(10), new XDate(20)],
        [new XDate(30), new XDate(40)],
        [new XDate(5), new XDate(6)],
    ];

    t.assert(!I.isExcluded(new XDate(1), testExcludes));
    t.assert(I.isExcluded(new XDate(5), testExcludes));
    t.assert(!I.isExcluded(new XDate(6), testExcludes));
    t.assert(!I.isExcluded(new XDate(7), testExcludes));
    t.assert(I.isExcluded(new XDate(10), testExcludes));
    t.assert(I.isExcluded(new XDate(15), testExcludes));
    t.assert(!I.isExcluded(new XDate(20), testExcludes));
    t.assert(!I.isExcluded(new XDate(25), testExcludes));
    t.assert(I.isExcluded(new XDate(30), testExcludes));
    t.assert(I.isExcluded(new XDate(35), testExcludes));
    t.assert(!I.isExcluded(new XDate(40), testExcludes));

    ////
    //// Test repeating dates
    ////

    function checkDate(got, expected) {
        if (expected) {
            if (got.xdate) {
                if (got.xdate.getTime() === new XDate(expected).getTime()) {
                    t.assert(true);
                } else {
                    console.log("Expected " + expected + ", got " + JSON.stringify(got.xdate));
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

    //
    // Test basic operation and skip exclusions
    //

    var rd1 = new I.RepeatingDate(makeTestDate("1979-04-04"), 5, "days",
                                  makeTestDate("1979-05-04"), [
                                      [new XDate("1979-04-14"), new XDate("1979-04-19"), "skip"]
                                  ], false, "Test 1");
    checkDate(rd1.getDate(0), "1979-04-04");
    checkDate(rd1.getDate(1), "1979-04-09");
    // checkDate(rd1.getDate(X), "1979-04-14"); - excluded
    checkDate(rd1.getDate(2), "1979-04-19"); // note excluded, exclusions are semi-open
    checkDate(rd1.getDate(3), "1979-04-24");
    checkDate(rd1.getDate(4), "1979-04-29");
    checkDate(rd1.getDate(5), null);

    //
    // Test map: add a day
    //

    var rd2 = rd1.map(function(index, date) {
        if (date.xdate) {
            return I.makeDate(date.xdate.addDays(1), [date], "Added 1 day");
        } else {
            return date;
        }
    });

    checkDate(rd2.getDate(0), "1979-04-05");
    checkDate(rd2.getDate(1), "1979-04-10");
    // checkDate(rd2.getDate(X), "1979-04-15"); - excluded
    checkDate(rd2.getDate(2), "1979-04-20"); // note excluded, exclusions are semi-open
    checkDate(rd2.getDate(3), "1979-04-25");
    checkDate(rd2.getDate(4), "1979-04-30");
    checkDate(rd2.getDate(5), null);

    //
    // Test dayBefore / dayAfter
    //

    var rd3 = new I.RepeatingDate(makeTestDate("1979-04-04"), 5, "days",
                                  makeTestDate("1979-05-04"), [
                                      [new XDate("1979-04-14"), new XDate("1979-04-19"), "dayBefore"],
                                      [new XDate("1979-04-29"), new XDate("1979-04-30"), "dayAfter"]
                                  ], false, "Test 1");
    checkDate(rd3.getDate(0), "1979-04-04");
    checkDate(rd3.getDate(1), "1979-04-09");
    checkDate(rd3.getDate(2), "1979-04-13"); // day before 1979-04-14
    // 1979-04-19 is just skipped, dayBefore only creates ONE "day before" instance if one or more instances fall in the excluded period.
    checkDate(rd3.getDate(3), "1979-04-19");
    checkDate(rd3.getDate(4), "1979-04-24"); // note index numbering
    checkDate(rd3.getDate(5), "1979-04-30"); // exclusions are semi-open so the end day IS the "day after" the interval
    checkDate(rd3.getDate(6), null);

    //
    // Test filterDates
    //

    var rd4 = new I.RepeatingDate(makeTestDate("1979-04-04"), 5, "days",
                                  makeTestDate("1979-05-30"), [], false, "Test 1");

    var rd5 = I.filterDates(rd4, [
        [makeTestDate("1979-04-10"), makeTestDate("1979-04-20")],
        [makeTestDate("1979-05-01"), makeTestDate("1979-05-15")],
    ], "skip", "test inclusions");

    // checkDate(rd5.getDate(X), "1979-04-04"); - excluded
    checkDate(rd5.getDate(0), "1979-04-14");
    checkDate(rd5.getDate(1), "1979-04-19");
    // checkDate(rd5.getDate(X), "1979-04-24"); - excluded
    // checkDate(rd5.getDate(X), "1979-04-29"); - excluded
    checkDate(rd5.getDate(2), "1979-05-04");
    checkDate(rd5.getDate(3), "1979-05-09");
    checkDate(rd5.getDate(4), "1979-05-14");
    // checkDate(rd5.getDate(X), "1979-05-19"); - excluded
    // checkDate(rd5.getDate(X), "1979-05-24"); - excluded
    // checkDate(rd5.getDate(X), "1979-05-29"); - excluded
    checkDate(rd5.getDate(5), null);

    //
    // Test fitWithinActivity / fitWithinCalendar
    //

    var output = I.computeDates([
        {type: "ruleset",
         when: new XDate(0),
         addActivities: {
             "shirking": {
                 schedule: [["start", "break-begin"],
                            ["break-end", "end"]]
             }
         },
         removeActivities: [],
         dates: {
             "start": function(S) {
                 return S.makeDate("1970-01-10");
             },
             "break-begin": function(S) {
                 return S.makeDate("1970-01-15");
             },
             "break-end": function(S) {
                 return S.makeDate("1970-01-20");
             },
             "end": function(S) {
                 return S.makeDate("1970-01-25");
             },

             "rd": function(S) {
                 return S.makeRepeatingDate(
                     S.makeDate("1970-01-01"), // Start
                     1, "days", // Daily repeat
                     null, // No end date
                     "Daily furtling schedule"
                 );
             },
             "rdWithinActivity": function(S) {
                 // Only furtle while shirking
                 return S.fitRepeatingDateWithinActivity(S.getDate("rd"), "shirking", "skip");
             },
             "rdWithinTerms": function(S) {
                 // Don't furtle outside of term time
                 return S.fitRepeatingDateWithinCalendar(S.getDate("rd"), "terms", [["start", "end"]], "skip");
             }
         },
         calendars: {
             "terms": [
                 I.makeTerm("T1", {
                     "start": new XDate("1970-01-01T00:00:00Z"),
                     "end": new XDate("1970-01-05T00:00:00Z"),
                 }),
                 I.makeTerm("T1", {
                     "start": new XDate("1970-01-10T00:00:00Z"),
                     "end": new XDate("1970-01-15T00:00:00Z"),
                 })
             ],
         }
        }
    ], new XDate(1000));

    var rd = output.dates.rd;
    checkDate(rd.getDate(0), "1970-01-01");
    checkDate(rd.getDate(1), "1970-01-02");
    //... continues to infinity

    var rdWithinActivity = output.dates.rdWithinActivity;
    checkDate(rdWithinActivity.getDate(0), "1970-01-10");
    checkDate(rdWithinActivity.getDate(1), "1970-01-11");
    checkDate(rdWithinActivity.getDate(2), "1970-01-12");
    checkDate(rdWithinActivity.getDate(3), "1970-01-13");
    checkDate(rdWithinActivity.getDate(4), "1970-01-14");
    // shirking break
    checkDate(rdWithinActivity.getDate(5), "1970-01-20");
    checkDate(rdWithinActivity.getDate(6), "1970-01-21");
    checkDate(rdWithinActivity.getDate(7), "1970-01-22");
    checkDate(rdWithinActivity.getDate(8), "1970-01-23");
    checkDate(rdWithinActivity.getDate(9), "1970-01-24");
    checkDate(rdWithinActivity.getDate(10), null);

    var rdWithinTerms = output.dates.rdWithinTerms;
    checkDate(rdWithinTerms.getDate(0), "1970-01-01");
    checkDate(rdWithinTerms.getDate(1), "1970-01-02");
    checkDate(rdWithinTerms.getDate(2), "1970-01-03");
    checkDate(rdWithinTerms.getDate(3), "1970-01-04");
    // Break between terms
    checkDate(rdWithinTerms.getDate(4), "1970-01-10");
    checkDate(rdWithinTerms.getDate(5), "1970-01-11");
    checkDate(rdWithinTerms.getDate(6), "1970-01-12");
    checkDate(rdWithinTerms.getDate(7), "1970-01-13");
    checkDate(rdWithinTerms.getDate(8), "1970-01-14");
    checkDate(rdWithinTerms.getDate(9), null);
});
