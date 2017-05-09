/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

if(O.featureImplemented("std:workflow")) {
    P.hook("hOperationAllowOnObject", function(response, user, object, operation) {
        if (operation === "update") {
            // Allow updates if workflow permissions grant write
            var workflowWriters = O.service("std:workflow:get_additional_writers_for_object", object);
            _.each(workflowWriters, function(writer) {
                if(writer.id === user.id) {
                    response.allow = true;
                }
            });
        }
    });
}
