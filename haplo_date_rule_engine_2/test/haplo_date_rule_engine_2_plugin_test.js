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

    ////
    //// Test mergeHistories
    ////

    var h = I.mergeHistories(
        [
            {when: new XDate(15)},
            {when: new XDate(25)},
            {when: new XDate(35)},
        ],
        [
        ],
        [
            {when: new XDate(10)},
            {when: new XDate(20)},
            {when: new XDate(30)},
        ],
        [
            {when: new XDate(22)},
        ]
    );

    var dates = h.map(function(logEntry) {
        return logEntry.when.getTime();
    });
    assertEqual([10,15,20,22,25,30,35], dates);

    ////
    //// Test getRuleHistory
    ////

    P.implementService("haplo:date_rule_engine_2:get_rules_history:test", function(H) {
        H.changeRules(new XDate(0), function(R) {
            R.defineInput("registration");

            R.defineCalendar("weeks", [
                R.makeTerm("Week 1", {
                    "start": new XDate(0),
                    "end": new XDate(86400000*5),
                }),
                R.makeTerm("Week 2", {
                    "start": new XDate(86400000*7),
                    "end": new XDate(86400000*12),
                }),
            ]);

            R.defineDateRule("birthday", function(S) {
                return S.makeDate("1979-04-04");
            });

            R.addActivity("sleeping", {
                schedule: [["registration", "birthday"]]
            });
        });

        H.changeRules(new XDate(500), function(R) {
            R.defineInput("registration");

            R.defineCalendar("weeks", [
                R.makeTerm("Week 1", {
                    "start": new XDate(0),
                    "end": new XDate(86400000*5),
                }),
                R.makeTerm("Week 2", {
                    "start": new XDate(86400000*7),
                    "end": new XDate(86400000*12),
                }),
            ]);

            R.defineDateRule("birthday", function(S) {
                return S.makeDate("1979-04-04");
            });

            R.addActivity("brushing teeth", {
                duration: 120000,
                schedule: [["birthday", "toothbrushing_ends"]]
            });
        });
    });

    var rules = I.getRuleHistory("test");

    var expected = [
        {"type": "ruleset",
         "when": "1970-01-01T00:00:00.000Z",
         "addActivities": {
             "sleeping": {
                 "schedule": [["registration","birthday"]]
             }
         },
         "removeActivities": [],
         "inputs": [
             "registration"
         ],
         "dates": {},
         "calendars": {
             "weeks": [
                 {"name": "Week 1",
                  "technicalStart": "1970-01-01T00:00:00.000Z",
                  "anchors": {
                      "start": "1970-01-01T00:00:00.000Z",
                      "end": "1970-01-06T00:00:00.000Z"
                  }
                 },
                 {"name": "Week 2",
                  "technicalStart": "1970-01-08T00:00:00.000Z",
                  "anchors": {
                      "start": "1970-01-08T00:00:00.000Z",
                      "end": "1970-01-13T00:00:00.000Z"
                  }
                 }
             ]
         }
        },
        {"type": "ruleset",
         "when": "1970-01-01T00:00:00.500Z",
         "addActivities": {
             "brushing teeth": {
                 "duration": 120000,
                 "schedule": [["birthday","toothbrushing_ends"]]
             }
         },
         "removeActivities": [],
         "inputs": [
             "registration"
         ],
         "dates": {},
         "calendars": {
             "weeks": [
                 {"name": "Week 1",
                  "technicalStart": "1970-01-01T00:00:00.000Z",
                  "anchors": {
                      "start": "1970-01-01T00:00:00.000Z",
                      "end": "1970-01-06T00:00:00.000Z"
                  }
                 },
                 {"name": "Week 2",
                  "technicalStart": "1970-01-08T00:00:00.000Z",
                  "anchors": {
                      "start": "1970-01-08T00:00:00.000Z",
                      "end": "1970-01-13T00:00:00.000Z"
                  }
                 }
             ]
         }
        }
    ];

    assertEqual(expected, rules);

    ////
    //// Test haplo:date_rule_engine_2:compute_dates
    ////

    var result = O.service("haplo:date_rule_engine_2:compute_dates",
                           "test", // Ruleset name
                           [ // log
                               {type: "setDate",
                                when: new XDate(100),
                                activity: "sleeping",
                                name: "registration",
                               },
                           ],
                           new XDate(1000)); // now, after the second ruleset kicks in

    var expectedOutput = {
        "activities": {
            "sleeping": {
                "duration": 292031999900,
                "progressFraction": 3.0818540444478187e-9,
                "progressTime": 900, // Started at 100ms, it's now 1000ms
                "inProgressNow": true,
                "intervals": [
                    [
                        {
                            "xdate": "1970-01-01T00:00:00.100Z",
                            "inputs": [],
                            "rationale": "Recorded date of registration as of Thu Jan 01 1970"
                        },
                        null
                    ]
                ],
                "overrides": [],
                "schedule": [
                    [
                        {
                            "xdate": "1970-01-01T00:00:00.100Z",
                            "inputs": [],
                            "rationale": "Recorded date of registration as of Thu Jan 01 1970"
                        },
                        {
                            "xdate": "1979-04-04T00:00:00.000Z",
                            "inputs": [],
                            "rationale": "Hardcoded in ruleset"
                        }
                    ]
                ]
            },
            "brushing teeth": {
                "duration": 120000, // Dentists recommend 2 minutes
                "progressFraction": null,
                "progressTime": null,
                "inProgressNow": false,
                "intervals": [],
                "overrides": [],
                "schedule": [
                    [
                        {
                            "xdate": "1979-04-04T00:00:00.000Z",
                            "inputs": [],
                            "rationale": "Hardcoded in ruleset"
                        },
                        {
                            "xdate": "1979-04-04T00:02:00.000Z", // 2 minutes past start
                            "inputs": [
                                {
                                    "xdate": "1979-04-04T00:00:00.000Z",
                                    "inputs": [],
                                    "rationale": "Hardcoded in ruleset"
                                }
                            ],
                            "rationale": "Computed end of activity brushing teeth from time left and scheduled start of final interval of work"
                        }
                    ]
                ]
            }
        },
        "flags": [],
        "dates": {
            "registration": {
                "xdate": "1970-01-01T00:00:00.100Z",
                "inputs": [],
                "rationale": "Recorded date of registration as of Thu Jan 01 1970"
            },
            "birthday": {
                "xdate": "1979-04-04T00:00:00.000Z",
                "inputs": [],
                "rationale": "Hardcoded in ruleset"
            },
            "toothbrushing_ends": {
                "xdate": "1979-04-04T00:02:00.000Z",
                "inputs": [
                    {
                        "xdate": "1979-04-04T00:00:00.000Z",
                        "inputs": [],
                        "rationale": "Hardcoded in ruleset"
                    }
                ],
                "rationale": "Computed end of activity brushing teeth from time left and scheduled start of final interval of work"
            }
        }
    };

    assertEqual(expectedOutput, result);
});
