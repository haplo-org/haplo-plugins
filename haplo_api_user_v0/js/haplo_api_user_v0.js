/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.apiAllowedAction(
    O.action("haplo:action:api-v0:user-api").
        title("Use API v0 User").
        allow("group", Group.UserAPI)
);

// --------------------------------------------------------------------------
// Helpers for finding users
// --------------------------------------------------------------------------

var withUser = function(api, userId, fn) {
    let user;
    try {
        user = O.securityPrincipal(userId);
    } catch(e) {
        return api.error("haplo:api-v0:user:no-such-user", "User ID "+userId+" does not exist", HTTP.NOT_FOUND);
    }
    if(user) {
        fn(user);
    }
};

var findUser = function(api, userId, fn) {
    if(!userId) {
        if(_.keys(api.E.request.parameters).length) {
            let userMaybe = getUsersByTagsFromParameters(api, api.E.request.parameters, true);
            if(userMaybe) {
                return fn(userMaybe);
            } else {
                return; //Error already returned by getUsersByTagsFromParameters
            }
        } else {
            return api.error("haplo:api-v0:user:no-details-provided", "Either a user ID in the path of the request, or a tag query in the parameters must be provided.");
        }
    } else {
        withUser(api, userId, fn);
    }
};

var getUsersByTagsFromParameters = function(api, parameters, singleUser) {
    let tagQuery = {};
    _.each(parameters, (value, key) => {
        if(key.startsWith("tag:")) {
            tagQuery[key.substring(4)] = value;
        }
    });
    if(_.size(tagQuery) === 0) {
        return api.error("haplo:api-v0:user:no-tag-query-provided", "A tag query was expected in the parameters of this request, but was not provided. To be included in a tag query, tag names must be prefixed by tag:");
    }
    let users = O.usersByTags(tagQuery);
    let queryString = _.chain(tagQuery).
            map((v, k) => {
                return k.toString()+"="+v.toString();
            }).
            reduce((memo, str) => {
                memo = memo+", "+str;
            }).value();
    if(users.length === 0) {
        return api.error("haplo:api-v0:user:no-user-found", "Tag query "+queryString+" returned no users.", HTTP.NOT_FOUND);
    }
    if(singleUser && users.length > 1) {
        return api.error("haplo:api-v0:user:multiple-users-found", "Tag query "+queryString+" returned more than one result.", HTTP.NOT_FOUND);
    }
    if(singleUser) {
        return users[0];
    } else {
        return users;
    }
};

// --------------------------------------------------------------------------
// Helpers for finding groups
// --------------------------------------------------------------------------

var withGroup = function(api, groupCode, fn) {
    let group;
    group = getGroupMaybe(groupCode);
    if(group) {
        fn(group);
    }
};

var getGroupMaybe = function(groupCode) {
    let gid, m = groupCode.match(/^group:(\d+)$/);
    if(m) {
        gid = parseInt(m[1], 10);
    } else if(groupCode in GROUP) {
        gid = GROUP[groupCode];
    } else {
        throw new Error("Group with code "+groupCode+" does not exist");
    }
    if(gid) {
        let group;
        try {
            group = O.securityPrincipal(gid);
        } catch(e) {
            // The platform error here isn't very helpful
            throw new Error("Group with code "+groupCode+" does not exist");
        }
        return group;
    }
};

// --------------------------------------------------------------------------
// Helpers for getting user details
// --------------------------------------------------------------------------

const EXPOSE_USER_PROPERTIES = [
    "id", "nameFirst", "nameLast", "name", "code",
    "email", "ref", "isGroup", "isActive", "isSuperUser", "isServiceUser", "isAnonymous", "localeId"
];

var userDetails = function(user) {
    let details = {};
    EXPOSE_USER_PROPERTIES.forEach((property) => {
        let value = user[property];
        if(value !== undefined) {
            if(O.isRef(value)) {
                value = value.toString();
            }
            details[property] = value;
        }
    });
    let directGroupMembership = [];
    _.each(user.directGroupIds, (gid) => {
        let group = O.group(gid);
        if(group.code) {
            directGroupMembership.push(group.code);
        } else {
            directGroupMembership.push("group:"+gid);
        }
    });

    let displayableTags = {};
    _.each(user.tags, (v, t) => {
        displayableTags[t] = v;
    });
    details.tags = displayableTags;
    details.directGroupMembership = directGroupMembership;
    return details;
};

// --------------------------------------------------------------------------
// Helpers for updates
// --------------------------------------------------------------------------

const EDITABLE_PROPERTIES = [
    "nameFirst", "nameLast", "email", "ref", "localeId", "directGroupMembership", "tags"
];

var getGroupsForUpdate = function(user, groups) {
    let groupIds = [];
    _.each(groups, (group) => {
        let g = getGroupMaybe(group);
        if(g) { groupIds.push(g.id); }
    });
    return groupIds;
};
var updateUserTags = function(user, tags) {
    let tagsNeedSaving = false;
    _.each(tags, (val, tag) => {
        if(user.tags[tag] !== val.toString()) {
            user.tags[tag] = val;
            tagsNeedSaving = true;
        }
    });
    if(tagsNeedSaving) { user.saveTags(); }
};

var usernameUnique = function(username, user) {
    let normalisedUsername = username.toLowerCase();
    if(user && user.tags.username === normalisedUsername) { return true; }
    let usersWithUsername = O.usersByTags({username: normalisedUsername});
    return usersWithUsername.length === 0;
};

// --------------------------------------------------------------------------
// Reponse handlers
// --------------------------------------------------------------------------

