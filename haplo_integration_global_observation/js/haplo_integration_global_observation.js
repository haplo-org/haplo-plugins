/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var ENABLED = !!O.application.config["haplo_integration_global_observation:enabled"];
var QUEUE_METHOD = O.application.config["haplo_integration_global_observation:api_method"] || "poll";
var NO_DEFAULT_OMISSIONS = O.application.config["haplo_integration_global_observation:no_default_omissions"];

// --------------------------------------------------------------------------

P.implementService("haplo:integration-message:discover", function(discover) {
    discover({
        group: "global",
        method: QUEUE_METHOD,
        title: "Global observation",
        description: "Messages which allow an external system to observe all changes of data within this application."
    });
});

var queueChangeForObject = function(object, message) {
    // Allow policy to be applied about which objects should be included
    if(false === O.serviceMaybe("haplo:integration-global-observation:should-send-update-for-object", object)) {
        return;
    }
    O.background.run("haplo_integration_global_observation:queue", {
        ref: object.ref.toString(),
        message: message
    });
};

P.backgroundCallback("queue", function(data) {
    let ref = O.ref(data.ref);
    let message = data.message;
    let object = ref.load();
    // TODO: Control which sources are used in the serialiser?
    let serialiser = O.service("std:serialisation:serialiser").useAllSources();
    message.object = serialiser.encode(object);
    O.service("haplo:integration-message:add", {
        group: "global",
        data: message
    });
});

// --------------------------------------------------------------------------

// Default policy is not to send updates on people objects, because they're controlled
// by the user sync, so would result in lots of messages.
if(!NO_DEFAULT_OMISSIONS) {
    P.implementService("haplo:integration-global-observation:should-send-update-for-object", function(object) {
        if(object.isKindOf(TYPE["std:type:person"])) {
            return false;
        }
    });
}

// --------------------------------------------------------------------------

if(ENABLED) {
    if(O.featureImplemented("std:workflow")) {
        P.use("std:workflow");
        P.workflow.registerOnLoadCallback((workflows) => {
            workflows.forEach((workflow) => {
                workflow.transitionComplete({}, (M) => {
                    if(M.workUnit.ref) {
                        queueChangeForObject(M.workUnit.ref.load(), {
                            action: "workflow:transition"
                        });
                    }
                });
            });
        });
    }

    P.hook('hPostObjectChange', function(response, object, operation, previous) {
        queueChangeForObject(object, {
            action: "object:change",
            operation: operation
        });
    });

    P.implementService("haplo:integration-global-observation:send-update-for-object", function(object, message) {
        if(!message.action) { throw new Error("Must specify action property in message"); }
        queueChangeForObject(object, message);
    });

} else {
    // Null implementation when global observer is disabled
    P.implementService("haplo:integration-global-observation:send-update-for-object", function() {});
}
