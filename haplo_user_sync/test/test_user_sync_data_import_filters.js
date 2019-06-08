/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    let usernameFilter = O.service("haplo:data-import-framework:filter:haplo:username-to-ref");
    t.assertEqual("function", typeof(usernameFilter));

    t.assertEqual(undefined, usernameFilter("NO SUCH USER"));

    let q = P.db.users.select().limit(1);
    if(q.length === 0) {
        t.assert(false, "No users in user sync database table -- run a sync before running this test");
    }

    let u0 = q[0];

    let ref = usernameFilter(u0.username);
    t.assert(O.isRef(ref));
    t.assert(ref == O.user(u0.userId).ref);

});
