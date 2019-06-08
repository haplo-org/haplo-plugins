/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var root = (function() { return this; })();

P.implementService("haplo:qa-audit:gather-information", function(audit) {

    // Activities
    var haplo_activity_navigation = root.haplo_activity_navigation;
    if(haplo_activity_navigation) {
        var activities = {};
        _.each(O.service("__qa__:haplo_activity_navigation:internals").activities, function(activity) {
            activities[activity.name] = {
                name: activity.name,
                title: activity.title,
                icon: activity.icon,
                editAction: activity.editAction ? activity.editAction.code : null,
                sort: activity.sort
            };
        });
        audit.addInformation("activities", "Activities", activities);
    }

});