P.respondToAPI("GET", "/api/v0-user/id", [
    {pathElement:0, as:"int", optional: true}
], function(api, userId) {
    findUser(api, userId, (user) => {
        api.respondWith("user", userDetails(user));
        api.success("haplo:api-v0:user:details");
    });
});

P.respondToAPI("GET", "/api/v0-user/group", [
    {pathElement:0, as:"string"}
], function(api, groupCode) {
    withGroup(api, groupCode, (group) => {
        let array = _.map(group.loadAllMembers(), (m) => m.id);
        api.respondWith("users", array);
        api.respondWith("group", userDetails(group));
        api.success("haplo:api-v0:user:group-details");
    });
});

P.respondToAPI("POST", "/api/v0-user/id", [
    {pathElement:0, as:"int", optional:true},
    {body:"body", as:"json"}
], function(api, userId, update) {
    findUser(api, userId, (user) => {
        if(user.isGroup) {
            return api.error("haplo:api-v0:user:update-failed", "User "+userId+" is a Group and cannot be updated");
        }
        let currentDetails = userDetails(user);
        let newDetails = _.clone(currentDetails);
        let setDetailsNeeded;
        let error;

        let actions = [() => {
            if(setDetailsNeeded) {
                user.setDetails(newDetails);
            }
        }];
        _.each(update, (value, key) => {
            if(!_.contains(EDITABLE_PROPERTIES, key)) {
                delete newDetails[key];
                return;
            }
            if(_.isEqual(value, currentDetails[key])) { return; }
            if(key === "ref") {
                try {
                    let ref = O.ref(value);
                    if(ref) {
                        actions.push(() => user.ref = ref);
                    } else {
                        error = "Could not add ref "+update.ref+" to user as it is not a valid reference to an object";
                    }
                } catch(e) {
                    throw new Error("Could not add ref "+update.ref+" to user as it is not a valid reference to an object");
                }
                delete newDetails.ref;
            } else if(key === "localeId") {
                actions.push(() => user.setLocaleId(value));
                delete newDetails.localeId;
            } else if(key === "directGroupMembership") {
                let groupIds = getGroupsForUpdate(user, value);
                actions.push(() => user.setGroupMemberships(groupIds));
                delete newDetails.directGroupMembership;
            } else if(key === "tags") {
                if(value.username && !usernameUnique(value.username, user)) {
                    error = "Could not set username tag to "+value.username+" for user "+userId+" as a user already exists with that username.";
                } else {
                    actions.push(() => updateUserTags(user, value));
                    delete newDetails.tags;
                }
            } else {
                newDetails[key] = value;
                setDetailsNeeded = true;
            }
        });
        if(error) { return api.error("haplo:api-v0:user:update-failed", error); }
        if(newDetails.email !== currentDetails.email) {
            let userForEmail = O.user(newDetails.email);
            if(userForEmail && userForEmail.id !== userId) {
                return api.error("haplo:api-v0:user:update-failed", "User "+userId+" cannot be updated to have email "+newDetails.email+" as another user already has that email");
            }
        }
        _.each(actions, (f) => {
            f();
        });
        api.respondWith("user", userDetails(O.user(user.id)));
        api.success("haplo:api-v0:user:update");
    });
});

P.respondToAPI("POST", "/api/v0-user/create", [
    {body:"body", as:"json"},
    {parameter:"welcomeLink", as:"int", optional:true}
], function(api, details, welcomeLink) {
    let user;
    if(details.email && O.user(details.email)) {
        return api.error("haplo:api-v0:user:creation-failed", "Could not create new user, as user already exists with email address "+details.email);
    }
    if(details.tags && details.tags.username && !usernameUnique(details.tags.username)) {
        return api.error("haplo:api-v0:user:creation-failed", "Could not create new user, as user already exists with username tag "+details.tags.username);
    }

    let setupDetails = _.clone(details);
    if(details.ref) {
        try {
            setupDetails.ref = O.ref(details.ref);
        } catch(e) {
            throw new Error("Could not add ref "+details.ref+" to user as it is not a valid reference to an object");
        }
        if(!setupDetails.ref) {
            return api.error("haplo:api-v0:user:creation-failed", "Could not add ref "+details.ref+" to user as it is not a valid reference to an object");
        }
    }
    delete setupDetails.directGroupMembership;
    setupDetails.groups = getGroupsForUpdate(user, details.directGroupMembership);

    user = O.setup.createUser(setupDetails);
    if(user) {
        if(welcomeLink) {
            api.respondWith("welcomeLink", user.generateWelcomeURL());
        }
        api.respondWith("user", userDetails(user));
        api.success("haplo:api-v0:user:create");
    }
});

P.respondToAPI("POST", "/api/v0-user/enable", [
    {pathElement:0, as:"int"},
    {parameter:"status", as:"string"}
], function(api, userId, status) {
    withUser(api, userId, (user) => {
        if(status === "block") {
            user.setIsActive(false);
        } else if(status === "active") {
            user.setIsActive(true);
        } else {
            return api.error("haplo:api-v0:user:enable-failed", status+" is not a valid status");
        }
        api.respondWith("user", userDetails(user));
        api.success("haplo:api-v0:user:enable");
    });
});

P.respondToAPI("GET", "/api/v0-user/find-by-tag", [
], function(api) {
    let users = getUsersByTagsFromParameters(api, api.E.request.parameters);
    if(users) {
        let userIds = _.map(users, (u) => u.id);
        api.respondWith("users", userIds);
        api.success("haplo:api-v0:user:find-by-tag");
    }
});