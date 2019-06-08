/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanSeeRoles = O.action("haplo_user_roles_permissions:can_see_roles").
        title("Can see roles").
        allow("group", Group.Administrators);

// Add button to object page to roles list
P.hook("hObjectDisplay", function(response, object) {
    if(O.currentUser.allowed(CanSeeRoles)) {
        // TODO: Configurable set of types to show Permissions button
        if(object.isKindOf(T.Person)) {
            response.buttons["*USERROLES"] = [["/do/haplo-user-roles-permissions/roles/"+object.ref, "Permissions: User roles"]];
        }
    }
});

// Add link from System Management user info to the roles list
P.hook('hUserAdminUserInterface', function(response, user) {
    if(O.currentUser.allowed(CanSeeRoles)) {
        if(user.ref) {
            response.information.push(["/do/haplo-user-roles-permissions/roles/"+user.ref, "View roles..."]);
        }
    }
});

// Display list of roles
P.respond("GET,POST", "/do/haplo-user-roles-permissions/roles", [
    {pathElement:0, as:"object"}
], function(E, object) {
    CanSeeRoles.enforce();

    var user = O.user(object.ref);
    var roles = [];
    if(user) {
        _.each(O.service("haplo:permissions:user_roles", user)._getRawRoles(), function(labels, roleName) {
            _.each(labels, function(label) {
                roles.push({roleName:roleName, at:label.load()});
            });
        });
    }

    E.render({
        object: object,
        user: user,
        roles: roles.length ? roles : undefined
    }, "admin/roles");
});

// --------------------------------------------------------------------------

var PERMS = [
    ["read", O.PERM_READ],
    ["create", O.PERM_CREATE],
    ["update", O.PERM_UPDATE]
];

// Display list of all defined roles
P.respond("GET,POST", "/do/haplo-user-roles-permissions/all-role-definitions", [
], function(E, object) {
    CanSeeRoles.enforce();
    var internals = P.__getInternals();

    var roleInfo = {};
    var getRoleInfo = function(role) {
        if(!(role in roleInfo)) {
            roleInfo[role] = {
                definedBy: [],
                permissions: [],
                groups: []
            };
        }
        return roleInfo[role];
    };

    var groupInfo = {};
    var getGroupInfo = function(group) {
        if(!(group in groupInfo)) {
            groupInfo[group] = {
                permissions: [],
                liftRestrictions: []
            };
        }
        return groupInfo[group];
    };

    var makeLabelPermissions = function(labels, permissions) {
        labels.each((label,perms) => {
            var plist = [];
            PERMS.forEach((x) => {
                let [name, mask] = x;
                if((perms & mask) === mask) {
                    plist.push(name);
                }
            });
            permissions.push({
                label: label.load().title,
                perms: plist.join(',')
            });
        });
    };

    // How do users get roles from objects?
    internals.roles.each((type, info) => {
        var typeName = SCHEMA.getTypeInfo(type).name;
        _.each(info, (roles, dq) => {
            let [desc, qual] = dq.split('.').map((x) => 1*x);
            var descName = SCHEMA.getAttributeInfo(desc).name;
            var qualName = qual ? SCHEMA.getQualifierInfo(qual).name : undefined;
            roles.forEach((props) => {
                var ri = getRoleInfo(props.role);
                ri.definedBy.push({
                    typeName: typeName,
                    descName: descName,
                    qualName: qualName,
                    objectAttr: props.objectAttr ? SCHEMA.getAttributeInfo(props.objectAttr).name : undefined
                });
            });
        });
    });

    // How do users get roles from groups?
    _.each(internals.groupPersonalRoles, (roles,group) => {
        roles.forEach((role) => {
            var ri = getRoleInfo(role);
            ri.groups.push(O.group(1*group).name);
        });
    });

    // What does this grant them?
    _.each(internals.rolePermissions, (labels, role) => {
        let ri = getRoleInfo(role);
        makeLabelPermissions(labels, ri.permissions);
    });

    // What permissions do being part of a group give you?
    _.each(internals.groupPermissions, (labels,group) => {
        let gi = getGroupInfo(O.group(1*group).name);
        makeLabelPermissions(labels, gi.permissions);
    });

    // What restrictions does it lift?
    _.each(internals.groupRestrictionLabels, (labelList,group) => {
        let gi = getGroupInfo(O.group(1*group).name);
        _.map(labelList, (ref) => ref.load().title).sort().forEach((n) => gi.liftRestrictions.push(n));
    });

    E.render({
        roles: _.keys(roleInfo).sort().map((r) => {return {role:r, info:roleInfo[r]};}),
        groups: _.keys(groupInfo).sort().map((g) => {return {group:g, info:groupInfo[g]};})
    }, "admin/all-role-definitions");
});

