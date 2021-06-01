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

    {
        let calendar = [
            I.makeTerm("Early", {
                "start": new XDate(0),
                "furtling_day": new XDate(10),
                "end": new XDate(90),
            }),
            I.makeTerm("Mid", {
                "start": new XDate(100),
                "furtling_day": new XDate(110),
                "end": new XDate(190),
            }, new XDate(95)), // Note technical start is 5ms earlier than start
            I.makeTerm("Late", {
                "start": new XDate(200),
                "furtling_day": new XDate(210),
                "end": new XDate(290),
            }),
        ];

        t.assert(calendar[0].technicalStart.diffMilliseconds(new XDate(0)) === 0);
        t.assert(calendar[1].technicalStart.diffMilliseconds(new XDate(95)) === 0);
        t.assert(calendar[2].technicalStart.diffMilliseconds(new XDate(200)) === 0);

        console.log("CALENDAR: " + JSON.stringify(calendar, null, 2));

        t.assert(I.findTerm(calendar, makeTestDate(-1)) === null);
        t.assert(I.findTerm(calendar, makeTestDate(0)) === 0);
        t.assert(I.findTerm(calendar, makeTestDate(94)) === 0);
        t.assert(I.findTerm(calendar, makeTestDate(95)) === 1);
        t.assert(I.findTerm(calendar, makeTestDate(195)) === 1);
        t.assert(I.findTerm(calendar, makeTestDate(199)) === 1);
        t.assert(I.findTerm(calendar, makeTestDate(200)) === 2);
        t.assert(I.findTerm(calendar, makeTestDate(300)) === 2);

        // When did we last furtle, I wonder?

        t.assert(!I.findTermDateBefore(calendar, makeTestDate(-1), "furtling_day").xdate);
        t.assert(!I.findTermDateBefore(calendar, makeTestDate(0), "furtling_day").xdate);
        t.assert(I.findTermDateBefore(calendar, makeTestDate(10), "furtling_day").xdate.getTime() === 10);
        t.assert(I.findTermDateBefore(calendar, makeTestDate(94), "furtling_day").xdate.getTime() === 10);
        t.assert(I.findTermDateBefore(calendar, makeTestDate(95), "furtling_day").xdate.getTime() === 10);
        t.assert(I.findTermDateBefore(calendar, makeTestDate(96), "furtling_day").xdate.getTime() === 10);
        t.assert(I.findTermDateBefore(calendar, makeTestDate(109), "furtling_day").xdate.getTime() === 10);

        t.assert(I.findTermDateBefore(calendar, makeTestDate(110), "furtling_day").xdate.getTime() === 110);
        t.assert(I.findTermDateBefore(calendar, makeTestDate(111), "furtling_day").xdate.getTime() === 110);

        t.assert(I.findTermDateBefore(calendar, makeTestDate(209), "furtling_day").xdate.getTime() === 110);
        t.assert(I.findTermDateBefore(calendar, makeTestDate(210), "furtling_day").xdate.getTime() === 210);
        t.assert(I.findTermDateBefore(calendar, makeTestDate(211), "furtling_day").xdate.getTime() === 210);
        t.assert(I.findTermDateBefore(calendar, makeTestDate(99999), "furtling_day").xdate.getTime() === 210);

        // How long until we need to furtle once more?

        t.assert(I.findTermDateAfter(calendar, makeTestDate(-1), "furtling_day").xdate.getTime() === 10);
        t.assert(I.findTermDateAfter(calendar, makeTestDate(0), "furtling_day").xdate.getTime() === 10);
        t.assert(I.findTermDateAfter(calendar, makeTestDate(9), "furtling_day").xdate.getTime() === 10);
        t.assert(I.findTermDateAfter(calendar, makeTestDate(10), "furtling_day").xdate.getTime() === 10);

        t.assert(I.findTermDateAfter(calendar, makeTestDate(11), "furtling_day").xdate.getTime() === 110);
        t.assert(I.findTermDateAfter(calendar, makeTestDate(94), "furtling_day").xdate.getTime() === 110);
        t.assert(I.findTermDateAfter(calendar, makeTestDate(95), "furtling_day").xdate.getTime() === 110);
        t.assert(I.findTermDateAfter(calendar, makeTestDate(96), "furtling_day").xdate.getTime() === 110);
        t.assert(I.findTermDateAfter(calendar, makeTestDate(109), "furtling_day").xdate.getTime() === 110);
        t.assert(I.findTermDateAfter(calendar, makeTestDate(110), "furtling_day").xdate.getTime() === 110);

        t.assert(I.findTermDateAfter(calendar, makeTestDate(111), "furtling_day").xdate.getTime() === 210);
        t.assert(I.findTermDateAfter(calendar, makeTestDate(199), "furtling_day").xdate.getTime() === 210);
        t.assert(I.findTermDateAfter(calendar, makeTestDate(200), "furtling_day").xdate.getTime() === 210);
        t.assert(I.findTermDateAfter(calendar, makeTestDate(209), "furtling_day").xdate.getTime() === 210);
        t.assert(I.findTermDateAfter(calendar, makeTestDate(210), "furtling_day").xdate.getTime() === 210);

        t.assert(!I.findTermDateAfter(calendar, makeTestDate(211), "furtling_day").xdate);

        // Count up some terms
        t.assert(I.advanceTerms(calendar, makeTestDate(10), 0).xdate.getTime() === 90);
        t.assert(I.advanceTerms(calendar, makeTestDate(10), 1).xdate.getTime() === 190);
        t.assert(I.advanceTerms(calendar, makeTestDate(10), 2).xdate.getTime() === 290);
        t.assert(!I.advanceTerms(calendar, makeTestDate(10), 3).xdate);
    }

});
