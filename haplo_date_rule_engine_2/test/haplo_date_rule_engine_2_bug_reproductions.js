/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

function assertEqual(expected, got) {
    var expectedString = JSON.stringify(expected, null, 2);
    var gotString = JSON.stringify(got, null, 2);
    if (expectedString == gotString) {
        t.assert(true);
    } else {
        // Find the difference in a massive object:
        console.log("TEST FAILURE:");
        var expectedLines = expectedString.split("\n");
        var gotLines = gotString.split("\n");
        var idx;
        for(idx = 0; idx < expectedLines.length && idx < gotLines.length; idx++) {
            if (expectedLines[idx] != gotLines[idx]) {
                console.log("   FIRST DIFFERING LINE: " + idx);
                console.log("EXPECTED: " + expectedLines[idx]);
                console.log(" BUT GOT: " + gotLines[idx]);
                console.log("FULL OUTPUT:");
                console.log(gotString);
                break;
            } else {
                console.log(gotLines[idx]);
            }
        }
        t.assert(false);
    }
}

t.test(function() {
    // Extract test points
    var I = P.internals;

    // Reproduce BUG 1, reported via email

    // "when no transitions were triggered the "project-end" date for a
    // "PHD"+"FT" activity was being calculated as 4 years after the current
    // date, not after the supplied "project-start". "

    // "I’ve set the start date of the project to October 17th 2019, expecting
    // an end date of October 16th 2023 (because over four years using the
    // approximate year duration, leap years will mean we’re a day out). With
    // the test now set to 25th May 2020, we get an end date of 24th May 2024,
    // i.e. four approximate years after now."

    let FT = "FT";
    let PT = "PT";
    let PHD = "PHD";
    let DPROF = "DPROF";
    let MRES = "MRES";
    let MPHIL = "MPHIL";

    let APPROX_YEAR_DURATION = 86400 * 365 * 1000;

    P.implementService("haplo:date_rule_engine_2:get_rules_history:bug_1", function(H) {
        H.changeRules(new XDate("1970-01-02T00:00:00Z"), function(R) {
            R.defineInput("project-start");
            R.addActivity("pre-submission", {
                duration(S) {
                    if(S.hasFlag(PHD)) {
                        return S.hasFlag(FT) ? 4*APPROX_YEAR_DURATION : 8*APPROX_YEAR_DURATION;
                    } else if(S.hasFlag(DPROF)) {
                        return S.hasFlag(FT) ? 4*APPROX_YEAR_DURATION : 8*APPROX_YEAR_DURATION;
                    } else if(S.hasFlag(MPHIL) || S.hasFlag(MRES)) {
                        return S.hasFlag(FT) ? 3*APPROX_YEAR_DURATION : 5*APPROX_YEAR_DURATION;
                    }
                },
                schedule: [["project-start", "project-end"]],
                transitions: {
                    "full-to-part-time": {
                        flagsToAdd: [PT],
                        flagsToRemove: [FT],
                        newProgressFraction(S) {
                        // Keep proportion of FT project completed
                            return S.getActivityProgressFraction("pre-submission:earliest");
                        }
                    },
                    "part-to-full-time": {
                        flagsToAdd: [FT],
                        flagsToRemove: [PT],
                        newProgressTime(S) {
                            // Keep time of PT project completed (probably?)
                            return S.getActivityProgressTime("pre-submission:earliest");
                        }
                    }
                }
            });
        });
    });

    var result1 = O.service("haplo:date_rule_engine_2:compute_dates",
                           "bug_1", // Ruleset name
                           [ // log
                               {type: "addFlags",
                                when: new XDate("1970-01-01T00:00:00Z"),
                                flags: [FT, PHD],
                               },
                               {type: "setDate",
                                when: new XDate("2019-10-17T00:00:00Z"),
                                name: "project-start",
                               },
                           ],
                           new XDate("2020-05-25T00:00:00Z"));

    var expectedOutput1 = {
        "activities": {
            "pre-submission": {
                "duration": 126144000000,
                "progressFraction": 0.15136986301369862,
                "progressTime": 19094400000,
                "inProgressNow": true,
                "intervals": [
                    [
                        {
                            "xdate": "2019-10-17T00:00:00.000Z",
                            "inputs": [],
                            "rationale": "Recorded date of project-start as of Thu Oct 17 2019"
                        },
                        null
                    ]
                ],
                "overrides": [],
                "schedule": [
                    [
                        {
                            "xdate": "2019-10-17T00:00:00.000Z",
                            "inputs": [],
                            "rationale": "Recorded date of project-start as of Thu Oct 17 2019"
                        },
                        {
                            "xdate": "2023-10-16T00:00:00.000Z",
                            "inputs": [
                                {
                                    "xdate": "2020-05-25T00:00:00.000Z",
                                    "inputs": {},
                                    "rationale": "Given as current timestamp"
                                }
                            ],
                            "rationale": "Computed end of activity pre-submission from time left and current time"
                        }
                    ]
                ]
            }
        },
        "flags": [
            "FT",
            "PHD"
        ],
        "dates": {
            "project-start": {
                "xdate": "2019-10-17T00:00:00.000Z",
                "inputs": [],
                "rationale": "Recorded date of project-start as of Thu Oct 17 2019"
            },
            "project-end": {
                "xdate": "2023-10-16T00:00:00.000Z",
                "inputs": [
                    {
                        "xdate": "2020-05-25T00:00:00.000Z",
                        "inputs": {},
                        "rationale": "Given as current timestamp"
                    }
                ],
                "rationale": "Computed end of activity pre-submission from time left and current time"
            }
        }
    };
    assertEqual(expectedOutput1, result1);

    // Reproduce BUG 2, reported via email:

    // "Once again, the unscheduled starts and stops don’t seem to apply. I
    // think in this case it because the activity is never rescheduled and the
    // end date never recalculated after the unscheduled starts and stops are
    // applied (as they are after both the rules set and the setting of
    // project-start in the log that is passed in."

    P.implementService("haplo:date_rule_engine_2:get_rules_history:bug_2", function(H) {
        H.changeRules(new XDate("1970-01-01T00:00:00Z"), function(R) {
            R.addActivity("project-end", {
                scheduleFromCalendar: {
                    calendar: "research-periods",
                    intervals: [["start", "end"]],
                    start: function(S) {
                        return S.getDate("project-start");
                    }
                },
                // The bug report had this, which refers to helpers not in scope here:
                // duration(S) {
                //     return S.durationInTerms(8, "research-periods");
                // },
                // transitions: makeTransitionsForActivity("project-end")
                // This is hopefully enough to reproduce the bug:
                duration: function(S) {
                    return 86400000 * 731; // 731 days = 365 + 366 as 2020 is a leap year
                }
            });
            R.defineInput("project-start");
            R.defineCalendar("research-periods", [
                // > Calendar:
                // >
                // > RP1 1st Jan - end of 28th/29th Feb each year
                // > RP2 1st March - end of 30th June each year
                // > RP3 1st July - end of 30th September each year
                // > RP4 1st October - end of 31st December each year
                R.makeTerm("RP1", { // Jan+Feb = 60 days, 2020's a leap year
                    "start": new XDate("2020-01-01"),
                    "end": new XDate("2020-03-01"),
                }),
                R.makeTerm("RP2", { // Mar+Apr+May+June = 122 days
                    "start": new XDate("2020-03-01"),
                    "end": new XDate("2020-07-01"),
                }),
                R.makeTerm("RP3", { // Jul+Aug+Sep = 92 days
                    "start": new XDate("2020-07-01"),
                    "end": new XDate("2020-10-01"),
                }),
                R.makeTerm("RP4", { // Oct+Nov+Dec = 92 days
                    "start": new XDate("2020-10-01"),
                    "end": new XDate("2021-01-01"),
                }),
                R.makeTerm("RP5", { // 59 days, not a leap year
                    "start": new XDate("2021-01-01"),
                    "end": new XDate("2021-03-01"),
                }),
                R.makeTerm("RP6", { // 122 days
                    "start": new XDate("2021-03-01"),
                    "end": new XDate("2021-07-01"),
                }),
                R.makeTerm("RP7", { // 92 days
                    "start": new XDate("2021-07-01"),
                    "end": new XDate("2021-10-01"),
                }),
                R.makeTerm("RP8", { // 92 days
                    "start": new XDate("2021-10-01"),
                    "end": new XDate("2022-01-01"),
                }),
                R.makeTerm("RP9", { // 59 days, not a leap year
                    "start": new XDate("2022-01-01"),
                    "end": new XDate("2022-03-01"),
                }),
                R.makeTerm("RP10", { // 122 days
                    "start": new XDate("2022-03-01"),
                    "end": new XDate("2022-07-01"),
                }),
            ]);
        });
    });

    // Now run it with an unscheduled stop
    var result2 = O.service("haplo:date_rule_engine_2:compute_dates",
                            "bug_2", // Ruleset name
                            [ // log
                                {type: "setDate",
                                 when: new XDate("2020-01-01T00:00:00Z"),
                                 name: "project-start",
                                },
                                {type: "unscheduledStop", // Knock out RP2
                                 when: new XDate("2020-03-01").addMinutes(1),
                                },
                                {type: "unscheduledStart",
                                 when: new XDate("2020-07-01").addMinutes(-1),
                                },
                            ],
                            new XDate("2020-07-02T00:00:00Z"));
    // We've removed a 122 day term, so need to add 122 days to the end date.
    
    // End date would ideally be 2022-02-28 because we've moved back by 1 term, but we're working in elapsed time and cut out 122 days, which is more than the length of the 50 day term we're pushing the end date into, so we end up in the term after.
    var result2Activity = result2.activities["project-end"];
    assertEqual([
        [
            {
              "xdate": "2020-06-30T23:59:00.000Z",
              "inputs": {},
              "rationale": "Given as recorded time of unscheduled activity start"
            },
            {
              "xdate": "2020-07-01T00:00:00.000Z",
              "inputs": [],
              "rationale": "end in term RP2"
            }
          ],
          [
            {
                "xdate": "2020-07-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "start in term RP3"
            },
            {
                "xdate": "2020-10-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "end in term RP3"
            }
        ],
        [
            {
                "xdate": "2020-10-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "start in term RP4"
            },
            {
                "xdate": "2021-01-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "end in term RP4"
            }
        ],
        [
            {
                "xdate": "2021-01-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "start in term RP5"
            },
            {
                "xdate": "2021-03-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "end in term RP5"
            }
        ],
        [
            {
                "xdate": "2021-03-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "start in term RP6"
            },
            {
                "xdate": "2021-07-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "end in term RP6"
            }
        ],
        [
            {
                "xdate": "2021-07-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "start in term RP7"
            },
            {
                "xdate": "2021-10-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "end in term RP7"
            }
        ],
        [
            {
                "xdate": "2021-10-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "start in term RP8"
            },
            {
                "xdate": "2022-01-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "end in term RP8"
            }
        ],
        [
            {
                "xdate": "2022-01-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "start in term RP9"
            },
            {
                "xdate": "2022-03-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "end in term RP9"
            }
        ],
        [
            {
                "xdate": "2022-03-01T00:00:00.000Z",
                "inputs": [],
                "rationale": "start in term RP10"
            },
            {
                "xdate": "2022-05-02T23:58:00.000Z",
                "inputs": [
                    {
                        "xdate": "2022-07-01T00:00:00.000Z",
                        "inputs": [],
                        "rationale": "end in term RP10"
                    }
                ],
                "rationale": "Interval truncated to fit remaining duration"
            }
        ]
    ], result2Activity.schedule);
});
