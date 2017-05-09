/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

t.test(function() {

    function dateDifferent(d1, d2) {
        if(!d1 && !d2) {
            return false;
        }

        if(!d1 || !d2) {
            return true;
        }

        if(d1.diffDays(d2) !== 0) {
            return true;
        }

        return false;
    }

    function formatDateRange(d) {
        var earliest = d[0];
        var latest = d[1];
        var problem = d[2];
        var formatStr;
        if(!earliest || !latest) {
            formatStr = "undefined - undefined";
        }
        if(problem) {
            return formatStr + " (" + problem + ")";
        } else {
            return formatStr;
        }
    }

    function verifyResults(name, outputDates, expectedResult) {
        var failed = false;
        _.each(expectedResult, function(expectedValue, dateName) {
            var value = outputDates[dateName];
            if(!value ||
               dateDifferent(value[0], expectedValue[0]) ||
               dateDifferent(value[1], expectedValue[1]) ||
               value[2] != expectedValue[2]) {
                failed = true;
            }
        });

        if(failed) {
            console.log("Failure in date rule engine test " + name);
            _.each(expectedResult, function (expectedValue, dateName) {
            var value = outputDates[dateName];
            if(!value ||
               dateDifferent(value[0], expectedValue[0]) ||
               dateDifferent(value[1], expectedValue[1]) ||
               value[2] != expectedValue[2]) {
                console.log("Expected: " + dateName + " = " + formatDateRange(expectedValue) + ", got " + formatDateRange(outputDates[dateName]));
            }
            });
        }

        t.assert(!failed);
    }

    function test_dates(name, now, inputDates, rules, flags, state, expectedResult) {
        var result = P.computeDates(now, inputDates, rules, flags, state);
        var errors = verifyResults(name, result.outputDates, expectedResult);
        _.each(errors, console.log);
        return result.state;
    }

    test_dates("input", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {start: ["input"]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]}
              );

    test_dates("missing input", new XDate("2016-07-01"),
               // Inputs
               {},
               // Rules
               {start: ["input"],
                end: ["regular", ["date", "start"]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [undefined, undefined, "Missing input date: 'start'"]}
              );

    test_dates("input rule", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["date", "start"]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")],
                end: [new XDate("2016-01-01"), new XDate("2016-01-01")]}
              );

    test_dates("missing input in rule", new XDate("2016-07-01"),
               // Inputs
               {},
               // Rules
               {end: ["regular", ["date", "start"]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [undefined, undefined, "Date 'start' does not have a computation rule"]}
              );

    test_dates("explicit undefined date", new XDate("2016-07-01"),
                // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {end: ["regular", ["date", "undefined"]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [undefined, undefined]}
              );

    test_dates("recursion", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["date", "end"]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [undefined, undefined, "The rule for date 'end' refers back to itself"]}
              );

    test_dates("add day", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["add", "days", 1, 2, ["date", "start"]]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [new XDate("2016-01-02"), new XDate("2016-01-03")]}
              );

    test_dates("add week", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["add", "weeks", 1, 2, ["date", "start"]]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [new XDate("2016-01-08"), new XDate("2016-01-15")]}
              );

    test_dates("add month", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["add", "months", 1, 2, ["date", "start"]]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [new XDate("2016-02-01"), new XDate("2016-03-01")]}
              );

    test_dates("add year", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["add", "years", 1, 2, ["date", "start"]]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [new XDate("2017-01-01"), new XDate("2018-01-01")]}
              );

    test_dates("subtract", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-20"), new XDate("2016-01-20")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["subtract", "week", 1, 2, ["date", "start"]]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [new XDate("2016-01-06"), new XDate("2016-01-13")]}
              );

    test_dates("if yay", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["if", "foo",
                                  ["add", "week", 1, 2, ["date", "start"]],
                                  ["add", "week", 3, 4, ["date", "start"]]]]},
               // Flags
               ["foo"],
               // State
               false,
               // Expected results
               {end: [new XDate("2016-01-08"), new XDate("2016-01-15")]}
              );

    test_dates("if nay", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["if", "foo",
                                  ["add", "week", 1, 2, ["date", "start"]],
                                  ["add", "week", 3, 4, ["date", "start"]]]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [new XDate("2016-01-22"), new XDate("2016-01-29")]}
              );

    test_dates("case 1", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["case",
                                  ["foo", ["add", "week", 1, 2, ["date", "start"]]],
                                  ["bar", ["add", "week", 3, 4, ["date", "start"]]]]]},
               // Flags
               ["foo"],
               // State
               false,
               // Expected results
               {end: [new XDate("2016-01-08"), new XDate("2016-01-15")]}
              );

    test_dates("case 2", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["case",
                                  ["foo", ["add", "week", 1, 2, ["date", "start"]]],
                                  ["bar", ["add", "week", 3, 4, ["date", "start"]]]]]},
               // Flags
               ["bar"],
               // State
               false,
               // Expected results
               {end: [new XDate("2016-01-22"), new XDate("2016-01-29")]}
              );

    test_dates("case 3", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["case",
                                  ["foo", ["add", "week", 1, 2, ["date", "start"]]],
                                  ["bar", ["add", "week", 3, 4, ["date", "start"]]]]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [undefined, undefined, "None of these cases match a flag: [\"foo\",\"bar\"] (current flags are [])"]}
              );

    test_dates("and simple", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-02-01")],
                registration: [new XDate("2016-01-15"), new XDate("2016-02-15")]},
               // Rules
               {start: ["input"],
                registration: ["input"],
                end: ["regular", ["and",
                                  ["date", "registration"],
                                  ["date", "start"]]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [new XDate("2016-01-15"), new XDate("2016-02-01")]}
              );

    test_dates("and failing", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-02-01")],
                registration: [new XDate("2016-02-15"), new XDate("2016-03-15")]},
               // Rules
               {start: ["input"],
                registration: ["input"],
                end: ["regular", ["and",
                                  ["date", "registration"],
                                  ["date", "start"]]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [new XDate("2016-02-15"), new XDate("2016-02-15"), "Date had to be guessed, due to a conflict"]}
              );

    test_dates("or simple", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-02-01")],
                registration: [new XDate("2016-01-15"), new XDate("2016-02-15")]},
               // Rules
               {start: ["input"],
                registration: ["input"],
                end: ["regular", ["or",
                                  ["date", "registration"],
                                  ["date", "start"]]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [new XDate("2016-01-01"), new XDate("2016-02-15")]}
              );

    test_dates("or disjoint", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-15")],
                registration: [new XDate("2016-02-15"), new XDate("2016-03-15")]},
               // Rules
               {start: ["input"],
                registration: ["input"],
                end: ["regular", ["or",
                                  ["date", "registration"],
                                  ["date", "start"]]]},
               // Flags
               [],
               // State
               false,
               // Expected results
               {end: [new XDate("2016-01-01"), new XDate("2016-03-15")]}
              );

    state = test_dates("period, indefinite start", new XDate("2016-01-05"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-02")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 1, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       state,
                       // Expected results
                       {end: [new XDate("2016-01-08T00:00"), new XDate("2016-01-09T00:00"), "Start date is not definite, so period end is approximate"]}
                      );

    var state = false;

    state = test_dates("period 1",
                       new XDate("2016-01-07"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       state,
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-07 so we have used 6 days

                       // Going by the shortest period (7 days), that leaves us 1 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 8 days, so ending on the 15th.
                       {end: [new XDate("2016-01-08"), new XDate("2016-01-15")]}
                      );

    // Two more days pass; eight days into period

    state = test_dates("period 2",
                       new XDate("2016-01-09"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       state,
                       // Expected results:

                       // Endpoint is still 8th-15th.

                       // Now is 2016-01-09 so we have used 8 days

                       // Going by the shortest period (7 days), we have 0 days left, ending on the 8th (now in the past)
                       // Going by the longest period (14 days), we have 6 days left, ending on the 15th
                       {end: [new XDate("2016-01-08"), new XDate("2016-01-15")]}
                      );

    // Two more days pass; ten days into period
    // But now we get a two-week extension!

    state = test_dates("period 3 (double period)",
                       new XDate("2016-01-11"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 3, 4, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       state,
                       // Expected results:

                       // Endpoint is now 22th-29th.

                       // Now is 2016-01-11 so we have used 10 days

                       // We had used 100% of the shorter period and
                       // 10/14 (71.42%) of the longer

                       // Going by the shortest period (21 days), we
                       // have 0 days left, ending on the 22nd (now
                       // back in the future)

                       // Going by the longest period (28 days), we
                       // have 8 days left (used 20), ending on the
                       // 19th

                       // Note that this causes us to swap the
                       // endpoints around; the end date computed from
                       // the longest period is now soonest!
                       {end: [new XDate("2016-01-19"), new XDate("2016-01-22")]}
                      );

    // Test plugin API

    P.implementService("haplo:date_rule_engine:get_rules:test:rules:test1", function(R) {
        R.input("submission");
        R.dateRule("start", {add: R.months(0,2), to: "submission"});
        R.dateRule("meeting", {subtract: R.weeks(1,2), from: "start"});
        R.dateRule("teatime", {"if": "hungry", then: "start", "else": "meeting"});
        R.dateRule("suppertime", {"case": [{hungry: "start"}, {famished: "meeting"}]});
        R.dateRule("eating", {or: ["teatime","suppertime"]});
        R.dateRule("meating", {and: ["eating","meeting"]});
        R.dateRule("bedtime", {add: R.years(1,1), to: "end"});
        R.periodEndRule("end", "submission", {"if": "hungry",
                                              then: {add: R.days(10,20), to: "submission"},
                                              "else": {add: R.days(30,40), to: "submission"}});
    });

    var ref = O.object().preallocateRef();
    var outputDates = O.service("haplo:date_rule_engine:compute_dates",
                           {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                            "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-02")},
                           "test:rules:test1",
                           ["hungry"],
                           ref);

    verifyResults("plugin_api 1", outputDates, {
        "submission":[new XDate("2016-01-01"),new XDate("2016-01-01")],
        "start":[new XDate("2016-01-01"),new XDate("2016-03-01")],
        "meeting":[new XDate("2015-12-18"),new XDate("2016-02-23")],
        "teatime":[new XDate("2016-01-01"),new XDate("2016-03-01")],
        "suppertime":[new XDate("2016-01-01"),new XDate("2016-03-01")],
        "eating":[new XDate("2016-01-01"),new XDate("2016-03-01")],
        "meating":[new XDate("2016-01-01"),new XDate("2016-02-23")],

        "end":[new XDate("2016-01-11"),new XDate("2016-01-21")],
        "bedtime":[new XDate("2017-01-11"),new XDate("2017-01-21")]
    });

    // Advance one day, change flags hungry->famished
    outputDates = O.service("haplo:date_rule_engine:compute_dates",
                       {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                        "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-03")},
                       "test:rules:test1",
                       ["famished"],
                        ref);

    verifyResults("plugin_api 2", outputDates, {
        "submission":[new XDate("2016-01-01"),new XDate("2016-01-01")],
        "start":[new XDate("2016-01-01"),new XDate("2016-03-01")],
        "meeting":[new XDate("2015-12-18"),new XDate("2016-02-23")],
        "teatime":[new XDate("2015-12-18"),new XDate("2016-02-23")],
        "suppertime":[new XDate("2015-12-18"),new XDate("2016-02-23")],
        "eating":[new XDate("2015-12-18"),new XDate("2016-02-23")],
        "meating":[new XDate("2015-12-18"),new XDate("2016-02-23")],

        "end":[new XDate("2016-01-27"),new XDate("2016-02-08")],
        "bedtime":[new XDate("2017-01-27"),new XDate("2017-02-08")]
    });

});
