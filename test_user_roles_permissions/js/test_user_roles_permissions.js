/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.implementService("haplo:user_roles_permissions:setup", function(setup) {
    // anaesthetist is a Cleaner
    setup.groupPermission(Group.Cleaners, "read-write", Label.Messy);
    // patient is an Admin
    setup.administratorGroup(Group.Admins);

    setup.groupPersonalRole(Group.Admins, "Friend");

    setup.attributeRole("Surgeon", T.Meeting, A.Surgeon, false, A.Patient);

    setup.attributeRole("Nurse", T.Operation, A.Nurse);

    setup.roleOversightPermission("Surgeon", "read-write", [T.Meeting]);
    setup.roleProjectPermission("Nurse", "read-write", [T.Operation]);

    setup.roleProjectPermission("Friend", "read-write", [T.Person]);
});
