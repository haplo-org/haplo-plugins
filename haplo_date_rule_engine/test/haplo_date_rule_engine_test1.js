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
        var formatStr = earliest+" - "+latest;
        if(!earliest) {
            formatStr = "undefined";
        } else {
          formatStr = earliest.toString();
        }
        if(!latest) {
          formatStr = formatStr+" - undefined";
        } else {
          formatStr = formatStr+" - "+latest.toString();
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
                console.log("Expected: " + dateName + " = " + formatDateRange(expectedValue) + ", got " + formatDateRange(outputDates[dateName]));
                failed = true;
            }
        });

        t.assert(!failed);
    }

    function test_dates(name, now, inputDates, rules, flags, state, suspensions, expectedResult) {
        var result = P.computeDates(now, inputDates, rules, flags, state, suspensions);
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
               // Suspensions
               [],
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
               // Suspensions
               [],
               // Expected results
               {end: [undefined, undefined, "Not enough inputs to calculate end"]}
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
               // Suspensions
               [],
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
               // Suspensions
               [],
               // Expected results
               {end: [undefined, undefined, "Not enough inputs to calculate end"]}
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
               // Suspensions
               [],
               // Expected results
               {end: [undefined, undefined, "Not enough inputs to calculate end"]}
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
               // Suspensions
               [],
               // Expected results
               {end: [undefined, undefined, "Not enough inputs to calculate end"]}
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
               // Suspensions
               [],
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
               // Suspensions
               [],
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
               // Suspensions
               [],
               // Expected results
               {end: [new XDate("2016-02-01"), new XDate("2016-03-01")]}
              );

    test_dates("add month without overflow", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-31"), new XDate("2016-01-31")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["add", "months", 1, 2, ["date", "start"]]]},
               // Flags
               [],
               // State
               false,
               // Suspensions
               [],
               // Expected results
               // 2016 is a leap year
               {end: [new XDate("2016-02-29"), new XDate("2016-03-31")]}
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
               // Suspensions
               [],
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
               // Suspensions
               [],
               // Expected results
               {end: [new XDate("2016-01-06"), new XDate("2016-01-13")]}
              );
    test_dates("subtract with min range", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-20"), new XDate("2016-02-20")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["subtract", "week", 1, 2, ["date", "start"], "min"]]},
               // Flags
               [],
               // State
               false,
               // Suspensions
               [],
               // Expected results
               {end: [new XDate("2016-01-13"), new XDate("2016-02-06")]}
              );
    test_dates("subtract from requiredMin", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-20"), new XDate("2016-02-20")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["subtract", "week", 1, 2, ["date", "start"], "requiredMin"]]},
               // Flags
               [],
               // State
               false,
               // Suspensions
               [],
               // Expected results
               {end: [new XDate("2016-01-06"), new XDate("2016-01-13")]}
              );
    test_dates("subtract from requiredMax", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-20"), new XDate("2016-02-20")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["subtract", "week", 1, 2, ["date", "start"], "requiredMax"]]},
               // Flags
               [],
               // State
               false,
               // Suspensions
               [],
               // Expected results
               {end: [new XDate("2016-02-06"), new XDate("2016-02-13")]}
              );
    test_dates("add with min range", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-02-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["add", "week", 1, 2, ["date", "start"], "min"]]},
               // Flags
               [],
               // State
               false,
               // Suspensions
               [],
               // Expected results
               {end: [new XDate("2016-01-15"), new XDate("2016-02-08")]}
              );
    test_dates("add to requiredMin", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-02-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["add", "week", 1, 2, ["date", "start"], "requiredMin"]]},
               // Flags
               [],
               // State
               false,
               // Suspensions
               [],
               // Expected results
               {end: [new XDate("2016-01-08"), new XDate("2016-01-15")]}
              );
    test_dates("add to requiredMax", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-02-01")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["add", "week", 1, 2, ["date", "start"], "requiredMax"]]},
               // Flags
               [],
               // State
               false,
               // Suspensions
               [],
               // Expected results
               {end: [new XDate("2016-02-08"), new XDate("2016-02-15")]}
              );
    test_dates("subtract using min range when dates are close", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-20"), new XDate("2016-01-21")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["subtract", "week", 1, 2, ["date", "start"], "min"]]},
               // Flags
               [],
               // State
               false,
               // Suspensions
               [],
               // Expected results
               {end: [new XDate("2016-01-07"), new XDate("2016-01-13")]}
              );
    test_dates("add with min range when dates are close", new XDate("2016-07-01"),
               // Inputs
               {start: [new XDate("2016-01-01"), new XDate("2016-01-02")]},
               // Rules
               {start: ["input"],
                end: ["regular", ["add", "week", 1, 2, ["date", "start"], "min"]]},
               // Flags
               [],
               // State
               false,
               // Suspensions
               [],
               // Expected results
               {end: [new XDate("2016-01-09"), new XDate("2016-01-15")]}
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
               // Suspensions
               [],
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
               // Suspensions
               [],
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
               // Suspensions
               [],
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
               // Suspensions
               [],
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
               // Suspensions
               [],
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
               // Suspensions
               [],
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
               // Suspensions
               [],
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
               // Suspensions
               [],
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
               // Suspensions
               [],
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
                       // Suspensions
                       [],
                       // Expected results
                       {end: [new XDate("2016-01-08T00:00"), new XDate("2016-01-09T00:00"), "Start date is not definite, so period end is approximate"]}
                      );

    state = test_dates("calculate from period, indefinite start", new XDate("2016-01-05"),
                       // Inputs
                       {},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 1, ["date", "start"]]],
                        other: ["regular", ["add", "week", 1, 2, ["date", "end"]]]},
                       // Flags
                       [],
                       // State
                       state,
                       // Suspensions
                       [],
                       // Expected results
                       {}
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
                       // Suspensions
                       [],
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
                       // Suspensions
                       [],
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
                       // Suspensions
                       [],
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

    state = false;

    state = test_dates("Period end without suspension, to create state",
                       new XDate("2016-01-03"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       state,
                       // Suspensions
                       [],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-03 so we have used 2 days

                       // Going by the shortest period (7 days), that leaves us 5 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 12 days, so ending on the 15th.
                       {end: [new XDate("2016-01-08"), new XDate("2016-01-15")]}
                      );

    state = test_dates("Period end with suspension, using state from previous",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       state,
                       // Suspensions
                       [[new XDate("2016-01-05"), new XDate("2016-01-12")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 7 days long, so the end dates are now the 15th and the 22nd
                       {end: [new XDate("2016-01-15"), new XDate("2016-01-22")]}
                      );

    state = test_dates("Period end with suspension, using state from previous, in near future to make sure it's still correct",
                       new XDate("2016-01-10"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       state,
                       // Suspensions
                       [[new XDate("2016-01-05"), new XDate("2016-01-12")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-10 so we have used 10 days

                       // Going by the shortest period (7 days), that leaves us 0 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 5 days, so ending on the 15th.

                       //The suspension is 7 days long, so the end dates are now the 15th and the 22nd
                       {end: [new XDate("2016-01-15"), new XDate("2016-01-22")]}
                      );

    state = test_dates("Period end with suspension, using state from previous, in far future to make sure it's still correct",
                       new XDate("2017-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       state,
                       // Suspensions
                       [[new XDate("2016-01-05"), new XDate("2016-01-12")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2017-01-04 so we have used a whole year

                       // Going by the shortest period (7 days), that leaves us 0 days left, so end date doesn't change, the 8th.
                       // Going by the longest period (14 days), that leaves us 0 days, so end date doesn't change, the 15th.

                       //The suspension is 7 days long, so the end dates are now the 15th and the 22nd
                       {end: [new XDate("2016-01-15"), new XDate("2016-01-22")]}
                      );

    test_dates("Period end with suspension before end",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-05"), new XDate("2016-01-12")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 7 days long, so the end dates are now the 15th and the 22nd
                       {end: [new XDate("2016-01-15"), new XDate("2016-01-22")]}
                      );

    test_dates("Period with suspension around end dates",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-06"), new XDate("2016-01-20")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 14 days long, so the end dates are now the 22nd and the 29th
                       {end: [new XDate("2016-01-22"), new XDate("2016-01-29")]}
                      );

    test_dates("Period with suspension around first end date",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-06"), new XDate("2016-01-10")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 4 days long, so the end dates are now the 12th and the 19th
                       {end: [new XDate("2016-01-12"), new XDate("2016-01-19")]}
                      );

    test_dates("Period with suspension between end dates",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-10"), new XDate("2016-01-12")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 2 days long, but after first, so the end dates are now the 8th and the 17th
                       {end: [new XDate("2016-01-08"), new XDate("2016-01-17")]}
                      );

    test_dates("Period with suspension around last end date",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-14"), new XDate("2016-01-16")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 2 days long, but after first, so the end dates are now the 8th and the 17th
                       {end: [new XDate("2016-01-08"), new XDate("2016-01-17")]}
                      );

    test_dates("Period with suspension after last end date",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-18"), new XDate("2016-01-24")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is after the end date, so doesn't apply
                       {end: [new XDate("2016-01-08"), new XDate("2016-01-15")]}
                      );

    test_dates("Period with suspension that begins on last end date",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-15"), new XDate("2016-01-20")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 5 days long, but after first, so the end dates are now the 8th and the 20th
                       {end: [new XDate("2016-01-08"), new XDate("2016-01-20")]}
                      );

    test_dates("Period with suspension that ends on last end date",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-08"), new XDate("2016-01-15")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 7 days long, but after first, so the end dates are now the 8th and the 22nd
                       {end: [new XDate("2016-01-15"), new XDate("2016-01-22")]}
                      );

    test_dates("Period with suspension and rule change",
                       new XDate("2016-01-07"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "days", 12, 24, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       {
                        end: {
                          periodLengthLeast: 6,
                          periodLengthMost: 12,
                          periodFractionLeast: 0.5,
                          periodFractionMost: 0.25,
                          periodLastUpdated: new XDate("2016-01-04")
                        }
                       },
                       // Suspensions
                       [[new XDate("2016-01-08"), new XDate("2016-01-15")]],
                       // Expected results:

                       // Endpoint is 12-24 days on, so the 13th or 25th

                       // Now is 2016-01-07 so we have used 6 days

                       // Going by the shortest previous period (6 days), we have used an additional 0.5 of the period. Giving us a new least fraction of 1
                       // Going by the longest previous period (12 days), we have used an additional 0.25 of the period. Giving us a new most fraction of 0.5

                       // With the new rules, the days left are 0 and 12. when there are 0 days left, we go with the calculated end date of the 13th

                       // This makes the new end dates the 13th and the 19th.

                       // The suspension is one week starting on the eighth, so the new end dates are the 20th and the 26th
                       {end: [new XDate("2016-01-20"), new XDate("2016-01-26")]}
                      );

    test_dates("Period with suspension that starts on start date",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-01"), new XDate("2016-01-08")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 7 days long, so the end dates are now the 15th and the 22nd
                       {end: [new XDate("2016-01-15"), new XDate("2016-01-22")]}
                      );

    test_dates("Period with suspension that starts now",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-04"), new XDate("2016-01-11")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 7 days long, so the end dates are now the 15th and the 22nd
                       {end: [new XDate("2016-01-15"), new XDate("2016-01-22")]}
                      );

    test_dates("Period with suspension that ends now",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-02"), new XDate("2016-01-04")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 2 days long, so the end dates are now the 10th and the 17th
                       {end: [new XDate("2016-01-10"), new XDate("2016-01-17")]}
                      );

    test_dates("Period with suspension that's entirely before the start of the period",
                       new XDate("2016-01-12"),
                       // Inputs
                       {start: [new XDate("2016-01-08"), new XDate("2016-01-08")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-02"), new XDate("2016-01-04")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 15th or 22nd

                       // Now is 2016-01-12 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 15th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 22nd.

                       //The suspension is before the period so does not apply
                       {end: [new XDate("2016-01-15"), new XDate("2016-01-22")]}
                      );

    test_dates("Period with suspension that starts before the start of the period",
                       new XDate("2016-01-12"),
                       // Inputs
                       {start: [new XDate("2016-01-08"), new XDate("2016-01-08")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-06"), new XDate("2016-01-10")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 15th or 22nd

                       // Now is 2016-01-12 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 15th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 22nd.

                       //The suspension is 4 days, but only 2 days are after the start, so the ends dates are now 17th and 24th
                       {end: [new XDate("2016-01-17"), new XDate("2016-01-24")]}
                      );

    test_dates("Period with delta is entirely suspension",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-01"), new XDate("2016-01-04")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 3 days long, so the end dates are now the 11th and the 18th
                       {end: [new XDate("2016-01-11"), new XDate("2016-01-18")]}
                      );

    test_dates("Period with delta is entirely not suspension",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [[new XDate("2016-01-05"), new XDate("2016-01-09")]],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspension is 4 days long, so the end dates are now the 12th and the 19th
                       {end: [new XDate("2016-01-12"), new XDate("2016-01-19")]}
                      );

      test_dates("Period with two suspensions (only one applies)",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [
                        [new XDate("2016-01-05"), new XDate("2016-01-09")],
                        [new XDate("2016-01-20"), new XDate("2016-01-25")]
                       ],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The only suspension that applies is 4 days long, so the end dates are now the 12th and the 19th
                       {end: [new XDate("2016-01-12"), new XDate("2016-01-19")]}
                      );

      test_dates("Period with two suspensions (neither apply)",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [
                        [new XDate("2015-01-05"), new XDate("2015-01-09")],
                        [new XDate("2017-01-20"), new XDate("2017-01-25")]
                       ],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       // Neither suspension applies
                       {end: [new XDate("2016-01-08"), new XDate("2016-01-15")]}
                      );

      test_dates("Period with two suspensions (both apply)",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [
                        [new XDate("2016-01-03"), new XDate("2016-01-05")], // 2 days
                        [new XDate("2016-01-07"), new XDate("2016-01-09")] // 2 days
                       ],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspensions together are 4 days long, so the end dates are now the 12th and the 19th
                       {end: [new XDate("2016-01-12"), new XDate("2016-01-19")]}
                      );

      test_dates("Period with two suspensions (both apply if applied in correct order)",
                       new XDate("2016-01-04"),
                       // Inputs
                       {start: [new XDate("2016-01-01"), new XDate("2016-01-01")]},
                       // Rules
                       {start: ["input"],
                        end: ["period", "start", ["add", "week", 1, 2, ["date", "start"]]]},
                       // Flags
                       [],
                       // State
                       false,
                       // Suspensions
                       [
                        [new XDate("2016-01-03"), new XDate("2016-01-07")], // 4 days
                        [new XDate("2016-01-12"), new XDate("2016-01-14")] // 2 days
                       ],
                       // Expected results:

                       // Endpoint is 7-14 days on, so the 8th or 15th

                       // Now is 2016-01-04 so we have used 3 days

                       // Going by the shortest period (7 days), that leaves us 4 days left, ending on the 8th.
                       // Going by the longest period (14 days), that leaves us 11 days, so ending on the 15th.

                       //The suspensions together are 6 days long, so the end dates are now the 14th and the 21st
                       {end: [new XDate("2016-01-14"), new XDate("2016-01-21")]}
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
    var outputDates = O.service("haplo:date_rule_engine:update_dates",
                           {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                            "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-02")},
                           "test:rules:test1",
                           ["hungry"],
                           [],
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
    outputDates = O.service("haplo:date_rule_engine:update_dates",
                        {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                        "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-03")},
                        "test:rules:test1",
                        ["famished"],
                        [],
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

    // Recalculate, but this time ignoring any saved state
    outputDates = O.service("haplo:date_rule_engine:update_dates_ignoring_previous_state",
                        {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                        "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-03")},
                        "test:rules:test1",
                        ["famished"],
                        [],
                        ref);
    
    verifyResults("plugin_api 3", outputDates, {
        "submission":[new XDate("2016-01-01"),new XDate("2016-01-01")],
        "start":[new XDate("2016-01-01"),new XDate("2016-03-01")],
        "meeting":[new XDate("2015-12-18"),new XDate("2016-02-23")],
        "teatime":[new XDate("2015-12-18"),new XDate("2016-02-23")],
        "suppertime":[new XDate("2015-12-18"),new XDate("2016-02-23")],
        "eating":[new XDate("2015-12-18"),new XDate("2016-02-23")],
        "meating":[new XDate("2015-12-18"),new XDate("2016-02-23")],

        "end":[new XDate("2016-01-31"),new XDate("2016-02-10")],
        "bedtime":[new XDate("2017-01-31"),new XDate("2017-02-10")]
    });

    // Test API calls with suspensions

    P.implementService("haplo:date_rule_engine:get_rules:test:rules:suspensions", function(R) {
        R.input("submission");
        R.dateRule("start", {add: R.months(0,2), to: "submission"});
        R.dateRule("meeting", {subtract: R.weeks(1,2), from: "start"});
        R.dateRule("bedtime", {add: R.years(1,1), to: "end"});
        R.periodEndRule("end", "submission", {"if": "hungry",
                                              then: {add: R.days(10,20), to: "submission"},
                                              "else": {add: R.days(30,40), to: "submission"}});
    });

    var ref2 = O.object().preallocateRef();
    outputDates = O.service("haplo:date_rule_engine:update_dates",
                           {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                            "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-02")},
                           "test:rules:suspensions",
                           ["hungry"],
                           [[new XDate("2016-01-03"), new XDate("2016-01-10")]],
                           ref2);

    // Suspension is a week long, applies to end and bedtime
    verifyResults("API call that passes in a suspension", outputDates, {
        "submission":[new XDate("2016-01-01"),new XDate("2016-01-01")],
        "start":[new XDate("2016-01-01"),new XDate("2016-03-01")],
        "meeting":[new XDate("2015-12-18"),new XDate("2016-02-23")],

        "end":[new XDate("2016-01-18"),new XDate("2016-01-28")],
        "bedtime":[new XDate("2017-01-18"),new XDate("2017-01-28")]
    });

    var ref3 = O.object().preallocateRef();
    outputDates = O.service("haplo:date_rule_engine:update_dates",
                           {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                            "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-02")},
                           "test:rules:suspensions",
                           ["hungry"],
                           [
                            [new XDate("2016-01-03"), new XDate("2016-01-10")],
                            [new XDate("2016-01-12"), new XDate("2016-01-13")]
                           ],
                           ref3);

    verifyResults("API call that passes in two suspensions (not overlapping)", outputDates, {
        "submission":[new XDate("2016-01-01"),new XDate("2016-01-01")],
        "start":[new XDate("2016-01-01"),new XDate("2016-03-01")],
        "meeting":[new XDate("2015-12-18"),new XDate("2016-02-23")],

        "end":[new XDate("2016-01-19"),new XDate("2016-01-29")],
        "bedtime":[new XDate("2017-01-19"),new XDate("2017-01-29")]
    });

    var ref5 = O.object().preallocateRef();
    outputDates = O.service("haplo:date_rule_engine:update_dates",
                           {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                            "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-02")},
                           "test:rules:suspensions",
                           ["hungry"],
                           [
                            [new XDate("2016-01-12"), new XDate("2016-01-13")],
                            [new XDate("2016-01-03"), new XDate("2016-01-10")]
                           ],
                           ref5);

    verifyResults("API call that passes in two suspensions (wrong order)", outputDates, {
        "submission":[new XDate("2016-01-01"),new XDate("2016-01-01")],
        "start":[new XDate("2016-01-01"),new XDate("2016-03-01")],
        "meeting":[new XDate("2015-12-18"),new XDate("2016-02-23")],

        "end":[new XDate("2016-01-19"),new XDate("2016-01-29")],
        "bedtime":[new XDate("2017-01-19"),new XDate("2017-01-29")]
    });

    var ref4 = O.object().preallocateRef();
    outputDates = O.service("haplo:date_rule_engine:update_dates",
                           {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                            "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-02")},
                           "test:rules:suspensions",
                           ["hungry"],
                           [
                            [new XDate("2016-01-03"), new XDate("2016-01-07")],
                            [new XDate("2016-01-06"), new XDate("2016-01-10")]
                           ],
                           ref4);

    verifyResults("API call that passes in two suspensions (overlapping)", outputDates, {
        "submission":[new XDate("2016-01-01"),new XDate("2016-01-01")],
        "start":[new XDate("2016-01-01"),new XDate("2016-03-01")],
        "meeting":[new XDate("2015-12-18"),new XDate("2016-02-23")],

        "end":[new XDate("2016-01-18"),new XDate("2016-01-28")],
        "bedtime":[new XDate("2017-01-18"),new XDate("2017-01-28")]
    });

    var ref6 = O.object().preallocateRef();
    outputDates = O.service("haplo:date_rule_engine:update_dates",
                           {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                            "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-02")},
                           "test:rules:suspensions",
                           ["hungry"],
                           [[new XDate("2016-01-10"), new XDate("2016-01-03")]],
                           ref6);

    verifyResults("API call that passes in suspension with dates in wrong order (should be corrected)", outputDates, {
        "submission":[new XDate("2016-01-01"),new XDate("2016-01-01")],
        "start":[new XDate("2016-01-01"),new XDate("2016-03-01")],
        "meeting":[new XDate("2015-12-18"),new XDate("2016-02-23")],

        "end":[new XDate("2016-01-18"),new XDate("2016-01-28")],
        "bedtime":[new XDate("2017-01-18"),new XDate("2017-01-28")]
    });

    try {
      var ref7 = O.object().preallocateRef();
      outputDates = O.service("haplo:date_rule_engine:update_dates",
                           {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                            "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-02")},
                           "test:rules:suspensions",
                           ["hungry"],
                           [[new XDate("2016-01-10")]],
                           ref7);
    } catch (e) {
      t.assert(e.message === "Cannot read property \"toString\" from undefined");
    }

    try {
        var ref8 = O.object().preallocateRef();
        outputDates = O.service("haplo:date_rule_engine:update_dates",
                           {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                            "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-02")},
                           "test:rules:suspensions",
                           ["hungry"],
                           "testinput",
                           ref8);
    } catch (e) {
      t.assert(e.message === "Cannot read property \"toString\" from undefined");
    }

    try {
        var ref9 = O.object().preallocateRef();
        outputDates = O.service("haplo:date_rule_engine:update_dates",
                           {submission: [new XDate("2016-01-01"),new XDate("2016-01-01")],
                            "$$$TEST_OVERRIDE_CURRENT_DATE$$$": new XDate("2016-01-02")},
                           "test:rules:suspensions",
                           ["hungry"],
                           [["cd", "ab"]],
                           ref9);
    } catch (e) {
      t.assert(e.message === "Cannot read property \"toString\" from undefined");
    }

    // API call test that uses the new version of the compute API 

    // API call test that uses ignore state

    // API call test that uses compute an ignore state

    // Test that the old version of the state still works

});
