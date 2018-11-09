/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:descriptive_object_labelling:setup", function(type) {
    type(T.Meeting, {
        labelWith: [A.OrganisedBy],
        labelsFromLinked: [[A.OrganisedBy,A.ResearchInstitute]]
    });
});

P.implementService("haplo:user_roles_permissions:setup", function(setup) {
    setup.roleOversightPermission("Committee Representative", "read-write", [T.CommitteeMeeting]);
    setup.roleOversightPermission("Committee Member", "read", [T.CommitteeMeeting]);
    setup.roleOversightPermission("Committee Chair", "read", [T.CommitteeMeeting]);
    setup.roleOversightPermission("Committee Deputy Chair", "read", [T.CommitteeMeeting]);

    setup.roleOversightPermission("Committee Representative", "read-write", [T.Committee]);

    setup.attributeRole("Committee Representative", T.Committee, A.CommitteeRepresentative, undefined, A.ResearchInstitute);
    setup.attributeRole("Committee Member", T.Committee, A.CommitteeMember, undefined, A.ResearchInstitute);
    setup.attributeRole("Committee Chair", T.Committee, A.Chair, undefined, A.ResearchInstitute);
    setup.attributeRole("Committee Deputy Chair", T.Committee, A.DeputyChair, undefined, A.ResearchInstitute);

    setup.roleIncludesAllPermissionsOfOtherRole("Committee Representative", "Committee Oversight");
    setup.roleIncludesAllPermissionsOfOtherRole("Committee Member", "Committee Oversight");
    setup.roleIncludesAllPermissionsOfOtherRole("Committee Chair", "Committee Oversight");
    setup.roleIncludesAllPermissionsOfOtherRole("Committee Deputy Chair", "Committee Oversight");

    setup.groupPermission(Group.Everyone, "read", T.CommitteeMeeting);

    setup.roleRestrictionLabelWithGlobalEffect("Committee Representative", Label.AllowViewCommitteeMeetingFiles);
    setup.roleRestrictionLabelWithGlobalEffect("Committee Member",         Label.AllowViewCommitteeMeetingFiles);
    setup.roleRestrictionLabelWithGlobalEffect("Committee Chair",          Label.AllowViewCommitteeMeetingFiles);
    setup.roleRestrictionLabelWithGlobalEffect("Committee Deputy Chair",   Label.AllowViewCommitteeMeetingFiles);
});