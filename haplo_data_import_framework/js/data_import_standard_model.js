/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


if("std:type:person" in TYPE) {

    P.implementService("haplo:data-import-framework:setup-model:haplo:person", function(model) {

        model.addDestination({
            name: "profile",
            title: "Person profile record",
            displaySort: 1,
            kind: "object",
            objectType: TYPE["std:type:person"],
            objectAttributesOverride: {
                "dc:attribute:title": {
                    type: "person-name",
                    description: "Person's name"
                }
            }
        });

    });

    P.implementService("haplo:data-import-framework:filter:haplo:username-to-ref", function() {
        return function(value) {
            var q = O.usersByTags({"username": value.toLowerCase()});
            var user = q.length ? q[0] : undefined;
            return user ? (user.ref||undefined) : undefined;
        };
    });

}
