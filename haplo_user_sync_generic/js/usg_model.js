/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:data-import-framework:setup-model:haplo:user-sync", function(model) {

    model.addDestination({
        name: "user",
        title: "User account",
        displaySort: 1,
        kind: "dictionary",
        dictionaryNames: {
            username: {
                description: "Unique identifier for user",
                type: "text",
                required: true
            },
            title: {
                description: "Mr, Mrs, Ms, etc",
                type: "text"
            },
            nameFirst: {
                description: "First name of user",
                type: "text",
                required: true
            },
            nameLast: {
                description: "Family name (surname) of user",
                type: "text",
                required: true
            },
            email: {
                description: "Email address of user (ideally unique)",
                type: "text",
                required: true
            },
            groups: {
                description: "Zero or more Group API codes",
                type: "text",
                multivalue: true
            }
        }
    });

    model.addDestination({
        name: "profile",
        title: "Person profile record",
        displaySort: 10,
        kind: "object",
        objectType: TYPE["std:type:person"],
        without: [
            "dc:attribute:type",
            "std:attribute:email"
        ],
        objectAttributesOverride: {
            "dc:attribute:title": {
                type: "person-name",
                description: "Person's name",
                // Will always get a title from the user destination,
                // this allows for additional titles to be provided (formal names etc)
                required: false
            }
        }
    });

    let userTagsDictionaryNames = O.serviceMaybe("haplo_user_sync_generic:get_user_tag_destination_names") || {};
    if("username" in userTagsDictionaryNames) {
        throw new Error("username cannot be set in the 'user:tags' destination this should be set in the 'user' destination.");
    }

    model.addDestination({
        name: "user:tags",
        title: "User tags",
        displaySort: 5,
        depends: "user",
        kind: "dictionary",
        optional: true,
        dictionaryNames: userTagsDictionaryNames,
        tryMakeTargetAvailableForDependency(dependencyName, dependencyTarget) {
            return new UserTags();
        }
    });

});

var UserTags = function() {
};

P.implementService("haplo_user_sync_generic:get_sync_plugins", function(syncPlugins) {
    syncPlugins.push({
        onApply(engine, batch) {
        },
        onUpdatedRecord(engine, batch, record, transformation) {
            let userTags = transformation.getTarget("user:tags");
            if(!_.isEmpty(userTags)) {
                let user = transformation.getTarget("user");
                user.tags = {};
                _.each(userTags, (value, key) => {
                    user.tags[key] = value.toString();
                });
                transformation.setTarget("user", user);
            }

        },
        onUpdateBlockedProfileObject(engine, batch, object, username, user) {
        },
        onPostApply(engine, batch) {
        }
    });
});