/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var PERM_ALL_WRITES = O.PERM_ALL & (~O.PERM_READ);
var RULE_PERM_LOOKUP = {
    "read": O.PERM_READ,
    "create": O.PERM_CREATE,
    "read-create": O.PERM_READ | O.PERM_CREATE,
    "read-edit": O.PERM_READ | O.PERM_UPDATE,
    "read-write": O.PERM_ALL
};

// --------------------------------------------------------------------------

// Configuration data initialised by haplo:user_roles_permissions:setup services.

var groupPermissions = {},
    groupRestrictionLabels = {},
    administratorGroups = [],
    groupPersonalRoles = {},
    rolePermissions = {},
    roleRestrictionLabels = {},

    // roles is a dict from object types to dicts from attributes (of
    // objects of those types) linking to users, to lists of dicts
    // mapping "role" to a human-readable description of the role, and
    // "objectAttr" to an optional attribute descriptor.  The meaning
    // of this is that if an object O of type T (possibly a subtype of
    // T) links to a user via attribute A, and roles[T][A] has at
    // least one entry of the form {role:R, objectAttr:OA}, then that
    // user has role R "at" object O. However, if the objectAttr OA is
    // specified, then the role is not "at" O, but instead the first
    // object linked from O through attribuite OA.
    roles = O.refdictHierarchical(function() { return {}; }),

    // relevantTypes is the list of all types (including subtypes) that
    // match the roles dict.
    relevantTypes = [],

    typeIsRelevant = O.refdictHierarchical();

// --------------------------------------------------------------------------

P.implementService("__qa__:haplo_user_roles_permissions:internals", function() {
    ensureSetup();
    return {
        groupPermissions: groupPermissions,
        groupRestrictionLabels: groupRestrictionLabels,
        administratorGroups: administratorGroups,
        groupPersonalRoles: groupPersonalRoles,
        rolePermissions: rolePermissions,
        roleRestrictionLabels: roleRestrictionLabels,
        roles: roles,
        relevantTypes: relevantTypes
    };
});

// --------------------------------------------------------------------------

var ensureSetup = function() {

    var rolePermissionsCopy = {};

    var setup = {
        groupPersonalRole: function(group, role) {
            var g = groupPersonalRoles[group];
            if(!g) { g = groupPersonalRoles[group] = []; }
            g.push(role);
        },
        groupPermission: function(group, permission, label) {
            var g = groupPermissions[group];
            if(!g) { g = groupPermissions[group] = O.refdict(); }
            g.set(label, (g.get(label) || 0) | (RULE_PERM_LOOKUP[permission] || 0));
        },
        groupRestrictionLabel: function(group, label) {
            var g = groupRestrictionLabels[group];
            if(g) {
                groupRestrictionLabels[group] = O.labelChanges([label]).change(g);
            } else {
                groupRestrictionLabels[group] = O.labelList(label);
            }
        },
        administratorGroup: function(group) {
            administratorGroups.push(group);
        },

        // Declare that an object O of type "type" referencing a user
        // via attribute "desc" (or "qual"."desc" if qual is
        // specified) has a role of "role at O" or, if objectAttr is
        // specified, "role at O.objectAttr". "role" is a human-readable string.
        attributeRole: function(role, type, desc, qual, objectAttr) {
            var lookup = roles.getWithoutHierarchy(type);
            var key = ''+desc+(qual ? '.'+qual : '');
            var list = lookup[key];
            if(!list) { list = lookup[key] = []; }
            list.push({role:role, objectAttr:objectAttr});
            typeIsRelevant.set(type, true);
        },

        // Declare that a role includes all the permissions from another role
        roleIncludesAllPermissionsOfOtherRole: function(role, otherRole) {
            var copyFrom = rolePermissionsCopy[role];
            if(!copyFrom) { copyFrom = rolePermissionsCopy[role] = []; }
            if(-1 === copyFrom.indexOf(otherRole)) { copyFrom.push(otherRole); }
        },

        // Declare that a user has the given permission on an object
        // matching any of the labels, if they have the specified role
        // at that object.
        roleOversightPermission: function(role, permission, labels) {
            var lx = rolePermissions[role];
            if(!lx) { lx = rolePermissions[role] = O.refdict(); }
            labels.forEach(function(label) {
                lx.set(label, (lx.get(label) || 0) | (RULE_PERM_LOOKUP[permission] || 0));
            });
        },

        roleRestrictionLabelWithGlobalEffect: function(role, label) {
            var labels = roleRestrictionLabels[role];
            if(labels) {
                roleRestrictionLabels[role] = O.labelChanges([label]).change(labels);
            } else {
                roleRestrictionLabels[role] = O.labelList(label);
            }
        }
    };

    // TODO: Implement project permissions more efficiently, count number of labels to check they're used correctly.
    // For now, use the same implementation for project permissions as
    // oversight permissions. However, this needs to be changed so that
    // project permissions are implemented more efficiently for the case
    // where you have someone working on many projects.
    setup.roleProjectPermission = setup.roleOversightPermission;
    // NOTE: When re-implemented, also update the role permission copying

    if(O.serviceImplemented("haplo:user_roles_permissions:setup")) {
        O.service("haplo:user_roles_permissions:setup", setup);
    }

    // Copy role permissions
    _.each(rolePermissionsCopy, function(copyFrom, role) {
        copyFrom.forEach(function(otherRole) {
            var copyLx = rolePermissions[otherRole];
            if(copyLx) {
                var lx = rolePermissions[role];
                if(!lx) { lx = rolePermissions[role] = O.refdict(); }
                copyLx.each(function(label, permissions) {
                    lx.set(label, (lx.get(label) || 0) | permissions);
                });
            }
        });
    });

    // Administrator groups get read-write on all labels set using groupPermissions()
    // This will give them pretty much access to everything.
    if(administratorGroups.length > 0) {
        var labels = [];
        _.each(groupPermissions, function(permissions, name) {
            permissions.each(function(label) { labels.push(label); });
        });
        administratorGroups.forEach(function(gid) {
            labels.forEach(function(label) { setup.groupPermission(gid, "read-write", label); });
        });
    }

    // Make the array of relevant types
    typeIsRelevant.each(function(type) { relevantTypes.push(type); });

    // Don't need to do anything again
    ensureSetup = function() {};
};

