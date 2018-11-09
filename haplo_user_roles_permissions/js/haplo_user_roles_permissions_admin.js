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