// --------------------------------------------------------------------------

// Cache for user roles, reset below by hPostObjectChange
var userRolesCache, userRolesCacheCount;
var flushUserRolesCacheInThisRuntime = function() { userRolesCache = {}; userRolesCacheCount = 0; };
var invalidateUserRolesCache = O.interRuntimeSignal("haplo_user_roles_permissions:invalidate_user_roles_cache", flushUserRolesCacheInThisRuntime);
flushUserRolesCacheInThisRuntime(); // to set empty caches
var USER_ROLES_CACHE_MAX_SIZE = 128;

// If groups change, need to flush the cache
P.hook('hUsersChanged', function(response) {
    invalidateUserRolesCache.signal();
});

// If objects which define roles change, flush the roles cache
P.hook("hPostObjectChange", function(response, object, operation, previous) {
    if(operation === "create" || operation === "update") {
        ensureSetup();
        var reloadRequired = false;
        var checkType = function(type) { if(typeIsRelevant.get(type)) { reloadRequired = true; } };
        object.everyType(checkType);
        if(previous) { previous.everyType(checkType); }
        if(reloadRequired) {
            // Flush the cache *then* reload the user permissions, to avoid a race condition
            console.log("Sending signal to invalidate user role caches in other runtimes");
            invalidateUserRolesCache.signal();
            O.reloadUserPermissions();
        }
    }
});

// --------------------------------------------------------------------------

var UserRoles = function(userId, userRef) {
    this.$userId = userId;
    this.$roles = {};
    this.userRef = userRef;
};
_.extend(UserRoles.prototype, {
    _getRawRoles: function() {
        return this.$roles;
    },
    addRole: function(roleName, label) {
        var l = this.$roles[roleName];
        if(!l) { l = this.$roles[roleName] = []; }
        l.push(label);
    },
    hasRole: function(roleName, label) {
        var labels = this.$roles[roleName];
        if(!labels) { return false; }
        for(var i = 0; i < labels.length; ++i) {
            if(labels[i] == label) {
                return true;
            }
        }
        return false;
    },
    labelsForRole: function(roleName) {
        return this.$roles[roleName] || [];
    },
    labelsForMultipleRoles: function(roleNameList) {
        var t = this, labels = [];
        _.each(roleNameList, function(roleName) {
            _.each(t.$roles[roleName] || [], function(label) {
                for(var x = 0; x < labels.length; ++x) {
                    if(labels[x] == label) { return; } // nasty deduplication because refs can't use ===
                }
                labels.push(label);
            });
        });
        return labels;
    },
    hasAnyRole: function(/* zero or more role names as individual arguments */) {
        for(var i = 0; i < arguments.length; ++i) {
            if(arguments[i] in this.$roles) {
                return true;
            }
        }
        return false;
    }
});

var getUserRoles = function(user) {
    ensureSetup();
    invalidateUserRolesCache.check();
    // Cached?
    if(user.id in userRolesCache) {
        return userRolesCache[user.id];
    }
    // Needs calculating. First, cache too big?
    if(userRolesCacheCount > USER_ROLES_CACHE_MAX_SIZE) {
        flushUserRolesCacheInThisRuntime();  // prevent it using lots of memory
        console.log("Flushed user roles cache as it got too big.");
    }

    return O.impersonating(O.SYSTEM, function() {
        // Ref of user profile (might be null)
        var userRef = user.ref;
        var userRoles = new UserRoles(user.id, userRef);
        if(userRef) {
            // Personal roles from group membership
            user.groupIds.forEach(function(gid) {
                var roles = groupPersonalRoles[gid];
                if(roles) {
                    roles.forEach(function(role) { userRoles.addRole(role, userRef); });
                }
            });
            // Roles from attributes on objects, declared via setup.attributeRole
            if(relevantTypes.length) {
                var roleQuery = O.query().link(userRef).link(relevantTypes,A.Type);
                // Find the actual attributes from the objects that refer to this user
                _.each(roleQuery.execute(), function(obj) {
                    obj.everyType(function(objType) {
                        var lookups = roles.getAllInHierarchy(objType);
                        obj.every(function(v,d,q) {
                            if(v == userRef) {
                                var unqualifiedDescriptor = ''+d;
                                var qualifiedDescriptor = unqualifiedDescriptor+'.'+q;
                                // Find attributes that match declared
                                // attributeRoles
                                lookups.forEach(function(lookup) {
                                    var attrRoles = lookup[qualifiedDescriptor] || lookup[unqualifiedDescriptor];
                                    if(attrRoles) {
                                        attrRoles.forEach(function(r) {
                                            // By default, the role is
                                            // "at" the object
                                            // But if the
                                            // attributeRole
                                            // declaration names an
                                            // objectAttr, we
                                            // reference that instead
                                            // to find the "at"
                                            // object.
                                            if(r.objectAttr) {
                                                obj.every(r.objectAttr, function(v,d,q) {
                                                    if(O.isRef(v)) { userRoles.addRole(r.role, v); }
                                                });
                                            } else {
                                                var ref = obj.ref;
                                                if(ref) {
                                                    userRoles.addRole(r.role, ref);
                                                }
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    });
                });
            }
        }
        // Add roles through other means?
        // NOTE: This service should be used as a last resort
        O.serviceMaybe("haplo:user_roles_permissions:add_roles_to_user", userRoles, user, userRef);
        // Cache and return
        userRolesCache[user.id] = userRoles;
        userRolesCacheCount ++;
        return userRoles;
    });
};

// --------------------------------------------------------------------------

// Integration into O.action() API to implement "role" kind

P.implementService("std:action:check:role", function(user, thing) {
    var roles = getUserRoles(user);
    return roles.hasAnyRole(thing);
});

// --------------------------------------------------------------------------

// Services for other plugins to query permissions

P.implementService("haplo:permissions:user_roles", getUserRoles);

P.implementService("haplo:permissions:is_administrator", function(user) {
    ensureSetup();
    for(var l = 0; l < administratorGroups.length; ++l) {
        if(user.isMemberOf(administratorGroups[l])) {
            return true;
        }
    }
    return false;
});

// --------------------------------------------------------------------------

P.hook("hUserPermissionRules", function(response, user) {
    // Mustn't be ANONYMOUS
    if(!user.isMemberOf(Group.Everyone)) { return; }

    ensureSetup();
    var rules = response.rules;

    // Build permissions for labels
    var lp = O.refdict();

    // Explicitly state rules for schema and classification (eg Subject) objects
    lp.set(Label.STRUCTURE, O.PERM_READ);
    lp.set(Label.CONCEPT, O.PERM_READ);

    // Add rules based on group membership
    user.groupIds.forEach(function(gid) {
        var g = groupPermissions[gid];
        if(g) {
            g.each(function(label, permissions) {
                lp.set(label, (lp.get(label) || 0) | permissions);
            });
        }
    });

    // Apply calculated rules
    lp.each(function(label, permissions) {
        rules.add(label, O.STATEMENT_ALLOW, permissions);
    });

    if(user.ref) {
        // Add rule granting users read access to anything labelled with them
        rules.add(user.ref, O.STATEMENT_ALLOW, O.PERM_READ);
    }
});

// Add additional statements for the various roles
P.hook("hUserLabelStatements", function(response, user) {
    // Mustn't be ANONYMOUS
    if(!user.isMemberOf(Group.Everyone)) { return; }
    // Use cached roles
    var userRoles = getUserRoles(user);
    // Now OR the main statements with new statements for the various roles
    var statements = response.statements;
    _.each(userRoles._getRawRoles(), function(labels, roleName) {
        var perms = rolePermissions[roleName];
        // If role known...
        if(perms) {
            // Create some allows for the entities
            var builder1 = O.labelStatementsBuilder();
            _.each(labels, function(label) {
                builder1.rule(label, O.STATEMENT_ALLOW, O.PERM_ALL);
            });
            // Create some permssions for the types / activity labels
            var builder2 = O.labelStatementsBuilder();
            perms.each(function(label, perms) {
                builder2.rule(label, O.STATEMENT_ALLOW, perms);
            });
            // Make combined statement
            var roleStatements = builder1.toLabelStatements().and(builder2.toLabelStatements());
            // And combine with other statements
            statements = statements.or(roleStatements);
        }
    });
    // Replace statements
    response.statements = statements;
});

// --------------------------------------------------------------------------


P.hook("hUserAttributeRestrictionLabels", function(response, user) {
    var userLabels = response.userLabels;
    var addLabelChanges = function(labelsObject, index) {
        var ll = labelsObject[index];
        if(ll) { userLabels.add(ll); }
    };

    user.groupIds.forEach(function(gid) {
        addLabelChanges(groupRestrictionLabels, gid);
    });

    var userRoles = getUserRoles(user);
    _.each(userRoles._getRawRoles(), function(labels, roleName) {
        addLabelChanges(roleRestrictionLabels, roleName);
    });
});
